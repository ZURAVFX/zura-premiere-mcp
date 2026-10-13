import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("source distribution publication boundary", () => {
  it("does not ship an automatic upstream npm publisher", () => {
    expect(existsSync(".github/workflows/npm-publish.yml")).toBe(false);
    for (const name of readdirSync(".github/workflows")) {
      const workflow = readFileSync(join(".github/workflows", name), "utf8");
      expect(workflow, name).not.toMatch(/\bnpm publish\b/);
    }
  });
  it("passes installer arguments as structured process data", () => {
    const installer = readFileSync("scripts/install-zura-premiere-mcp.mjs", "utf8");
    expect(installer).toContain("...args");
    expect(installer).toContain("run(command, installerArgs");
    expect(installer).not.toContain("shell: true");
    expect(installer).toContain("windowsHide: true");
  });
});
