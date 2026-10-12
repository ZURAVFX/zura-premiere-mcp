#!/usr/bin/env node
import { parse } from "acorn";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CAPTION_STUDIO_ORIGIN = "https://oa-caption-studio-beta.vercel.app";
const MAX_BYTES = 12 * 1024 * 1024;
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);
const fail = (message) => { throw new Error(message); };

// Interpret only constant data and the app's pure settings normalizer. Remote
// code never runs: no eval, VM, property calls, imports, loops, or side effects.
export function parsePresetCatalogue(source) {
  if (Buffer.byteLength(source) > MAX_BYTES) fail("Caption Studio asset exceeds the read limit.");
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const bindings = new Map();
  for (let statement of ast.body) {
    if (statement.type === "ExportNamedDeclaration") statement = statement.declaration;
    if (statement?.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) if (declaration.id.type === "Identifier") bindings.set(declaration.id.name, declaration.init);
    } else if (statement?.type === "FunctionDeclaration") bindings.set(statement.id.name, statement);
  }
  const evaluate = (node, locals = new Map(), depth = 0) => {
    if (!node || depth > 40) fail("Unsupported or recursive preset data.");
    const next = (value) => evaluate(value, locals, depth + 1);
    switch (node.type) {
      case "Literal": return node.value;
      case "Identifier":
        if (locals.has(node.name)) return locals.get(node.name);
        if (node.name === "undefined") return undefined;
        return evaluate(bindings.get(node.name), locals, depth + 1);
      case "ObjectExpression": {
        const result = {};
        for (const property of node.properties) {
          if (property.type === "SpreadElement") { Object.assign(result, next(property.argument)); continue; }
          if (property.computed || property.kind !== "init" || property.method) fail("Unsupported preset property.");
          const key = property.key.name ?? property.key.value;
          if (forbiddenKeys.has(key)) fail("Unsafe preset property.");
          result[key] = next(property.value);
        }
        return result;
      }
      case "ArrayExpression": return node.elements.map(next);
      case "UnaryExpression": {
        const value = next(node.argument);
        if (node.operator === "-") return -value;
        if (node.operator === "+") return +value;
        if (node.operator === "!") return !value;
        if (node.operator === "void") return undefined;
        break;
      }
      case "ConditionalExpression": return next(node.test) ? next(node.consequent) : next(node.alternate);
      case "LogicalExpression": {
        const left = next(node.left);
        if (node.operator === "||") return left || next(node.right);
        if (node.operator === "&&") return left && next(node.right);
        if (node.operator === "??") return left ?? next(node.right);
        break;
      }
      case "MemberExpression": {
        const key = node.computed ? next(node.property) : node.property.name;
        if (forbiddenKeys.has(key)) fail("Unsafe preset property access.");
        const object = next(node.object);
        return object && Object.hasOwn(object, key) ? object[key] : undefined;
      }
      case "CallExpression": {
        const args = node.arguments.map(next);
        if (node.callee.type === "Identifier" && node.callee.name === "Number") return Number(args[0]);
        if (node.callee.type === "MemberExpression" && !node.callee.computed) {
          const name = `${node.callee.object.name}.${node.callee.property.name}`;
          const pure = { "Number.isFinite": Number.isFinite, "Math.max": Math.max, "Math.min": Math.min };
          if (Object.hasOwn(pure, name)) return pure[name](...args);
          fail("Unsupported function in preset settings.");
        }
        const fn = bindings.get(node.callee.name);
        if (!fn || !["FunctionDeclaration", "ArrowFunctionExpression", "FunctionExpression"].includes(fn.type)) fail("Unknown preset normalizer.");
        const scope = new Map(locals);
        fn.params.forEach((parameter, index) => {
          const id = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
          if (id.type !== "Identifier") fail("Unsupported preset normalizer parameter.");
          scope.set(id.name, args[index] ?? (parameter.type === "AssignmentPattern" ? evaluate(parameter.right, scope, depth + 1) : undefined));
        });
        if (fn.body.type !== "BlockStatement") return evaluate(fn.body, scope, depth + 1);
        for (const statement of fn.body.body) {
          if (statement.type === "VariableDeclaration") {
            for (const declaration of statement.declarations) {
              if (declaration.id.type !== "Identifier") fail("Unsupported normalizer variable.");
              scope.set(declaration.id.name, evaluate(declaration.init, scope, depth + 1));
            }
          } else if (statement.type === "ReturnStatement") return evaluate(statement.argument, scope, depth + 1);
          else fail("Unsupported preset normalizer statement.");
        }
        fail("Preset normalizer has no return value.");
      }
    }
    fail(`Unsupported preset expression: ${node.type}.`);
  };
  const presets = new Map();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "ObjectExpression") {
      for (const property of node.properties) {
        if (property.type !== "Property" || property.computed) continue;
        const raw = property.value.type === "CallExpression" ? property.value.arguments[0] : property.value;
        if (raw?.type !== "ObjectExpression") continue;
        const keys = raw.properties.map((entry) => entry.key?.name ?? entry.key?.value);
        if (!["width", "height", "fps", "fontFamily"].every((key) => keys.includes(key))) continue;
        const name = String(property.key.name ?? property.key.value);
        const settings = evaluate(property.value);
        if (!(settings.width > 0 && settings.height > 0 && settings.fps > 0 && typeof settings.fontFamily === "string")) fail(`Invalid settings for ${name}.`);
        if (presets.has(name) && JSON.stringify(presets.get(name)) !== JSON.stringify(settings)) fail(`Conflicting live settings for ${name}.`);
        presets.set(name, settings);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast);
  return Object.fromEntries(presets);
}

