#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const readJson = (path) => JSON.parse(read(path));
const release = readJson("release-metadata.json");
const tag = process.env.RELEASE_TAG;
const expectedTag = `v${release.version}`;

if (tag !== expectedTag) {
  throw new Error(`Release tag must be exactly ${expectedTag}; received ${tag || "(missing)"}`);
}

const versionedJson = [
  "package.json",
  "claude-desktop/manifest.json",
  "uxp-plugin/manifest.json",
  "registry/server.json",
];
for (const path of versionedJson) {
  if (readJson(path).version !== release.version) {
    throw new Error(`${path} does not match release metadata version ${release.version}`);
  }
}

const lock = readJson("package-lock.json");
if (lock.version !== release.version || lock.packages[""].version !== release.version) {
  throw new Error("Dependency lock version does not match release metadata");
}
const uxpVersion = readJson("uxp-plugin/manifest.json").version;
if (uxpVersion !== release.version) throw new Error("UXP version does not match release metadata");

const cepManifest = read("cep-plugin/CSXS/manifest.xml");
if (!cepManifest.includes(`ExtensionBundleVersion="${release.version}"`)) {
  throw new Error("CEP bundle version does not match release metadata");
}

console.log(`Release tag and distributable manifests verified for ${expectedTag}`);
