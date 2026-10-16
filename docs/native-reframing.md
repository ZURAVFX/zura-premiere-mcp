# Native reframing: decision and workflow

## Decision, 16 October 2026

Use Premiere's existing Auto Reframe / Slower Motion for requested smooth tracking after a representative pilot. Do not ship a separate tracking panel. Keep static shot framing as the default. The MCP connection panel remains required for CEP control and is installed by the existing single-prompt Reels setup. Native tracking requires no additional model, Python environment or extension.

A real 15.04-second, 1080 x 1920, 25 fps talking-head passage was exported through Premiere using native Slower Motion and a local custom dead-zone tracker. Crop transforms were measured from matching source/render features at 76 sample times. Approximate values include pixel-registration noise:

| Metric | Native Slower Motion | Custom tracker |
| --- | ---: | ---: |
| Horizontal crop travel range | 22.4 px | 106.9 px |
| Peak measured crop speed | 16.5 px/s | 27.1 px/s |
| Final three seconds mean absolute face-centre error | 12.4 px | 25.7 px |
| Peak absolute face-centre error | 67.7 px | 111.2 px |
| Opening face-centre error | 38.0 px | 3.8 px |

The custom path established a more exact opening centre but overcorrected when the performer returned. Native gave the quieter result and better late-shot centring on this passage. Both kept the complete head visible in the reviewed frames. This is one Windows host/passage, not a universal performance guarantee or macOS live verification. The unreleased custom code is excluded from the release.

## Workflow

1. Preserve the active project and source sequence. Identify the intended performer and real camera cuts. Do not track across speakers or camera changes.
2. Create a short clean landscape source sequence from original footage for one continuous shot. Do not feed an already cropped/keyframed vertical output into a second reframe pass.
3. Call `auto_reframe_sequence` with verified `sequence_id`, `motion_preset: slower`, explicit output dimensions and a distinct `new_name`. Activate the returned sequence explicitly.
4. Sequence creation/dimensions are the only immediate verified postconditions. Analysis is asynchronous. Read the effect and review actual exported frames/playback before approval. A timeout has an unknown outcome: inspect existing sequences before retrying.
5. Check opening, middle, end, lean/gesture peaks and shot boundaries. Verify the intended person, headroom, bounds, stability, audio sync and export FPS. Reuse an approved route, not guessed parameters.

Auto Reframe does not expose a guaranteed horizontal-only large-movement threshold or a precise speed limit. It may follow unwanted subjects or drift. Do not promise exact centring at every frame. A poor result must be rejected in favour of a wider static composition, useful real shot change, or an explicitly requested measured native Motion path. Never force or rewrite opaque Generated Keyframes / Hash arb data / Overwrite generated path properties. Do not claim ordinary Motion readback proves Auto Reframe is static.

An explicitly approved Auto Reframe effect can remain in a tracking variant. Static variants must contain no animated Auto Reframe effect. Do not add tracking merely because the tool is available.

## Centring correction without custom tracking

A second 20.8-second shot with another performer was exported at 1080 x 1920, 25 fps. It showed why a native tracking pass still needs framing review. Its face detections had a median centre of approximately 572 px against the 540 px midpoint, with larger temporary errors during head turns and hand occlusion. A static bias can correct composition without rewriting the tracking path; do not mistake occluded-face detections for reliable centring evidence.

Use the normal Auto Reframe **Reframe Offset** control through `get_effect_properties` and `set_effect_property`, resolving its exact returned name/index. This is a static composition adjustment, not a generated-path edit. In the tested host, adding 0.05 to offset X shifted the rendered image by approximately 54 output pixels at width 1080; offset X is normalised to output width, not pixel units. A value of 100 sends the image out of frame. Never pass raw pixel values or reuse another host/sequence's calibration blindly.

Measure a clear representative frame and check the whole movement envelope. Compute a small candidate X bias from the measured error and verified units, preserve Y, read the value back and review a new actual export. Recheck bounds and every movement peak. An approximately -31.6 px bias was used for the second pilot, not a universal preset. When exact continuous centring conflicts with quiet movement, widen or disclose the remaining drift. Never label it perfectly centred throughout based on a detector or parameter readback.

## Sources

- [Adobe: Auto Reframe on a sequence](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/add-auto-reframe-effect-to-a-sequence.html)
- [Adobe: Auto Reframe on a clip](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/add-auto-reframe-effect-to-a-clip.html)

Adobe documents Slower Motion for talking-head interviews. The measured comparison above is local evidence, not an Adobe guarantee.
