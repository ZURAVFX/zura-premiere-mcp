import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempDir, cleanupTempDirs } from "./helpers/temp-dir.js";
import { getSetupBuildState } from "../scripts/setup-build-state.mjs";

afterAll(cleanupTempDirs);
describe("content-addressed setup build reuse", () => {
  it("reuses only a successful build with unchanged source, lock and Node version", async () => {
    const root = makeTempDir("zura-setup-cache-");
    for (const directory of ["src", "scripts", "dist/resources"]) mkdirSync(join(root, directory), { recursive: true });
    for (const file of ["package.json", "package-lock.json", "tsconfig.json", "src/index.ts", "scripts/build.mjs", "dist/index.js", "dist/resources/adobe-uxp-coverage.json"]) writeFileSync(join(root, file), "{}");
    const first = await getSetupBuildState(root, "24.14.0");
    expect(first.reusable).toBe(false);
    writeFileSync(join(root, ".zura-build-state.json"), JSON.stringify(first));
    expect((await getSetupBuildState(root, "24.14.0")).reusable).toBe(true);
    expect((await getSetupBuildState(root, "24.15.0")).reusable).toBe(false);
    writeFileSync(join(root, "src/index.ts"), "changed source");
    expect((await getSetupBuildState(root, "24.14.0")).reusable).toBe(false);
    writeFileSync(join(root, "src/index.ts"), "{}");
    writeFileSync(join(root, "package-lock.json"), "changed dependencies");
    expect((await getSetupBuildState(root, "24.14.0")).reusable).toBe(false);
  });
});
