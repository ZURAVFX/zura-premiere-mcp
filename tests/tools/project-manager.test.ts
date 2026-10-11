import { beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { getHelpersSource } from "../../src/bridge/script-builder.js";
import type { BridgeOptions } from "../../src/bridge/file-bridge.js";

vi.mock("../../src/bridge/file-bridge.js", () => ({
  sendCommand: vi.fn().mockResolvedValue({ success: true, data: {} }),
  sendRawCommand: vi.fn().mockResolvedValue({ success: true, data: {} }),
  getTempDir: vi.fn().mockReturnValue("/tmp/test"),
  cleanupTempDir: vi.fn(),
}));

import { sendCommand } from "../../src/bridge/file-bridge.js";
import { getProjectManagerTools } from "../../src/tools/project-manager.js";

const mockedSendCommand = vi.mocked(sendCommand);
const tools = getProjectManagerTools({ tempDir: "/tmp/pm", timeoutMs: 5000 } as BridgeOptions);
type Result = { success: boolean; error?: string; data?: Record<string, unknown> };

beforeEach(() => vi.clearAllMocks());

/**
 * Live 25.2: only projectManager.options is honored, the destination must
 * exist, process() returns 0, and the copy lands in <dest>/Copied_<project>/.
 */
function host(options: { existing?: string[]; processStatus?: number; mediaFileCount?: number; parentMismatch?: boolean } = {}) {
  const fs = new Map<string, { dir: boolean; size: number }>();
  for (const dir of options.existing ?? []) fs.set(dir, { dir: true, size: 0 });
  class FsEntry { constructor(public path: string) {} get name() { return this.path.split("/").pop() as string; } get fsName() { return this.path; } get exists() { return fs.has(this.path); } get length() { return fs.get(this.path)?.size ?? 0; } get parent() { return new FolderEntry(options.parentMismatch && this.path.endsWith("Copied_MCP Test") ? "/unexpected" : this.path.slice(0, this.path.lastIndexOf("/")) || "/"); } }
  class FolderEntry extends FsEntry {
    create() { fs.set(this.path, { dir: true, size: 0 }); return true; }
    getFiles(mask?: string) {
      const children = [...fs.keys()].filter((p) => p.startsWith(`${this.path}/`) && !p.slice(this.path.length + 1).includes("/"));
      return children
        .filter((p) => !mask || p.endsWith(mask.replaceAll("*", "")))
        .map((p) => (fs.get(p)!.dir ? new FolderEntry(p) : new File(p)));
    }
  }
  class File extends FsEntry {}
  // ExtendScript's Folder(path) also works without new and returns a File for a file.
  const Folder = function (this: unknown, path: string) {
    if (!new.target) return fs.has(path) && !fs.get(path)!.dir ? new File(path) : new FolderEntry(path);
    return new FolderEntry(path);
  } as unknown as typeof FolderEntry;
  Folder.prototype = FolderEntry.prototype;
  const opts: Record<string, unknown> = { CLIP_TRANSFER_COPY: 0, CLIP_TRANSFER_TRANSCODE: 1, CLIP_TRANSCODE_MATCH_SEQUENCE: 2, clipTransferOption: 1, includeAllSequences: true, destinationPath: "" };
  const seen: Record<string, unknown>[] = [];
  const activeSequence = { name: "Product Spot" };
  const pm: Record<string, unknown> = {
    options: opts,
    errors: [],
    process: () => {
      seen.push({ ...opts });
      const dest = String(opts.destinationPath).replace(/\/$/, "");
      if (!fs.has(dest)) return 1;
      const out = `${dest}/Copied_MCP Test`;
      fs.set(out, { dir: true, size: 0 });
      fs.set(`${out}/MCP Test.prproj`, { dir: false, size: 1000 });
      const scoped = opts.includeAllSequences === false && Array.isArray(opts.affectedSequences);
      const mediaFiles = options.mediaFileCount === undefined
        ? (scoped ? ["clip-a.mp4"] : ["clip-a.mp4", "Interview A.mp4"])
        : Array.from({ length: options.mediaFileCount }, (_, i) => `clip-${i}.mp4`);
      for (const f of mediaFiles) fs.set(`${out}/${f}`, { dir: false, size: 500 });
      return options.processStatus ?? 0;
    },
  };
  mockedSendCommand.mockImplementation(async (script: string) =>
    JSON.parse(String(runInNewContext(`${getHelpersSource()}\n${script}`, { app: { projectManager: pm, project: { name: "MCP Test.prproj", activeSequence } }, Folder, File }))));
  return { fs, seen };
}

describe("consolidate_and_transfer", () => {
  it("requires explicit confirmation before copying any source media", async () => {
    await expect(tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer" })).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("explicitly requests a portable/self-contained project"),
    });
    await expect(tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: false })).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("confirms copying source footage"),
    });
    expect(mockedSendCommand).not.toHaveBeenCalled();
    expect((tools.consolidate_and_transfer.parameters as { required: string[] }).required).toContain("confirm_media_copy");
  });

  it("copies only the active sequence's media into Copied_<project> and lists the files", async () => {
    const { seen } = host();
    const result = await tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: true, include_all_sequences: false }) as Result;
    expect(result).toMatchObject({
      success: true,
      data: { verified: true, copiedProject: "/out/transfer/Copied_MCP Test/MCP Test.prproj", scope: "active sequence: Product Spot", transferMode: "copy", fileCount: 2, totalBytes: 1500, files: ["MCP Test.prproj", "clip-a.mp4"], filesTruncated: false },
    });
    expect(seen[0]).toMatchObject({ clipTransferOption: 0, includeAllSequences: false, destinationPath: "/out/transfer/" });
  });

  it("refuses to reuse a destination that already has this project's copy", async () => {
    host({ existing: ["/out/transfer", "/out/transfer/Copied_MCP Test"] });
    await expect(tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: true })).resolves.toMatchObject({ success: false, error: expect.stringContaining("already exists") });
  });

  it("rejects copy_to_new_location false instead of ignoring it", async () => {
    await expect(tools.consolidate_and_transfer.handler({ destination_path: "/out/x", confirm_media_copy: true, copy_to_new_location: false })).resolves.toMatchObject({ success: false });
    expect(mockedSendCommand).not.toHaveBeenCalled();
  });

  it("rejects a relative destination before contacting Premiere", async () => {
    await expect(tools.consolidate_and_transfer.handler({ destination_path: "work/output", confirm_media_copy: true })).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("absolute path explicitly requested"),
    });
    expect(mockedSendCommand).not.toHaveBeenCalled();
  });

  it("counts every output file and byte while truncating only the file-name list", async () => {
    host({ mediaFileCount: 505 });
    const result = await tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: true }) as Result;
    expect(result).toMatchObject({
      success: true,
      data: { fileCount: 506, totalBytes: 253500, filesTruncated: true, files: expect.arrayContaining(["MCP Test.prproj"]) },
    });
    expect((result.data?.files as string[]).length).toBe(500);
  });

  it("reports the exact output folder and full size when Premiere returns a failure status", async () => {
    host({ processStatus: 1 });
    const result = await tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: true }) as Result;
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("do not report packaging complete"),
      data: { outputFolder: "/out/transfer/Copied_MCP Test", fileCount: 3, totalBytes: 2000, scanComplete: true },
    });
  });

  it("fails when the output parent differs from the requested destination", async () => {
    host({ parentMismatch: true });
    const result = await tools.consolidate_and_transfer.handler({ destination_path: "/out/transfer", confirm_media_copy: true }) as Result;
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("output parent did not match"),
      data: { destination: "/out/transfer", actualDestination: "/unexpected", outputFolder: "/out/transfer/Copied_MCP Test" },
    });
  });
});
