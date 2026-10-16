# Adjustment layers without Computer Use

`add_adjustment_layer` reuses a verified native adjustment-layer source or automatically imports a bundled media-free native Premiere template into the currently open project. Users do not need to create a blank layer, supply a template, or use UI automation. Optional `template_project_path` and `template_sequence_id` override the bundled template.

The bundled template is derived from a genuine Premiere-generated adjustment layer, stripped of personal project paths. The runtime matches sequence dimensions and timebase, regenerates project object identities, and imports only its sequence. Imported helper material remains in the project. It never opens a different project.

Set `track_index` and frame-aligned `duration_seconds`; the playhead determines the start. Placement refuses locked tracks and occupied ranges. It uses public `overwriteClip`, restores source marks, and reads back layer type, identity, start and duration. Failures after import or placement require inspection before retrying.

After placement use `apply_effect`, property discovery and `add_keyframe` with clip-relative seconds. Place the layer below graphics to keep graphics sharp. Premiere 26.2 exposes both Gaussian Blur (Legacy), with pixel Blurriness, and a newer Gaussian Blur with different controls. Discover properties and use the requested units.

## Live evidence

Windows Premiere 26.2: native template sequence import completed without a relink dialog. Imported sequence contained a verified adjustment-layer source and placement read back as a real adjustment layer. Existing-source placement was also verified. In NO SUBS NO OUTRO, the layer spans 50.12–62.4 seconds below the ending overlay, with Blurriness 0 at clip-relative 0 and 80 at 1 second. Direct preview confirmed blurred footage and sharp graphics. Build passed. Mac and older Premiere template compatibility remain unverified.