export function resolvePresetName(requested, names) {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (names.includes(requested)) return requested;
  let matches = names.filter((name) => normalize(name) === normalize(requested));
  if (!matches.length && /^v4v(?:sub(?:s|titles?)?)?$/.test(normalize(requested))) matches = names.filter((name) => /^v4v(?:_|\s|-|$)/i.test(name));
  if (matches.length !== 1) fail(matches.length ? `Preset "${requested}" is ambiguous: ${matches.join(", ")}. Choose the exact name.` : `Preset "${requested}" was not found. Available: ${names.join(", ")}. No substitute selected.`);
  return matches[0];
}

export function settingsDigest(settings) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(settings))).digest("hex")}`;
}

export async function fetchPresetCatalogue(fetcher = fetch) {
  const signal = AbortSignal.timeout(45000);
  const read = async (url) => {
    const response = await fetcher(url, { redirect: "follow", signal });
    if (!response.ok) fail(`Caption Studio returned HTTP ${response.status}.`);
    if (Number(response.headers?.get("content-length")) > MAX_BYTES) fail("Caption Studio response exceeds the read limit.");
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_BYTES) fail("Caption Studio response exceeds the read limit.");
    return text;
  };
  const html = await read(CAPTION_STUDIO_ORIGIN);
  const assets = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi)].map((match) => new URL(match[1], CAPTION_STUDIO_ORIGIN).href))];
  if (!assets.length || assets.length > 8) fail("Caption Studio no longer publishes a bounded readable asset catalogue.");
  const presets = {};
  for (const asset of assets) {
    if (new URL(asset).origin !== CAPTION_STUDIO_ORIGIN) fail("Caption Studio asset has an unexpected origin.");
    const found = parsePresetCatalogue(await read(asset));
    for (const [name, settings] of Object.entries(found)) {
      if (Object.hasOwn(presets, name) && settingsDigest(presets[name]) !== settingsDigest(settings)) fail(`Conflicting live settings for ${name}.`);
      Object.defineProperty(presets, name, { value: settings, enumerable: true });
    }
  }
  if (!Object.keys(presets).length) fail("Caption Studio catalogue format changed. Use an exported project; do not guess a preset.");
  return { source: CAPTION_STUDIO_ORIGIN, retrieved_at: new Date().toISOString(), presets };
}

export async function runPresetCli(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!["--preset", "--project", "--selection", "--output", "--verify-project"].includes(argv[index]) || !argv[index + 1]) fail("Usage: caption-studio-presets.mjs [--preset NAME] [--project JSON | --selection JSON] [--verify-project JSON] [--output JSON]");
    options[argv[index].slice(2)] = argv[index + 1];
  }
  let result;
  if (options.project && options.selection) fail("Choose either --project or --selection, not both.");
  if (options.selection) {
    result = JSON.parse(await readFile(options.selection, "utf8"));
    if (!result.selectedPreset || !result.settings || typeof result.settings !== "object" || Array.isArray(result.settings) || settingsDigest(result.settings) !== result.settings_sha256) fail("The saved preset selection is invalid or its settings hash changed.");
    if (options.preset) resolvePresetName(options.preset, [result.selectedPreset]);
  } else if (options.project) {
    const project = JSON.parse(await readFile(options.project, "utf8"));
    if (project.format !== "oa-caption-project" || !project.settings || typeof project.settings !== "object" || Array.isArray(project.settings) || !project.selectedPreset) fail("The exported Caption Studio project must contain settings and selectedPreset.");
    if (options.preset) resolvePresetName(options.preset, [project.selectedPreset]);
    result = { source: resolve(options.project), selectedPreset: project.selectedPreset, settings: project.settings, settings_sha256: settingsDigest(project.settings) };
  } else {
    const catalogue = await fetchPresetCatalogue();
    const names = Object.keys(catalogue.presets).sort();
    result = { ...catalogue, presets: names };
    if (options.preset) {
      const selectedPreset = resolvePresetName(options.preset, names);
      const settings = catalogue.presets[selectedPreset];
      result = { ...result, selectedPreset, settings, settings_sha256: settingsDigest(settings) };
    }
  }
  if (options["verify-project"]) {
    const project = JSON.parse(await readFile(options["verify-project"], "utf8"));
    if (!result.selectedPreset || project.format !== "oa-caption-project" || project.selectedPreset !== result.selectedPreset || !project.settings || settingsDigest(project.settings) !== result.settings_sha256) fail("Caption project preset or settings differ from the resolved preset. Do not render or deliver it.");
    result.project_verified = true;
  }
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) await writeFile(options.output, output, { flag: "wx" });
  else process.stdout.write(output);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runPresetCli().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
