import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const root = process.cwd();
const bash = process.platform === "win32"
  ? [join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe"), "C:/Program Files/Git/bin/bash.exe"].find(existsSync)
  : "/bin/bash";
const shellPath = (value: string) => value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "zura-macos-setup-"));
  temporaryRoots.push(directory);
  const checkout = join(directory, "Editor's checkout with spaces");
  const home = join(directory, "Home with spaces");
  const bin = join(directory, "mock-bin");
  const log = join(directory, "commands.jsonl");
  mkdirSync(join(checkout, "scripts"), { recursive: true });
  mkdirSync(join(checkout, "src"));
  mkdirSync(home);
  mkdirSync(bin);
  for (const file of ["INSTALL-ZURA-PREMIERE-MCP.command", "scripts/install-zura-premiere-mcp.sh", "package.json"]) {
    cpSync(join(root, file), join(checkout, file));
  }
  writeFileSync(join(checkout, "src/index.ts"), "// source checkout marker\n");
  const handler = join(directory, "handler.mjs");
  writeFileSync(handler, `
    import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    const [command, ...args] = process.argv.slice(2);
    appendFileSync(process.env.MOCK_LOG, JSON.stringify({ command, args }) + "\\n");
    if (process.env.MOCK_FAILURE === command + ":" + args[0] ||
        process.env.MOCK_FAILURE === args[1]) process.exit(9);
    if (command === "npm" && args[0] === "install" && !process.env.MOCK_MISSING_ENTRYPOINT) {
      const prefix = args[args.indexOf("--prefix") + 1];
      const dist = join(prefix, "lib/node_modules/zura-premiere-mcp/dist");
      mkdirSync(dist, { recursive: true });
      writeFileSync(join(dist, "index.js"), "// mock installed server\\n");
    }
    if (args[1] === "--print-client-config") console.log("absolute client configuration");
  `);
  // Convert mock argv before invoking Windows Node from Git Bash or Cygwin.
  const windowsConversion = [
    'if command -v cygpath >/dev/null 2>&1; then',
    '  converted=()',
    '  for arg in "$@"; do',
    '    case "$arg" in /[A-Za-z]/*) arg="$(cygpath -w "$arg")" ;; esac',
    '    converted+=("$arg")',
    '  done',
    '  set -- "${converted[@]}"',
    'fi',
  ].join("\n");
  const executable = (name: string, source: string) => writeFileSync(join(bin, name), `#!/bin/bash\nset -e\n${windowsConversion}\n${source}\n`, { mode: 0o755 });
  executable("uname", 'printf "%s\\n" "${MOCK_OS:-Darwin}"');
  executable("node", `
    case "$1" in
      -e)
        shift
        code="$1"
        shift
        exec "$REAL_NODE" -e 'Object.defineProperty(process.versions, "node", {value: process.env.MOCK_NODE_VERSION || process.versions.node});'"$code" "$@" ;;
      -p) printf '%s\\n' "$MOCK_NODE_PATH" ;;
      *) exec "$REAL_NODE" "$MOCK_HANDLER" node "$@" ;;
    esac
  `);
  for (const name of ["npm", "codex"]) executable(name, `exec "$REAL_NODE" "$MOCK_HANDLER" ${name} "$@"`);
  const prefix = join(home, "Library/Application Support/Adobe/ZuraPremiereMCP");
  const entrypoint = join(prefix, "lib/node_modules/zura-premiere-mcp/dist/index.js");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: shellPath(home),
    PATH: `${bin}${delimiter}${process.env.PATH}`,
    REAL_NODE: shellPath(process.execPath),
    MOCK_NODE_PATH: shellPath(join(bin, "node")),
    MOCK_HANDLER: handler,
    MOCK_BIN: shellPath(bin),
    MOCK_LOG: log,
    MOCK_NODE_VERSION: "24.0.0",
    MOCK_OS: "Darwin",
    MOCK_FAILURE: "",
    MOCK_MISSING_ENTRYPOINT: "",
  };
  delete env.MSYS_NO_PATHCONV;
  delete env.MSYS2_ARG_CONV_EXCL;
  const run = (args: string[] = [], overrides: Record<string, string> = {}) => {
    const result = spawnSync(bash!, ["--noprofile", "--norc", "-c", 'export PATH="$MOCK_BIN:$PATH"; exec /bin/bash "$@"', "setup", shellPath(join(checkout, "INSTALL-ZURA-PREMIERE-MCP.command")), ...args], {
      cwd: directory,
      env: { ...env, ...overrides },
      encoding: "utf8",
      timeout: 15000,
    });
    if (result.error) throw result.error;
    return { ...result, output: result.stdout + result.stderr };
  };
  const commands = (): Array<{ command: string; args: string[] }> => existsSync(log)
    ? readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line))
    : [];
  return { run, commands, prefix, entrypoint, checkout, bin };
}

