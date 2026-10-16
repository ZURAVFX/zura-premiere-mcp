import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";

/** Native Premiere generator source. No linked media and no UI creation step. */
export function prepareAdjustmentTemplate(width: number, height: number, frameTicks: number) {
  if (![width, height, frameTicks].every(v => Number.isSafeInteger(v) && v > 0) || width > 32768 || height > 32768) {
    throw new Error("Cannot prepare adjustment layer: invalid sequence dimensions or timebase.");
  }
  let xml = readFileSync(new URL("../resources/adjustment-layer-template.xml", import.meta.url), "utf8");
  xml = xml.replaceAll("__WIDTH__", String(width)).replaceAll("__HEIGHT__", String(height)).replaceAll("__FRAME_TICKS__", String(frameTicks));
  // Refresh all native identities consistently, avoiding collisions on repeat import.
  const identities = new Map<string, string>();
  for (const match of xml.matchAll(/ObjectUID="([^"]+)"/g)) identities.set(match[1], randomUUID());
  const seedSequence = "465a2fe1-ddb6-4e86-95f6-868a49a7aa94";
  for (const [oldId, newId] of identities) xml = xml.replaceAll(oldId, newId);
  const directory = join(homedir(), ".codex", "zura-premiere", "native-templates");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `adjustment-${randomUUID()}.prproj`);
  writeFileSync(path, gzipSync(Buffer.from(xml, "utf8")), { flag: "wx", mode: 0o600 });
  return { path, sequenceId: identities.get(seedSequence)! };
}
