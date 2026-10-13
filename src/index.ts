#!/usr/bin/env node

import { StdioServerTransport, serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";
import { cleanupTempDir, getTempDir } from "./bridge/file-bridge.js";
import { getTelemetry } from "./telemetry.js";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { UxpWebSocketBridge } from "./bridge/uxp-websocket-bridge.js";
import {
  collectLocalDoctor,
  createDoctorRepairPlan,
  createSupportBundle,
  renderDoctorHuman,
} from "./diagnostics.js";
import { applyDoctorRepairPlan } from "./doctor-repairs.js";
import { readEnvValue } from "./env-config.js";
import { createLazyUxpStart, LazyUxpStart } from "./uxp-lazy-start.js";
import { parseClientConfigAction, renderClientConfig } from "./client-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const debugEnabled = /^(1|true|yes|on|debug)$/i.test(
  process.env.PREMIERE_MCP_DEBUG ?? "",
);

function debugLog(message: string): void {
  if (debugEnabled) {
    console.error(`[zura-premiere-mcp] ${message}`);
  }
}

type McpProtocolMode = "auto" | "legacy";

function readMcpProtocolMode(value = process.env.PREMIERE_MCP_PROTOCOL_MODE): McpProtocolMode {
  const mode = readEnvValue(value);
  if (mode === undefined || mode === "auto") return "auto";
  if (mode === "legacy") return "legacy";
  throw new Error("PREMIERE_MCP_PROTOCOL_MODE must be either auto or legacy.");
}

function isLoopbackPortInUse(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && (error as NodeJS.ErrnoException).code === "EADDRINUSE",
  );
}

function printUpdateInstructions(): void {
  console.log("Zura Premiere MCP source and releases are maintained at https://github.com/ZURAVFX/zura-premiere-mcp.");
  console.log("Pull the latest source and rerun node INSTALL-ZURA-PREMIERE-MCP.mjs to update the local MCP and Premiere panel on Windows or macOS.");
  console.log("This command does not contact npm or update files automatically.");
}

// Handle CLI flags
const args = process.argv.slice(2);

