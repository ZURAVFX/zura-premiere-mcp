import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runSetup } from "../scripts/install-zura-premiere-mcp.mjs";

const root = process.cwd();
const sourceRoot = join(root, "Editor's checkout with spaces");

afterEach(() => vi.restoreAllMocks());

describe("shared source setup launcher", () => {
  it("launches Windows PowerShell with a literal script path and no shell interpolation", () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(runSetup({ platform: "win32", args: [], sourceRoot, run })).toBe(0);
    expect(run).toHaveBeenCalledWith("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      join(sourceRoot, "scripts", "install-zura-premiere-mcp.ps1"),
    ], { cwd: sourceRoot, stdio: "inherit", windowsHide: true });
  });

  it("launches macOS Bash with a literal script path and no shell interpolation", () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(runSetup({ platform: "darwin", args: [], sourceRoot, run })).toBe(0);
    expect(run).toHaveBeenCalledWith("/bin/bash", [join(sourceRoot, "scripts", "install-zura-premiere-mcp.sh")], {
      cwd: sourceRoot, stdio: "inherit", windowsHide: true,
    });
  });

  it.each([
    ["win32", "-PluginManaged"],
    ["darwin", "--skip-codex"],
    ["darwin", "--plugin-managed"],
  ])("forwards native installer arguments on %s", (platform, flag) => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    runSetup({ platform, args: [flag], sourceRoot, run });
    expect(run.mock.calls[0][1].at(-1)).toBe(flag);
  });

  it.each([0, 1, 9])("preserves installer exit status %s", status => {
    expect(runSetup({ platform: "darwin", args: [], run: vi.fn().mockReturnValue({ status }) })).toBe(status);
  });

  it("rejects unsupported hosts without executing an installer", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn();
    expect(runSetup({ platform: "linux", args: [], run })).toBe(1);
    expect(run).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Setup is supported only on Windows and macOS.");
  });

  it("reports a missing native executable as a failed setup", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runSetup({ platform: "win32", args: [], run: vi.fn().mockReturnValue({ error: new Error("ENOENT") }) })).toBe(1);
    expect(error).toHaveBeenCalledWith("Could not start powershell.exe: ENOENT");
  });

  it("does not report success if the installer is terminated", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(runSetup({ platform: "darwin", args: [], run: vi.fn().mockReturnValue({ status: null, signal: "SIGTERM" }) })).toBe(1);
    expect(error).toHaveBeenCalledWith("Setup was interrupted by SIGTERM.");
  });

  it.each(["--help", "-h"])("prints %s without changing the installation", flag => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const run = vi.fn();
    expect(runSetup({ args: [flag], run })).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("loads the public command from outside the repository", () => {
    const result = spawnSync(process.execPath, [join(root, "INSTALL-ZURA-PREMIERE-MCP.mjs"), "--help"], {
      cwd: dirname(root), encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Windows or macOS");
  });

  it("keeps the copied GitHub prompt and npm setup command tied to the shared launcher", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const prompt = /```text\n([\s\S]*?)\n```/.exec(readme)?.[1];
    expect(prompt).toContain("Detect whether this is Windows or macOS");
    expect(prompt).toContain("https://github.com/ZURAVFX/zura-premiere-mcp");
    expect(prompt).toContain("node INSTALL-ZURA-PREMIERE-MCP.mjs");
    expect(prompt).not.toContain("on this Windows PC");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts.setup).toBe("node INSTALL-ZURA-PREMIERE-MCP.mjs");
  });
});
