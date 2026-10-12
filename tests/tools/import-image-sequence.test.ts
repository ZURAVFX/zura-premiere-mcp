import { beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { getHelpersSource } from "../../src/bridge/script-builder.js";
import { runWithExpectedProject } from "../../src/bridge/project-guard.js";
import { getTrackTargetingTools } from "../../src/tools/track-targeting.js";

vi.mock("../../src/bridge/file-bridge.js", () => ({ sendCommand: vi.fn() }));
import { sendCommand } from "../../src/bridge/file-bridge.js";

const send = vi.mocked(sendCommand);
const tools = getTrackTargetingTools({ tempDir: "/tmp/import-image-sequence", timeoutMs: 5000 });
const firstFrame = "/captions/reel_001/frame_000001.png";
type Result = { success: boolean; error?: string; data?: Record<string, any> };
type Item = { nodeId?: string; name: string; getMediaPath?: () => string; getFootageInterpretation?: () => { frameRate: number }; setOverrideFrameRate?: (rate: number) => void };

function children(items: Item[]) {
  return Object.assign(items, { numItems: items.length });
}

function host(options: { extraImports?: number; unreadableRate?: boolean; missingNodeId?: boolean; importResult?: boolean } = {}) {
  const items: Item[] = [{ nodeId: "old", name: "frame_000001.png", getMediaPath: () => "/other/frame_000001.png" }];
  const root = { name: "Root", nodeId: "root", children: children(items) };
  let importCalls = 0;
  let overrideCalls = 0;
  let observedRate = 25;
  const project = {
    path: "/project/Five Reels.prproj", rootItem: root,
    importFiles(paths: string[], _suppress: boolean, destination: typeof root, asSequence: boolean) {
      importCalls++;
      expect(paths).toEqual([firstFrame]);
      expect(destination).toBe(root);
      expect(asSequence).toBe(true);
      const count = 1 + (options.extraImports ?? 0);
      for (let index = 0; index < count; index++) {
        items.push({
          nodeId: options.missingNodeId ? undefined : `new-${index + 1}`,
          name: `Caption ${index + 1}`,
          getMediaPath: () => firstFrame,
          setOverrideFrameRate: (rate: number) => { overrideCalls++; observedRate = rate; },
          getFootageInterpretation: () => {
            if (options.unreadableRate) throw new Error("Premiere readback failed");
            return { frameRate: observedRate };
          },
        });
      }
      root.children = children(items);
      return options.importResult ?? true;
    },
  };
  function File(this: { fsName: string; exists: boolean }, path: string) { this.fsName = path; this.exists = true; }
  send.mockImplementation(async (script: string) => JSON.parse(String(runInNewContext(`${getHelpersSource()}\n${script}`, { app: { project }, File, $: { os: "Macintosh" } }))));
  return { get importCalls() { return importCalls; }, get overrideCalls() { return overrideCalls; }, items };
}

async function run(args: Record<string, unknown>): Promise<Result> {
  return tools.import_image_sequence.handler(args as { first_file_path: string; frame_rate?: number; target_bin?: string }) as Promise<Result>;
}

beforeEach(() => vi.clearAllMocks());

describe("import_image_sequence caption overlay timing", () => {
  it("keeps the original no-frame-rate call working without touching interpretation", async () => {
    const state = host();
    expect(await run({ first_file_path: firstFrame })).toMatchObject({ success: true, data: { imported: true, verified: true, projectItem: { nodeId: "new-1" } } });
    expect(state.overrideCalls).toBe(0);
  });

  it("resolves the newly imported node ID, applies 24 fps, and reuses it without a second import", async () => {
    const state = host();
    const first = await run({ first_file_path: firstFrame, frame_rate: 24 });
    expect(first).toMatchObject({ success: true, data: { imported: true, reused: false, frameRate: 24, verified: true, outcome: "verified", projectItem: { nodeId: "new-1" } } });
    expect(state.overrideCalls).toBe(1);
    expect(await run({ first_file_path: firstFrame, frame_rate: 24 })).toMatchObject({ success: true, data: { imported: false, reused: true, frameRate: 24, projectItem: { nodeId: "new-1" } } });
    expect(state.importCalls).toBe(1);
    expect(state.overrideCalls).toBe(1);
  });

  it("returns a committed_unverified receipt for ambiguous imports and refuses a duplicate on retry", async () => {
    const state = host({ extraImports: 1 });
    const result = await run({ first_file_path: firstFrame, frame_rate: 24 });
    expect(result).toMatchObject({ success: false, data: { outcome: "committed_unverified", verified: false, matchingItemCount: 2, candidateNodeIds: ["new-1", "new-2"], projectItem: null, retryImport: false } });
    expect(state.overrideCalls).toBe(0);
    expect(await run({ first_file_path: firstFrame, frame_rate: 24 })).toMatchObject({ success: false, data: { importAttempted: false } });
    expect(state.importCalls).toBe(1);
  });

  it("validates frame rates before invoking the bridge", async () => {
    for (const frameRate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "24"]) {
      expect(await run({ first_file_path: firstFrame, frame_rate: frameRate })).toMatchObject({ success: false, error: "frame_rate must be a positive number." });
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a missing requested bin before importing into the wrong place", async () => {
    const state = host();
    expect(await run({ first_file_path: firstFrame, target_bin: "Captions" })).toMatchObject({ success: false, error: expect.stringContaining("Target bin not found") });
    expect(state.importCalls).toBe(0);
  });

  it("keeps a newly imported item identifiable when interpretation readback fails, without reimporting", async () => {
    const state = host({ unreadableRate: true });
    const result = await run({ first_file_path: firstFrame, frame_rate: 24 });
    expect(result).toMatchObject({ success: false, data: { outcome: "committed_unverified", verified: false, imported: true, frameRate: null, requestedFrameRate: 24, projectItem: { nodeId: "new-1" }, retryImport: false } });
    expect(await run({ first_file_path: firstFrame, frame_rate: 24 })).toMatchObject({ success: false, data: { reused: true, projectItem: { nodeId: "new-1" } } });
    expect(state.importCalls).toBe(1);
  });

  it("does not certify a new project item without a readable node ID", async () => {
    const state = host({ missingNodeId: true });
    expect(await run({ first_file_path: firstFrame })).toMatchObject({ success: false, data: { outcome: "committed_unverified", projectItem: null, retryImport: false } });
    expect(state.importCalls).toBe(1);
  });

  it("preserves the global expected_project_path guard before any import", async () => {
    const state = host();
    expect(await runWithExpectedProject("/other/project.prproj", () => run({ first_file_path: firstFrame, frame_rate: 24 }))).toMatchObject({ success: false, error: expect.stringContaining("active project differs") });
    expect(state.importCalls).toBe(0);
  });
});
