# Premiere control validation: 1.27.0

Tested on Windows with the running Premiere 2026 CEP connector, 3 November 2026. Tests used a separate project copy and generated colour bars and a sine tone. No client media is included.

## Automated checks

`npm run check`: 296 test files passed; 5,383 tests passed, seven skipped. This includes build, metadata/catalogue checks and regression coverage for exact effect-instance selection, adjustment-layer placement/readback and Windows still-frame paths.

## Live evidence

- Created a native 1080p25 sequence, imported generated H.264/AAC media and inserted video/audio.
- Created a real adjustment layer from the bundled native template, then reused its exact source on another video track. Verified type, placement, duration and identities. Occupied placement was refused.
- Applied two Gaussian Blur instances. Exact component indices controlled them independently; ambiguous names and mismatched indices were refused.
- Edited Motion Scale and blur Amount with property readback. Captured sharp and blurred frames and visually checked the difference.
- Added blur keyframes at clip times zero and two seconds; sampled the midpoint at 20 between values zero and 40. A rendered H.264 movie visibly changed blur over time.
- Removed one keyframe and one effect instance with readback.
- Exported a four-second 1920x1080, 25 fps H.264/AAC movie; ffprobe confirmed streams and duration. Compared rendered audio at zero and minus 12 dB: measured mean and peak both decreased exactly 12 dB.
- Duplicated a sequence, trimmed linked video/audio, split both at two seconds, added a video track, created/read a marker and saved the test project.
- Exported a still frame using a Windows forward-slash path after fixing native path conversion.

## Boundaries and remaining gaps

This is representative end-to-end verification, not a claim that every Premiere operation or every installed third-party effect works.

- UXP was not connected. UXP-only operations remain unverified on this machine.
- Removing the last keyframe produced an unreadable host key-list receipt and correctly reported committed_unverified. A later read returned an empty list. Do not repeat mutations blindly.
- Interpolation writes have no native interpolation getter in this CEP route. The tool reports committed_unverified; sampled values and rendered animation provide narrower evidence.
- Premiere accepted native caption-track creation, but CEP could not read caption structure. The captured frame did not visibly show the test caption. Native caption display is not validated by this run; use the established rendered-caption workflow or investigate with UXP/UI.
- Legacy QE adjustment-layer creation, other operating systems, third-party effects, model-based matting and every export preset were not live-tested in this run.

The compact reels pack exposes the tested effect/keyframe tools without enabling arbitrary scripting. Existing host-specific limitations remain explicit in receipts.