describe.skipIf(!bash)("macOS source setup", () => {
  it("parses the setup entrypoint and Mac installer scripts with Bash", () => {
    for (const file of ["INSTALL-ZURA-PREMIERE-MCP.command", "scripts/install-zura-premiere-mcp.sh", "scripts/build-connector-installer.sh"]) {
      const result = spawnSync(bash!, ["-n", shellPath(join(root, file))], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    }
  });

  it("builds, installs, verifies the panel, and registers absolute paths with spaces", () => {
    const setup = fixture();
    const result = setup.run();
    expect(result.status, result.output).toBe(0);
    const commands = setup.commands();
    expect(commands.map(call => [call.command, call.args[0]])).toEqual([
      ["npm", "ci"], ["npm", "run"], ["npm", "install"],
      ["node", expect.any(String)], ["node", expect.any(String)], ["codex", "mcp"],
    ]);
    expect(commands[1].args).toEqual(["run", "build"]);
    expect(commands[2].args.slice(0, 3)).toEqual(["install", "--global", "--prefix"]);
    expect(resolve(commands[2].args[3])).toBe(setup.prefix);
    expect(commands[2].args[4]).toBe("--install-links");
    expect(resolve(commands[2].args[5])).toBe(setup.checkout);
    expect(commands[3].args[1]).toBe("--install-cep");
    expect(commands[4].args[1]).toBe("--diagnose-cep");
    expect(commands[5].args.slice(0, 4)).toEqual(["mcp", "add", "zura-premiere-mcp", "--"]);
    expect(resolve(commands[5].args[4])).toBe(join(setup.bin, "node"));
    expect(resolve(commands[5].args[5])).toBe(setup.entrypoint);
    expect(readFileSync(join(setup.prefix, "source-root.txt"), "utf8").trim()).toBe(shellPath(setup.checkout));
  });

  it.each(["--skip-codex", "--plugin-managed"])("leaves client registration unchanged with %s", option => {
    const setup = fixture();
    rmSync(join(setup.bin, "codex"));
    const result = setup.run([option]);
    expect(result.status, result.output).toBe(0);
    expect(setup.commands().some(call => call.command === "codex")).toBe(false);
    expect(setup.commands().at(-1)?.args.slice(1)).toEqual(["--print-client-config", "codex"]);
  });

  it.each(["18.20.0", "20.18.3"])("rejects Node %s before installing anything", version => {
    const setup = fixture();
    const result = setup.run([], { MOCK_NODE_VERSION: version });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("is too old");
    expect(setup.commands()).toEqual([]);
  });

  it.each(["20.19.0", "22.0.0"])("accepts supported Node %s", version => {
    const result = fixture().run([], { MOCK_NODE_VERSION: version });
    expect(result.status, result.output).toBe(0);
  });

  it("rejects non-macOS hosts before installing anything", () => {
    const setup = fixture();
    const result = setup.run([], { MOCK_OS: "Linux" });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("supports macOS only");
    expect(setup.commands()).toEqual([]);
  });

  it("rejects an unrelated source checkout before installing anything", () => {
    const setup = fixture();
    writeFileSync(join(setup.checkout, "package.json"), JSON.stringify({ name: "another-package" }));
    expect(setup.run().output).toContain("Zura Premiere MCP source checkout");
    expect(setup.commands()).toEqual([]);
  });

  it.each(["npm:ci", "npm:run", "npm:install", "--install-cep", "--diagnose-cep", "codex:mcp"])("stops and does not record a successful install when %s fails", failure => {
    const setup = fixture();
    const result = setup.run([], { MOCK_FAILURE: failure });
    expect(result.status).toBe(9);
    expect(result.output).not.toContain("are installed.");
    expect(existsSync(join(setup.prefix, "source-root.txt"))).toBe(false);
    if (failure !== "codex:mcp") expect(setup.commands().some(call => call.command === "codex")).toBe(false);
  });

  it("fails before installing the panel if npm leaves no server entrypoint", () => {
    const setup = fixture();
    const result = setup.run([], { MOCK_MISSING_ENTRYPOINT: "1" });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("entrypoint was not found");
    expect(setup.commands().every(call => call.command === "npm")).toBe(true);
  });

  it("shows help and rejects unknown options without installing anything", () => {
    const setup = fixture();
    expect(setup.run(["--help"]).status).toBe(0);
    expect(setup.run(["--invalid"]).status).not.toBe(0);
    expect(setup.commands()).toEqual([]);
  });
});
