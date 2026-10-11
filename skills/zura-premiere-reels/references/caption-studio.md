# Caption Studio workflow for Zura Premiere Reels

Source of truth: [OA Caption Studio](https://oa-caption-studio-beta.vercel.app/). Read the deployed preset catalogue at the time of the edit; its names and settings can change.

Read this reference only when the user requests captions or the existing project style calls for them. Captioning is optional; the core reel workflow must remain useful without it. Keep this integration modular so it could become a separate paid add-on later. Do not add a paywall, billing, pricing promise, or gate to core editing.

## Choose any available preset

- After the user opts into subtitles, retrieve every current built-in preset name from the Caption Studio site and present the names exactly as shown. The bundled `scripts/list-caption-studio-presets.mjs` reads the live Vercel HTML and JavaScript bundle as text and prints the preset keys; it never executes downloaded code or uploads footage. If the site changes its bundle format and the script cannot read it, inspect the live preset selector or ask the user to choose in Caption Studio. Never offer a stale list as current.
- If the user names a preset, select that exact preset and preserve its site-provided settings. If no preset is named and the project does not clearly establish one, ask one concise question showing all presets read from the live site and let the user choose before rendering.
- Presets saved only in the user's browser are not exposed by the public static catalogue. If the user wants one of those custom presets, use the user's existing Caption Studio project or have them name/export the preset; do not claim the public list includes it.
- If the live catalogue cannot be read, do not guess or silently fall back. Ask the user to select a preset in Caption Studio or provide an exported `.oa-caption-project.json`.
- An existing `.oa-caption-project.json` is authoritative for `selectedPreset`, full settings, words, punctuation, speaker metadata, and timing. Preserve arbitrary settings from any preset; do not coerce them into a known preset schema or approximate their look.
- The site catalogue is dynamic. Never use a memorised preset list when the live catalogue can be read.

## Render and bring captions into Premiere

1. Finalize the reel cuts first. Use the completed transcript/word timings, adjust for each reel's source in/out and removed sections, and preserve exact words and punctuation. Apply speaker-specific styling only where diarization is confirmed.
2. Use Caption Studio's own project/preset renderer so the chosen preset's typography, animation, colours, and timing are retained. Do not approximate a site preset with native Premiere captions or hand-built styling. If the renderer is unavailable, stop and explain the missing step rather than silently substituting a different look.
3. Save one `.oa-caption-project.json` per reel in `Caption Studio Projects/`. Render transparent PNG frame sequences into per-reel folders under `Overlay Sequences/`, then place each sequence as one image-sequence overlay clip on an upper Premiere video track. Keep word timing and image/video sync exact.
4. The JSON project is the editable caption source. The rendered overlay is not individually word-editable in Premiere; revisions to words, timing, or style should be made in Caption Studio and rendered again. Keep all PNG frames because the `.prproj` references them.
5. Verify representative words at the beginning, middle, and end, speaker-colour changes, safe areas, and synchronisation after edits. Batch the same verified renderer and import steps across reels.

## Delivery layout

Use only these final top-level items by default:

```text
<delivery folder>/
  Caption Studio Projects/
    Reel 01 - <title>.oa-caption-project.json
  Overlay Sequences/
    Reel 01 - <title>/frame_00001.png ...
  <project name>.prproj
  Final Reels/
    01 - <title>.mp4
```

Do not include SRTs, manifests, previews, backup copies, autosaves, or temporary transcripts unless requested or required by an actual handoff. Keep such working material outside the final delivery. Do not remove user data.
