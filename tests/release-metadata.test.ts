import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKFLOW_CATALOG } from "../src/workflows/catalog.js";


const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const readJson = (path: string) => JSON.parse(read(path));

describe("canonical release metadata", () => {
  const release = readJson("release-metadata.json");

  it("aligns every distributable manifest with the canonical version", () => {
    expect(readJson("package.json").version).toBe(release.version);
    const packageLock = readJson("package-lock.json");
    expect(packageLock.version).toBe(release.version);
    expect(packageLock.packages[""].version).toBe(release.version);
    expect(readJson("claude-desktop/manifest.json").version).toBe(release.version);
    expect(readJson("uxp-plugin/manifest.json").version).toBe(release.version);
    expect(readJson("registry/server.json").version).toBe(release.version);

    const cepManifest = read("cep-plugin/CSXS/manifest.xml");
    expect(cepManifest).toContain(`ExtensionBundleVersion="${release.version}"`);
    expect(cepManifest).toContain(`Version="${release.version}"`);
    expect(read("cep-plugin/index.html")).toContain("Zura Premiere MCP");
    expect(read("cep-plugin/index.html")).not.toContain("updater.cjs");
  });

  it("aligns README release and capability claims", () => {
    const readme = read("README.md");
    const supportedActions = read("docs/supported-actions.md");
    expect(readme).toContain("release-metadata.json");
    expect(readme).toContain("public-product-manifest.json");
    expect(readme).toContain("not an npm publication");
    expect(readme).toContain("node INSTALL-ZURA-PREMIERE-MCP.mjs");
    expect(supportedActions).toContain(
      `| Registered core actions | ${release.coreTools} |`,
    );
    expect(supportedActions).toContain(
      `| Default-profile core actions | ${release.defaultProfileTools} |`,
    );
    expect(supportedActions).toContain(
      `| Authenticated UXP additions | ${release.uxpAdditionalTools} |`,
    );
    expect(supportedActions).toContain(
      `| Default profile with UXP | ${release.defaultProfileWithUxpTools} |`,
    );
  });

  it("keeps computed tool-count relationships explicit", () => {
    expect(release.defaultProfileTools + release.uxpAdditionalTools).toBe(
      release.defaultProfileWithUxpTools,
    );
    expect(release.coreTools - release.defaultProfileTools).toBe(2);
    expect(release.guidedWorkflows).toBe(WORKFLOW_CATALOG.length);
  });

  it("keeps the CLI product identity and source update route aligned", () => {
    expect(read("src/index.ts")).toContain("zura-premiere-mcp");
    expect(read("src/index.ts")).toContain("node INSTALL-ZURA-PREMIERE-MCP.mjs");
    expect(read("src/index.ts")).not.toContain("npx -y premiere-pro-mcp");
  });

  it("keeps the generated public product manifest aligned with current release metadata", () => {
    const manifest = readJson("public-product-manifest.json");
    expect(manifest.schemaVersion).toBe("zura-premiere-mcp.public-product.v1");
    expect(manifest.product.version).toBe(release.version);
    expect(manifest.product.mcpName).toBe(readJson("package.json").mcpName);
    expect(manifest.capabilitySurface).toMatchObject({
      registeredCoreTools: release.coreTools,
      defaultProfileTools: release.defaultProfileTools,
      authenticatedUxpAdditions: release.uxpAdditionalTools,
      defaultProfileWithUxp: release.defaultProfileWithUxpTools,
      guidedWorkflows: release.guidedWorkflows,
    });
    expect(manifest.proofKit.status).toBe("runbook_and_redacted_template_only");
    expect(manifest.proofKit.video).toBeNull();
    expect(manifest.workflows.map((workflow: { id: string }) => workflow.id)).toEqual([
      "safe-project-intake",
      "transcript-backed-rough-cut",
      "caption-review",
      "verified-delivery",
    ]);
  });
});
