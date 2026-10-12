import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("node:fs", () => fsMock);

const originalEnv = { ...process.env };
const winBase = "C:\\Program Files\\Adobe";
const winRoot = join(winBase, "Adobe Premiere Pro 2026", "Settings", "SequencePresets");
const hdDir = join(winRoot, "HD");
const hd24 = join(hdDir, "HD 1080p 24.sqpreset");
const hd25 = join(hdDir, "HD 1080p 25.sqpreset");
const unreadable = join(hdDir, "Unknown.sqpreset");
const macBase = "/Applications";
const macAppDir = join(macBase, "Adobe Premiere Pro 2026");
const macRoot = join(macAppDir, "Adobe Premiere Pro.app", "Contents", "Settings", "SequencePresets");
const mac24 = join(macRoot, "Vertical 24.sqpreset");

let directories: Map<string, string[]>;
let files: Map<string, string>;

const xml = (ticks: number, width: number, height: number) =>
  `<PremiereData><VideoFrameRate>${ticks}</VideoFrameRate><VideoFrameSize>0,0,${width},${height}</VideoFrameSize></PremiereData>`;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.PREMIERE_DEFAULT_SEQUENCE_PRESET;
  directories = new Map([
    [winBase, ["Other Adobe App", "Adobe Premiere Pro 2024", "Adobe Premiere Pro 2026"]],
    [winRoot, ["HD"]],
    [hdDir, ["HD 1080p 24.sqpreset", "HD 1080p 25.sqpreset", "Unknown.sqpreset"]],
    [macBase, ["Adobe Premiere Pro 2026"]],
    [macAppDir, ["Adobe Premiere Pro.app"]],
    [macRoot, ["Vertical 24.sqpreset"]],
  ]);
  files = new Map([
    [hd24, xml(10584000000, 1920, 1080)],
    [hd25, xml(10160640000, 1920, 1080)],
    [unreadable, "not a Premiere XML preset"],
    [mac24, xml(10584000000, 1080, 1920)],
  ]);
  fsMock.readdirSync.mockImplementation((path: string) => {
    if (!directories.has(path)) throw new Error("missing directory");
    return directories.get(path);
  });
  fsMock.lstatSync.mockImplementation((path: string) => {
    if (directories.has(path)) return { isDirectory: () => true, isFile: () => false, size: 0 };
    if (files.has(path)) return { isDirectory: () => false, isFile: () => true, size: files.get(path)!.length };
    throw new Error("missing path");
  });
  fsMock.readFileSync.mockImplementation((path: string) => files.get(path));
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("get_sequence_presets", () => {
  it("returns a bounded, paged list with real FPS and dimensions parsed from local presets", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const { getSequenceTools } = await import("../../src/tools/sequence.js");
    const tool = getSequenceTools({} as never).get_sequence_presets;
    const result = await tool.handler({ fps: 24, query: "1080p", limit: 1, offset: 0 });
    expect(result).toMatchObject({
      success: true,
      data: {
        count: 1, total: 1, offset: 0,
        presets: [{ name: "HD 1080p 24", path: hd24, category: "HD", fps: 24, width: 1920, height: 1080, source: "installation" }],
        scan: { filesScanned: 3, truncated: false },
      },
    });
    expect((await tool.handler({ fps: 24, offset: 1 })).data).toMatchObject({ count: 0, total: 1, presets: [] });
  });

  it("finds macOS application bundle presets and reports missing metadata honestly", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const { getSequenceTools } = await import("../../src/tools/sequence.js");
    const result = await getSequenceTools({} as never).get_sequence_presets.handler({});
    expect(result).toMatchObject({
      success: true,
      data: { total: 1, presets: [{ path: mac24, fps: 24, width: 1080, height: 1920 }] },
    });

    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const winResult = await getSequenceTools({} as never).get_sequence_presets.handler({});
    expect(winResult).toMatchObject({
      success: true,
      data: { presets: expect.arrayContaining([{ name: "Unknown", path: unreadable, category: "HD", source: "installation", fps: null, width: null, height: null }]) },
    });
  });

  it("includes an explicit override, tolerates missing installations, and rejects unbounded requests", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    process.env.PREMIERE_DEFAULT_SEQUENCE_PRESET = hd24;
    directories.delete(winRoot);
    const { getSequenceTools } = await import("../../src/tools/sequence.js");
    const tool = getSequenceTools({} as never).get_sequence_presets;
    expect(await tool.handler({})).toMatchObject({ success: true, data: { total: 1, presets: [{ path: hd24, source: "override" }] } });
    expect(await tool.handler({ limit: 101 })).toMatchObject({ success: false, error: expect.stringContaining("limit") });
    expect(await tool.handler({ offset: -1 })).toMatchObject({ success: false, error: expect.stringContaining("offset") });
    expect(await tool.handler({ fps: -1 })).toMatchObject({ success: false, error: expect.stringContaining("fps") });
    expect(await tool.handler({ query: "x".repeat(101) })).toMatchObject({ success: false, error: expect.stringContaining("query") });
  });

  it("keeps exact 24 fps separate from 23.976 fps", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const film = join(hdDir, "HD 1080p 23.976.sqpreset");
    directories.get(hdDir)!.push("HD 1080p 23.976.sqpreset");
    files.set(film, xml(10594584000, 1920, 1080));
    const { getSequenceTools } = await import("../../src/tools/sequence.js");
    const tool = getSequenceTools({} as never).get_sequence_presets;
    expect(await tool.handler({ fps: 24 })).toMatchObject({ success: true, data: { total: 1, presets: [{ path: hd24 }] } });
    expect(await tool.handler({ fps: 23.976 })).toMatchObject({ success: true, data: { total: 1, presets: [{ path: film }] } });
  });

  it("stops at the global file cap and discloses truncation", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const names = Array.from({ length: 2100 }, (_, i) => `Preset ${String(i).padStart(4, "0")}.sqpreset`);
    directories.set(winRoot, names);
    for (const name of names) files.set(join(winRoot, name), xml(10584000000, 1920, 1080));
    const { getSequenceTools } = await import("../../src/tools/sequence.js");
    const result = await getSequenceTools({} as never).get_sequence_presets.handler({ limit: 2 });
    expect(result).toMatchObject({
      success: true,
      data: { count: 2, total: 2048, scan: { filesScanned: 2048, truncated: true } },
    });
  });
});
