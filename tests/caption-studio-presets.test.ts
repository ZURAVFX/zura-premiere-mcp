import { afterAll, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTempDir, cleanupTempDirs } from "./helpers/temp-dir.js";
import { parsePresetCatalogue, resolvePresetName, settingsDigest, fetchPresetCatalogue, runPresetCli } from "../scripts/caption-studio-presets.mjs";
afterAll(cleanupTempDirs);

const source = `const defaults={shadowEnabled:true,maxLineDuration:3,speaker2HighlightColour:"green",extraSetting:"keep"};
function normalize(values={}) {const duration=Number.isFinite(values.maxLineDuration)?Number(values.maxLineDuration):defaults.maxLineDuration;return {...defaults,...values,speaker2HighlightColour:values.speaker2HighlightColour||defaults.speaker2HighlightColour,maxLineDuration:Math.max(.1,duration)};}
const presets={V4V_EM_v4:normalize({width:1080,height:1920,fps:24,fontFamily:"Neue Haas",fontSize:62}),"C4 Thomas Ramos Subs":normalize({width:1080,height:1920,fps:24,fontFamily:"GT America",fontSize:48})};`;

describe("Caption Studio preset resolution", () => {
  it("reads quoted names and full normalized settings without executing the bundle", () => {
    const presets = parsePresetCatalogue(`${source}\nthrow new Error("must never execute");`);
    expect(Object.keys(presets)).toEqual(["V4V_EM_v4", "C4 Thomas Ramos Subs"]);
    expect(presets.V4V_EM_v4).toMatchObject({ shadowEnabled: true, extraSetting: "keep", maxLineDuration: 3, fontSize: 62 });
  });
  it.each(["V4V", "v4v sub", "V4V subs", "V4V subtitles", "v4v em v4"])("resolves %s to the exact available preset", (request) => {
    expect(resolvePresetName(request, ["OA_bouncy_final_2", "V4V_EM_v4"])).toBe("V4V_EM_v4");
  });
  it("refuses missing presets and ambiguous V4V variants instead of substituting", () => {
    expect(() => resolvePresetName("V4V subs", ["OA_bouncy_final_2"])).toThrow(/No substitute/);
    expect(() => resolvePresetName("V4V", ["V4V_EM_v4", "V4V_EM_v5"])).toThrow(/ambiguous/);
    expect(resolvePresetName("V4V_EM_v4", ["V4V_EM_v4", "V4V_EM_v5"])).toBe("V4V_EM_v4");
  });
  it("rejects unsupported executable settings and unsafe object keys", () => {
    expect(() => parsePresetCatalogue(source.replace('fontSize:62', 'fontSize:fetch("https://example.com")'))).toThrow(/normalizer/);
    expect(() => parsePresetCatalogue(source.replace('fontSize:62', 'fontSize:62,"__proto__":{}'))).toThrow(/Unsafe/);
  });
  it("fingerprints all settings independent of key order", () => {
    expect(settingsDigest({ font: "A", colour: "red" })).toBe(settingsDigest({ colour: "red", font: "A" }));
    expect(settingsDigest({ font: "A" })).not.toBe(settingsDigest({ font: "B" }));
  });
  it("fetches assets once and retains the complete live catalogue", async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => { urls.push(url); return { ok: true, headers: new Headers(), text: async () => urls.length === 1 ? '<script type="module" src="/assets/index.js?v=1"></script>' : source }; };
    const result = await fetchPresetCatalogue(fetcher);
    expect(urls).toHaveLength(2);
    expect(Object.keys(result.presets)).toHaveLength(2);
    expect(result.presets.V4V_EM_v4.extraSetting).toBe("keep");
  });
  it("verifies every reel offline against one saved selection and rejects a wrong preset or font", async () => {
    const root = makeTempDir("zura-caption-selection-");
    const selectionPath = join(root, "selection.json");
    const projectPath = join(root, "reel.oa-caption-project.json");
    const settings = parsePresetCatalogue(source).V4V_EM_v4;
    writeFileSync(selectionPath, JSON.stringify({ selectedPreset: "V4V_EM_v4", settings, settings_sha256: settingsDigest(settings) }));
    const project = { format: "oa-caption-project", selectedPreset: "V4V_EM_v4", settings };
    writeFileSync(projectPath, JSON.stringify(project));
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not fetch"));
    try {
      expect(await runPresetCli(["--selection", selectionPath, "--verify-project", projectPath])).toMatchObject({ project_verified: true });
      expect(network).not.toHaveBeenCalled();
      writeFileSync(projectPath, JSON.stringify({ ...project, selectedPreset: "OA_bouncy_final_2" }));
      await expect(runPresetCli(["--selection", selectionPath, "--verify-project", projectPath])).rejects.toThrow(/differ/);
      writeFileSync(projectPath, JSON.stringify({ ...project, settings: { ...settings, fontFamily: "Wrong font" } }));
      await expect(runPresetCli(["--selection", selectionPath, "--verify-project", projectPath])).rejects.toThrow(/differ/);
    } finally { stdout.mockRestore(); network.mockRestore(); }
  });
});
