import { describe, expect, it } from "vitest";
import { planCenteredShotFraming } from "../../src/ai/shot-framing.js";

const source = { width: 1920, height: 1080 };
const plan = (subject: { x: number; y: number; width: number; height: number }, extra = {}) => planCenteredShotFraming({ source_frame: source, shots: [{ shot_id: "shot-1", subject }], ...extra });

describe("centered static shot framing", () => {
  it.each([0.04, 0.25, 0.7, 0.86])("centers a subject at source x=%s without introducing black edges", (x) => {
    const result = plan({ x, y: 0.25, width: 0.08, height: 0.35 });
    const shot = result.shots[0];
    const scale = shot.scale_percent / 100;
    const subjectCenter = { x: (x + 0.04) * 1920, y: (0.25 + 0.175) * 1080 };
    expect(shot.position_pixels.x + (subjectCenter.x - 960) * scale).toBeCloseTo(540, 3);
    expect(shot.position_pixels.y + (subjectCenter.y - 540) * scale).toBeCloseTo(960, 3);
    expect(shot.crop_source_px.left).toBeGreaterThanOrEqual(-1e-6);
    expect(shot.crop_source_px.top).toBeGreaterThanOrEqual(-1e-6);
    expect(shot.crop_source_px.left + shot.crop_source_px.width).toBeLessThanOrEqual(1920.000001);
    expect(shot.crop_source_px.top + shot.crop_source_px.height).toBeLessThanOrEqual(1080.000001);
    expect(result).not.toHaveProperty("keyframes");
  });

  it("accounts for a verified source prescale and nondefault anchor", () => {
    const subject = { x: 0.6, y: 0.2, width: 0.1, height: 0.4 };
    const shot = plan(subject, { source_prescale: 0.5, anchor: { x: 0.25, y: 0.25 } }).shots[0];
    expect(shot.position_pixels.x + (0.65 - 0.25) * 1920 * shot.scale_percent / 100 * 0.5).toBeCloseTo(540, 3);
    expect(shot.position_normalized.x).toBeCloseTo(shot.position_pixels.x / 1080, 6);
  });

  it("flags impossible full-region fits instead of accepting an offset crop", () => {
    const result = plan({ x: 0, y: 0, width: 0.8, height: 1 });
    expect(result.requires_review).toBe(true);
    expect(result.shots[0]).toMatchObject({ region_fits: false, subject_center_normalized: { x: 0.5, y: 0.5 } });
    expect(result.shots[0].warnings[0]).toContain("do not silently offset");
  });

  it("rejects invalid dimensions, regions and duplicate shot IDs", () => {
    const subject = { x: 0.4, y: 0.2, width: 0.1, height: 0.4 };
    expect(() => plan(subject, { source_frame: { width: 0, height: 1080 } })).toThrow();
    expect(() => plan({ ...subject, x: 0.95 })).toThrow(/inside/);
    expect(() => plan(subject, { shots: [{ shot_id: "same", subject }, { shot_id: "same", subject }] })).toThrow(/unique/);
    expect(() => plan(subject, { shots: [] })).toThrow(/1 through 100/);
    expect(() => plan(subject, { padding: 0.5 })).toThrow(/padding/);
  });

  it("requires review when source prescale would exceed the batch setter's scale limit", () => {
    const result = plan({ x: 0.4, y: 0.2, width: 0.1, height: 0.4 }, { source_prescale: 0.001 });
    expect(result.shots[0].region_fits).toBe(true);
    expect(result.shots[0].scale_percent).toBeGreaterThan(10000);
    expect(result.requires_review).toBe(true);
    expect(result.shots[0].warnings.join(" ")).toContain("do not apply");
    expect(result.apply_route).toEqual(["set_static_clip_framing_batch", "capture_frame"]);
  });
});
