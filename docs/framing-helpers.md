# Reusable framing helpers

These tools ship inside the MCP server alongside the Premiere connector. They do not require the reels plugin or Computer Use. They are available in the reels tool pack and the full catalogue.

## plan_slow_horizontal_correction

Supply one continuous shot ID, one subject ID, verified Motion X/Y in sequence pixels, clip duration, frame rate and measured correction intervals. Each interval has a target X and movement reason. The helper holds X between intervals and produces quintic eased corrections with fixed Y. The analytic peak speed is checked against the requested limit (default 40 pixels/second). The path is limited to 1000 keys and feeds `set_clip_position_path_batch` after active-project and sequence verification.

This is a path planner, not subject detection. Identify movements from source evidence first. Never bridge speakers or camera cuts. Keep Scale fixed and inspect a real export for black edges and motion quality. A timing or path readback alone cannot verify the rendered appearance.

## verify_head_centering

Supply at least three distinct exported-frame samples per shot, each with a full-head box, timestamp, evidence reference and explicit verification flag. The tool returns signed horizontal error in pixels and output-width percentage. Default tolerance is 1%. A face-only detector box can be biased by profiles and is not a verified full-head box.

Declare samples as settled or temporary-drift. Only slow-rare mode permits temporary drift, with a reason. Settled targets still need to pass. At least one settled measurement is mandatory. Sampling arithmetic never approves the whole shot: inspect opening, middle, end, movement extremes, cut boundaries and playback. False evidence flags remain visibly unverified rather than being accepted as proof.

## Installation scope

These helpers run locally in the installed MCP server. The CEP panel remains the connection interface; adding helper tools does not require expanding its UI. Existing running MCP sessions need to reconnect after installing a release containing the tools.

## Opening crop and source quality

Establish the intended composition with the initial X on the first visible frame. The correction planner refuses a correction starting before the second frame; later movement still needs an evidence-based reason and visual review. This guard cannot infer whether a declared movement is necessary.

`plan_centered_shot_framing` reports output pixels per source pixel, flags source enlargement for quality review and leaves quality unverified. Inspect exported face detail at 100%; dimensions and geometry cannot detect low focus, compression or a previously upscaled source. Prefer wider framing or a useful closer source camera when a wide crop looks soft.
