# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Video editors and producers who use Codex with Adobe Premiere Pro and want to turn local footage into finished, editable short-form videos.

## Product Purpose

Zura Premiere Reels connects Codex to a local Premiere Pro installation so a user can describe an edit, attach local footage, and receive an editable project with verified exports.

## Positioning

Local-first editing through Premiere's own project, transcript, timeline, and export capabilities, guided by Zura's task-specific Codex skill.

## Operating Context

The user starts from a Codex chat and works with footage stored on their computer. A Codex plugin installs the local MCP server and Premiere CEP connector. The CEP panel's primary job is to show whether the local connector is ready and how to start an edit from Codex.

## Capabilities and Constraints

- Default reel requests produce up to 20 distinct vertical 9:16 edits, 15–30 seconds each, unless the user specifies otherwise.
- Keep source footage local. Prefer Premiere's existing transcript and native transcript access. Do not send footage to a hosted editor or transcribe through a cloud service without the user's choice.
- Use static native Motion Position and Scale per uninterrupted camera shot. Do not use Auto Reframe or Position keyframes to move between speakers or scene areas.
- Ask whether the user wants subtitles when the request has not already answered that question. If yes, read the current Caption Studio preset list from its live site and ask which preset to use before rendering.
- Preserve the editable Premiere project and only include caption projects and rendered overlay sequences when captions are used.
- Keep the Windows bridge directory private to the current user; do not restore the insecure shared temporary-directory default.
- The Premiere panel can report connector readiness, but must not claim that Codex is connected unless that state is directly verified.

## Brand Commitments

The product is branded Zura Premiere Reels. Use the supplied One Agency brand guidelines' core colours: Pure Black `#000000`, Energetic Green `#AFFF41`, and Off White `#EAEAEA`. The supplied dark, compact card interface is the reference for the Premiere connection panel.

## Evidence on Hand

- OA Brand Guidelines 2026 V6 PDF supplied at `G:/Shared drives/One Agency Branding v2/01_BRAND/01_Guidelines/OA Brand Guidelines 2026_V6_LO.pdf`.
- Connection-panel reference image supplied in the task.
- Caption Studio site: `https://oa-caption-studio-beta.vercel.app/`.
- The maintained fork retains the upstream MIT licence and attribution in `LICENSE` and `UPSTREAM.md`.

## Product Principles

1. Keep footage and project files local by default.
2. Make readiness and failure states truthful and easy to act on.
3. Prefer small, verified Premiere operations over opaque automatic effects.
4. Ask only for choices that affect the finished edit, such as whether to add subtitles and which Caption Studio preset to use.