try {
  const client = parseClientConfigAction(args);
  if (client) {
    process.stdout.write(renderClientConfig(client, process.execPath, __filename));
    process.exit(0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not generate client configuration.");
  process.exit(1);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
zura-premiere-mcp — local MCP for Adobe Premiere Pro

Usage:
  zura-premiere-mcp              Start the MCP server (stdio transport)
  zura-premiere-mcp --install-cep   Install the CEP plugin into Premiere Pro
  zura-premiere-mcp --uninstall-cep Remove this CEP plugin from Premiere Pro
  zura-premiere-mcp --diagnose-cep  Check the CEP install, debug keys, and Premiere signature logs
  zura-premiere-mcp --install-after-effects-cep   Install the dedicated CEP plugin into After Effects
  zura-premiere-mcp --uninstall-after-effects-cep Remove this CEP plugin from After Effects
  zura-premiere-mcp --diagnose-after-effects-cep  Check the After Effects CEP install and debug keys
  zura-premiere-mcp --doctor        Check local install/configuration without reading a project
  zura-premiere-mcp --doctor --json Print the same local check as machine-readable JSON
  zura-premiere-mcp --doctor --plan-fixes Show a no-write, privacy-safe local repair plan
  zura-premiere-mcp --doctor --apply-fixes Apply only safe planned local fixes; requires explicit Premiere-closed confirmation where needed
  zura-premiere-mcp --doctor --apply-fixes --confirm-premiere-closed Confirm Premiere is fully closed before a connector repair
  zura-premiere-mcp --support-bundle  Print a privacy-safe, machine-readable support bundle
  zura-premiere-mcp --print-client-config <claude|cursor|vscode|codex> Print configuration for this installed copy; writes no files
  zura-premiere-mcp --check-update    Show the source update path (no npm access)
  zura-premiere-mcp --update          Show the source update path (no automatic changes)
  zura-premiere-mcp --help          Show this help message
  zura-premiere-mcp --version       Show version

Environment variables:
  PREMIERE_TEMP_DIR     Shared bridge directory (default: per-user Adobe folder on Windows; OS temp elsewhere)
  PREMIERE_TIMEOUT_MS   Command timeout in ms (default: 30000)
  PREMIERE_MCP_CAPABILITIES  Comma-separated authority profile
  PREMIERE_MCP_TOOL_PACKS    Comma-separated discovery packs: full, essential, inspection, delivery, captions
  PREMIERE_MCP_DEBUG    Set to 1/true to enable verbose stderr diagnostics
  PREMIERE_MCP_PROTOCOL_MODE  auto (default) or legacy; use legacy only when a client cannot complete modern MCP negotiation
  PREMIERE_UXP_TOKEN    Enable the authenticated local UXP bridge (minimum 16 characters)
  PREMIERE_UXP_PORT     UXP loopback WebSocket port (default: 7777)
  AFTER_EFFECTS_MCP_TEMP_DIR  Shared AE bridge directory (default: OS temp + /after-effects-mcp-bridge)

More info: https://github.com/ZURAVFX/zura-premiere-mcp
`);
  process.exit(0);
}

const updateActions = ["--check-update", "--update"].filter((flag) => args.includes(flag));
if (updateActions.length > 1) {
  console.error("Use only one update action at a time: --check-update or --update.");
  process.exit(1);
}
if (updateActions.length === 1) {
  printUpdateInstructions();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = await import("../package.json", { with: { type: "json" } }).catch(
    () => ({ default: { version: "unknown" } }),
  );
  console.log(pkg.default.version);
  process.exit(0);
}

const doctorPlanRequested = args.includes("--plan-fixes");
const doctorApplyRequested = args.includes("--apply-fixes");
const premiereClosedConfirmed = args.includes("--confirm-premiere-closed");
if ((doctorPlanRequested || doctorApplyRequested) && !args.includes("--doctor")) {
  console.error("--plan-fixes and --apply-fixes require --doctor.");
  process.exit(1);
}
if (doctorPlanRequested && doctorApplyRequested) {
  console.error("Use either --plan-fixes or --apply-fixes, not both.");
  process.exit(1);
}
if (premiereClosedConfirmed && !doctorApplyRequested) {
  console.error("--confirm-premiere-closed is only valid with --doctor --apply-fixes.");
  process.exit(1);
}

if (args.includes("--doctor") || args.includes("--support-bundle")) {
  if (args.includes("--support-bundle") && (doctorPlanRequested || doctorApplyRequested)) {
    console.error("--support-bundle cannot be combined with --plan-fixes or --apply-fixes.");
    process.exit(1);
  }
  const pkg = await import("../package.json", { with: { type: "json" } }).catch(
    () => ({ default: { name: "zura-premiere-mcp", version: "unknown", homepage: "https://github.com/ZURAVFX/zura-premiere-mcp" } }),
  );
  if (args.includes("--support-bundle")) {
    // A support bundle is JSON by default so it can be attached to an issue or
    // support request without copying terminal output. It is a status snapshot,
    // never a project/log/configuration dump.
    console.log(JSON.stringify(createSupportBundle({ version: pkg.default.version }), null, 2));
  } else {
    const report = collectLocalDoctor();
    if (doctorPlanRequested) {
      console.log(JSON.stringify(createDoctorRepairPlan(report), null, 2));
    } else if (doctorApplyRequested) {
      const result = applyDoctorRepairPlan(createDoctorRepairPlan(report), {
        projectRoot,
        confirmPremiereClosed: premiereClosedConfirmed,
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.actions.some((action) => action.status === "failed")) process.exit(1);
    } else {
      const identity = {
        name: String(pkg.default.name),
        version: String(pkg.default.version),
        homepage: String(pkg.default.homepage),
      };
      console.log(args.includes("--json")
        ? JSON.stringify(report, null, 2)
        : renderDoctorHuman(report, identity));
    }
  }
  process.exit(0);
}

const cepActions = [
  "--install-cep", "--uninstall-cep", "--diagnose-cep",
  "--install-after-effects-cep", "--uninstall-after-effects-cep", "--diagnose-after-effects-cep",
].filter((flag) => args.includes(flag));
if (cepActions.length > 1) {
  console.error("Use only one CEP action at a time.");
  process.exit(1);
}

if (cepActions.length === 1) {
  const action = cepActions[0];
  const diagnose = action === "--diagnose-cep" || action === "--diagnose-after-effects-cep";
  const afterEffects = action.includes("after-effects");
  const uninstall = action === "--uninstall-cep" || action === "--uninstall-after-effects-cep";
  const hostLabel = afterEffects ? "After Effects" : "Premiere Pro";
  console.log(uninstall
    ? `Removing ${hostLabel} CEP plugin...\n`
    : diagnose ? `Diagnosing ${hostLabel} CEP plugin...\n` : `Installing ${hostLabel} CEP plugin...\n`);
  const isWindows = process.platform === "win32";
  const isMacOS = process.platform === "darwin";
  if (!isWindows && !isMacOS) {
    console.error(
      `CEP installation is supported only on Windows and macOS (current platform: ${process.platform}).`,
    );
    process.exit(1);
  }
  const scriptPath = path.join(
    projectRoot,
    "scripts",
    isWindows ? "install-cep.ps1" : "install-cep.sh",
  );
  try {
    if (isWindows) {
      const powershellArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath];
      if (diagnose) powershellArgs.push("-Diagnose");
      if (uninstall) {
        powershellArgs[4] = path.join(projectRoot, "scripts", "uninstall-cep.ps1");
      }
      if (afterEffects) powershellArgs.push("-ConnectorHost", "AfterEffects");
      execFileSync(
        "powershell.exe",
        powershellArgs,
        { stdio: "inherit", cwd: projectRoot },
      );
    } else {
      const macosScriptPath = uninstall
        ? path.join(projectRoot, "scripts", "uninstall-cep.sh")
        : scriptPath;
      const connectorArgs = [macosScriptPath, uninstall ? "--user" : diagnose ? "--diagnose" : "--copy"];
      if (afterEffects) connectorArgs.push("--after-effects");
      execFileSync("bash", connectorArgs, {
        stdio: "inherit",
        cwd: projectRoot,
      });
    }
  } catch {
    const operation = uninstall ? "uninstallation" : diagnose ? "diagnostics" : "installation";
    console.error(`${hostLabel} CEP ${operation} failed. Try running manually:`);
    console.error(
      isWindows
        ? `  powershell -ExecutionPolicy Bypass -File "${uninstall ? path.join(projectRoot, "scripts", "uninstall-cep.ps1") : scriptPath}"${diagnose ? " -Diagnose" : ""}${afterEffects ? " -ConnectorHost AfterEffects" : ""}`
        : `  bash "${uninstall ? path.join(projectRoot, "scripts", "uninstall-cep.sh") : scriptPath}" ${uninstall ? "--user" : diagnose ? "--diagnose" : "--copy"}${afterEffects ? " --after-effects" : ""}`,
    );
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  process.env.PREMIERE_MCP_TRANSPORT = "stdio";
  const protocolMode = readMcpProtocolMode();
  const telemetry = getTelemetry();
  const bridgeOptions = {
    tempDir: process.env.PREMIERE_TEMP_DIR,
    timeoutMs: process.env.PREMIERE_TIMEOUT_MS
      ? parseInt(process.env.PREMIERE_TIMEOUT_MS, 10)
      : undefined,
  };

  const tempDir = getTempDir(bridgeOptions);
  debugLog("Starting MCP server...");
  debugLog(`Temp directory: ${tempDir}`);

  // Clean up any stale files from previous sessions
  cleanupTempDir(bridgeOptions);

  let uxpBridge: UxpWebSocketBridge | undefined;
  let lazyUxp: LazyUxpStart | undefined;
  const uxpToken = readEnvValue(process.env.PREMIERE_UXP_TOKEN);
  if (uxpToken) {
    const bridge = new UxpWebSocketBridge({
      token: uxpToken,
      port: process.env.PREMIERE_UXP_PORT
        ? parseInt(process.env.PREMIERE_UXP_PORT, 10)
        : undefined,
    });
    // The tools register against the bridge now; the loopback port binds on the
    // first real request so Claude Desktop's discover-only probe never holds it.
    uxpBridge = bridge;
    lazyUxp = createLazyUxpStart({
      start: () => bridge.start(),
      isPortInUse: isLoopbackPortInUse,
      onStarted: () => {
        const address = bridge.address();
        debugLog(`UXP bridge listening on ws://${address.host}:${address.port}${address.path}`);
      },
      onBusy: () => console.error(
        "[zura-premiere-mcp] UXP loopback port is busy; UXP tools stay unavailable and the bind is retried until it frees up.",
      ),
      onError: (error) => console.error("[zura-premiere-mcp] UXP bridge failed to start:", error),
    });
  }

  const serverHandle = protocolMode === "legacy"
    ? await (async () => {
      const server = createServer(bridgeOptions, { uxpBridge, telemetry });
      const transport = new StdioServerTransport();
      await server.connect(transport);
      debugLog("Server connected in legacy MCP mode");
      return {
        close: async () => {
          await server.close();
          await transport.close();
        },
      };
    })()
    : serveStdio(
      () => createServer(bridgeOptions, { uxpBridge, telemetry }),
      {
        onerror: (error) => console.error("[zura-premiere-mcp] MCP stdio error:", error),
      },
    );
  if (protocolMode === "auto") debugLog("Server connected and ready");
  // Attached after the transport so the SDK reader owns the stream first.
  if (lazyUxp) process.stdin.on("data", lazyUxp.observe);

  const shutdown = async () => {
    lazyUxp?.stop();
    if (uxpBridge) await uxpBridge.stop();
    await serverHandle.close();
    await telemetry.shutdown();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  // A client that closes stdin is gone; do not linger and hold the UXP port.
  process.stdin.once("end", () => void shutdown().finally(() => process.exit(0)));
}

main().catch((err) => {
  console.error("[zura-premiere-mcp] Fatal error:", err);
  process.exit(1);
});
