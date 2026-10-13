import { beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { parse } from "acorn";
import { getHelpersSource } from "../../src/bridge/script-builder.js";

vi.mock("../../src/bridge/file-bridge.js", () => ({ sendCommand: vi.fn(), sendRawCommand: vi.fn(), getTempDir: () => "/tmp/test", cleanupTempDir: vi.fn() }));
import { sendCommand } from "../../src/bridge/file-bridge.js";
import { getTrackTargetingTools } from "../../src/tools/track-targeting.js";
const send = vi.mocked(sendCommand);
const tool = getTrackTargetingTools({ tempDir: "/tmp/test" }).set_static_clip_framing_batch;
beforeEach(() => vi.clearAllMocks());

function host({ animated = false, autoReframe = false, blockedSecond = false } = {}) {
  const states = [0, 1].map(() => ({ Position: [0.5, 0.5], Scale: 100, "Scale Width": 100, "Uniform Scale": false }));
  const clips = states.map((values, index) => {
    const properties = Object.keys(values).map((displayName) => ({ displayName, getValue: () => values[displayName], isTimeVarying: () => animated && index === 1, setValue: (value: unknown) => { if (!(blockedSecond && index === 1 && displayName === "Position")) values[displayName] = value; } }));
    const motion = { displayName: "Motion", properties: { numItems: properties.length, ...properties } };
    return { nodeId: `c${index + 1}`, name: "Speaker", components: { numItems: autoReframe && index === 1 ? 2 : 1, 0: motion, 1: { displayName: "Auto Reframe", matchName: "ADBE AutoReframe" } } };
  });
  const seq = { sequenceID: "seq-1", frameSizeHorizontal: 1080, frameSizeVertical: 1920, videoTracks: { numTracks: 1, 0: { clips: { numItems: clips.length, ...clips } } }, audioTracks: { numTracks: 0 } };
  send.mockImplementation(async (script) => JSON.parse(String(runInNewContext(`${getHelpersSource()}\n${script}`, { app: { project: { activeSequence: seq } } }))));
  return states;
}
const entries = [{ node_id: "c1", scale: 180, x: 648, y: 960 }, { node_id: "c2", scale: 210, x: 432, y: 960 }];

describe("one-command static framing", () => {
  it("applies and verifies both axes and normalized Position for multiple clips in one call", async () => {
    const states = host();
    const result = await tool.handler({ sequence_id: "seq-1", clips: entries });
    expect(result).toMatchObject({ success: true, data: { verified: true, verifiedClips: [{ node_id: "c1", static: true }, { node_id: "c2", static: true }] } });
    expect(states[0]).toMatchObject({ Position: [0.6, 0.5], Scale: 180, "Scale Width": 180 });
    expect(states[1]).toMatchObject({ Position: [0.4, 0.5], Scale: 210, "Scale Width": 210 });
    expect(send).toHaveBeenCalledTimes(1);
    // Acorn's default permits reserved object keys, unlike the live Adobe ES3
    // engine. An unquoted `static` receipt key caused EvalScript error before
    // any writes, despite passing the old syntax gate and Node host mocks.
    parse(String(send.mock.calls[0][0]), { ecmaVersion: 3, allowReserved: "never" });
  });
  it.each([{ animated: true }, { autoReframe: true }])("preflights every clip before changing any when %j", async (options) => {
    const states = host(options);
    expect(await tool.handler({ sequence_id: "seq-1", clips: entries })).toMatchObject({ success: false });
    expect(states[0]).toMatchObject({ Position: [0.5, 0.5], Scale: 100 });
  });
  it("refuses stale sequence or clip IDs before writing", async () => {
    const states = host();
    expect(await tool.handler({ sequence_id: "other", clips: entries })).toMatchObject({ success: false });
    expect(await tool.handler({ sequence_id: "seq-1", clips: [entries[0], { ...entries[1], node_id: "missing" }] })).toMatchObject({ success: false });
    expect(states[0].Scale).toBe(100);
  });
  it("reports a verified prefix and unknown failed write instead of pretending the batch was atomic", async () => {
    host({ blockedSecond: true });
    expect(await tool.handler({ sequence_id: "seq-1", clips: entries })).toMatchObject({ success: false, data: { verified: false, failedNodeId: "c2", outcome: "committed_unverified", verifiedClips: [{ node_id: "c1" }] } });
  });
  it("rejects nonfinite inputs, empty batches and duplicate IDs without contacting Premiere", async () => {
    for (const clips of [[], [entries[0], entries[0]], [{ ...entries[0], scale: NaN }], [{ ...entries[0], x: Infinity }]]) expect(await tool.handler({ sequence_id: "seq-1", clips })).toMatchObject({ success: false });
    expect(send).not.toHaveBeenCalled();
  });
  it("escapes script-like clip IDs as data", async () => {
    host();
    expect(await tool.handler({ sequence_id: "seq-1", clips: [{ ...entries[0], node_id: 'c1";throw new Error("injected");//' }] })).toMatchObject({ success: false, error: expect.stringContaining("Video clip not found") });
  });
});
