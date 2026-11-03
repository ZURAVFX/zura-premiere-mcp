# Native Premiere controls: MCP 1.28.0

Verified on Windows, Premiere Pro Beta 26.1.1 with CEP, 3 November 2026. All host tests used a separate project and generated colour bars and sine tone, without client assets.

- Native Motion Position vectors: [0.5, 0.5] at clip time zero and [0.6, 0.5] at two seconds; midpoint readback [0.55, 0.5]. Vector dimension/type mismatches are refused before enabling animation.
- Native Opacity: values 20 and 80 at zero and two seconds. Linear midpoint 50, hold midpoint 20 and Bezier midpoint 41.7762. Three separate four-second H.264/AAC renders visually confirmed different interpolation. Interpolation receipts still correctly say committed_unverified because CEP has no interpolation getter.
- Removing the final key now handles Premiere's undefined key-list response only when three independent key searches also prove empty. Clear-all with disable_animation returns the stopwatch to static; partial-range requests cannot disable remaining animation.
- Lumetri: all nine Basic Correction scalar controls were set and read back. Two instances were addressed independently by component index. Ambiguous selection and static writes to animated controls were refused before mutation.
- Animated Lumetri Exposure from -1 to +1 was read back and rendered. Creative Vibrance/Sharpen and Vignette Amount/Feather were also set and read back.
- Project inspection now returns a clear no-project error instead of accessing an empty host shell. The reels pack includes open_project and close_project, alongside the previous adjustment-layer and exact effect controls.

The project was saved. Previous adjustment-layer, timeline, audio and export evidence is recorded in [the earlier audit](premiere-control-audit-2026-11-03.md).

## Limits

This is representative host verification, not every Premiere feature. Opaque Lumetri curves, wheels and LUT payloads have no verified structured setter here. The optional authenticated UXP bridge was unavailable and remains unverified. Captions were outside this follow-up scope. macOS setup is covered by orchestration tests, not a live Mac/Premiere run. No application was restarted automatically.

Automated release gate: npm run check passed, including build, catalogue/metadata checks and 297 test files (5,398 passed, seven skipped).
