import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function runSetup({
  platform = process.platform,
  args = process.argv.slice(2),
  sourceRoot = projectRoot,
  run = spawnSync,
} = {}) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log("Usage: node INSTALL-ZURA-PREMIERE-MCP.mjs");
    console.log("Build and install Zura Premiere MCP and its Premiere panel, then register with Codex on Windows or macOS.");
    console.log("Additional arguments are passed to the platform's native installer.");
    return 0;
  }

  let command;
  let installerArgs;
  if (platform === "win32") {
    command = "powershell.exe";
    installerArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(sourceRoot, "scripts", "install-zura-premiere-mcp.ps1"), ...args];
  } else if (platform === "darwin") {
    command = "/bin/bash";
    installerArgs = [join(sourceRoot, "scripts", "install-zura-premiere-mcp.sh"), ...args];
  } else {
    console.error("Setup is supported only on Windows and macOS.");
    return 1;
  }

  const result = run(command, installerArgs, { cwd: sourceRoot, stdio: "inherit", windowsHide: true });
  if (result.error) {
    console.error(`Could not start ${command}: ${result.error.message}`);
    return 1;
  }
  if (result.signal) console.error(`Setup was interrupted by ${result.signal}.`);
  return result.status ?? 1;
}
