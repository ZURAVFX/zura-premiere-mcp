import type { FrameSize } from "./speaker-layout.js";

type Region = { x: number; y: number; width: number; height: number };
const finite = (value: unknown, label: string, minimum: number, maximum: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  return value;
};
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
};
const frame = (value: unknown, label: string): FrameSize => {
  const input = record(value, label);
  return { width: finite(input.width, `${label}.width`, 16, 16384), height: finite(input.height, `${label}.height`, 16, 16384) };
};
const round = (value: number) => Number(value.toFixed(6));

/** Plan static Motion values from measured shot regions; never detect or track faces. */
export function planCenteredShotFraming(args: Record<string, unknown>) {
  const source = frame(args.source_frame, "source_frame");
  const target = frame(args.target_frame ?? { width: 1080, height: 1920 }, "target_frame");
  const padding = finite(args.padding ?? 0.12, "padding", 0, 0.4);
  const prescale = finite(args.source_prescale ?? 1, "source_prescale", 0.001, 1000);
  const anchorInput = record(args.anchor ?? { x: 0.5, y: 0.5 }, "anchor");
  const anchor = { x: finite(anchorInput.x, "anchor.x", 0, 1), y: finite(anchorInput.y, "anchor.y", 0, 1) };
  if (!Array.isArray(args.shots) || args.shots.length < 1 || args.shots.length > 100) throw new Error("shots must contain 1 through 100 measured shot regions.");
  const ids = new Set<string>();
  const shots = args.shots.map((value, index) => {
    const shot = record(value, `shots[${index}]`);
    if (typeof shot.shot_id !== "string" || !shot.shot_id.trim() || shot.shot_id.length > 128 || ids.has(shot.shot_id)) throw new Error("Each shot_id must be nonempty and unique (at most 128 characters).");
    ids.add(shot.shot_id);
    const input = record(shot.subject, "subject");
    const subject: Region = { x: finite(input.x, "subject.x", 0, 1), y: finite(input.y, "subject.y", 0, 1), width: finite(input.width, "subject.width", 0.000001, 1), height: finite(input.height, "subject.height", 0.000001, 1) };
    if (subject.x + subject.width > 1 + 1e-9 || subject.y + subject.height > 1 + 1e-9) throw new Error("Subject region must be inside the source frame.");
    const cx = (subject.x + subject.width / 2) * source.width;
    const cy = (subject.y + subject.height / 2) * source.height;
    const aspect = target.width / target.height;
    const desiredHeight = Math.max(subject.height * source.height, subject.width * source.width / aspect) / (1 - 2 * padding);
    // Shrink a centered crop at source edges instead of shifting its center.
    const maximumHeight = Math.min(2 * cx / aspect, 2 * (source.width - cx) / aspect, 2 * cy, 2 * (source.height - cy));
    const height = Math.min(desiredHeight, maximumHeight);
    const width = height * aspect;
    const scale = target.height / height;
    const position = { x: target.width / 2 - (cx - anchor.x * source.width) * scale, y: target.height / 2 - (cy - anchor.y * source.height) * scale };
    const fits = subject.width * source.width <= width + 1e-6 && subject.height * source.height <= height + 1e-6;
    const scalePercent = round(scale / prescale * 100);
    const supportedScale = scalePercent > 0 && scalePercent <= 10000;
    const warnings = [];
    if (!fits) warnings.push("This source cannot keep the entire measured region centered while filling the target. Choose a tighter face/upper-body region, another shot, or ask for a different layout; do not silently offset the subject.");
    if (!supportedScale) warnings.push("This crop exceeds the supported Motion Scale range. Verify the region and source prescale, or choose another shot; do not apply this plan.");
    return {
      shot_id: shot.shot_id,
      subject,
      crop_source_px: { left: round(cx - width / 2), top: round(cy - height / 2), width: round(width), height: round(height) },
      scale_percent: scalePercent,
      position_pixels: { x: round(position.x), y: round(position.y) },
      position_normalized: { x: round(position.x / target.width), y: round(position.y / target.height) },
      subject_center_normalized: { x: 0.5, y: 0.5 },
      region_fits: fits,
      requires_review: !fits || !supportedScale,
      warnings,
    };
  });
  return {
    plan: "centered_shot_framing", applied: false, source_frame: source, target_frame: target, source_prescale: prescale, anchor,
    shots, requires_review: shots.some((shot) => shot.requires_review),
    verification_scope: "Geometry from caller-measured regions only. No source pixels, host Motion state, or rendered frames were inspected.",
    apply_route: ["set_static_clip_framing_batch", "capture_frame"],
    instructions: "Use one static crop per real source shot. Pass position_pixels and scale_percent to set_static_clip_framing_batch, which converts host units. Resolve requires_review before applying. Verify source dimensions, square pixels, anchor and prescale first; inspect rendered start/middle/end and shot boundaries. No Auto Reframe or speaker-switch keyframes.",
  };
}
