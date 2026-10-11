# Zura Premiere Reels MCP feature audit

Audit date: 11 October 2026. Scope: source and plugin bundle review. No live Premiere session was used to claim host-side behavior.

## Capabilities already present

- 393 registered core tools, 391 in the default profile, and 96 additional authenticated UXP operations, based on release metadata.
- Native Premiere transcript inspection through the authenticated UXP bridge. Premiere speech-to-text can also be started through UXP on supported versions; Adobe may use cloud services according to Premiere settings.
- Local silence detection, transcript-led dialogue analysis, reviewed derivative sequences, clip and sequence inspection, direct Motion Position and Scale controls, and review-frame exports.
- Sequence export preflight, a single-sequence export operation, and post-export file verification.
- Caption-track creation and a separate Caption Studio workflow that retains arbitrary preset settings and renders overlay sequences.
- Local health diagnostics, no-write repair planning, and a privacy-safe support bundle.
- Protected local bridge-directory validation for Premiere CEP and After Effects CEP.

These areas already have tools. Adding duplicate tools would increase discovery and editing overhead without filling a real gap.

## Findings and priorities

### 1. Batch reel production still takes many MCP round trips

There is no resumable end-to-end reel-batch operation or multi-sequence export tool. Each reel is assembled, inspected, exported, and verified through separate operations. That makes a 20-reel edit slower and increases repeated context and tool traffic.

Recommended addition: a review-first batch job that accepts an approved moment list, creates one sequence per reel, applies verified static framing by source shot, and renders/verifies each output. It should checkpoint each reel, safely resume after a failure, and never claim the whole batch succeeded when one item failed. Keep the existing per-operation confirmation, readback, and delivery verification boundaries.

### 2. Transcript access depends on the optional UXP bridge

Premiere's native transcript export and speech-to-text routes require the authenticated UXP bridge. The default CEP setup does not install or authenticate UXP. Premiere speech-to-text may use Adobe cloud services; it is not an offline guarantee.

For a reliable local-first fallback, the Zura skill uses the user's existing local Parakeet installation only when needed. A future installer could offer UXP transcript access as an explicit optional component, with the Adobe data-handling behavior explained before transcription starts. Do not make UXP tokens or cloud transcription a hidden prerequisite.

### 3. Caption Studio is a guided handoff, not a native MCP renderer

The skill reads the live public preset names and preserves the selected project's full settings, then uses Caption Studio's renderer to create editable project JSON and transparent PNG sequences for Premiere. The MCP does not call a stable Caption Studio API or render the presets itself.

The current live site catalogue was read on the audit date and returned OA_bouncy_final_2, OE_bouncy_final_2, and V4V_EM_v4. This is evidence that the live reader works, not a permanent list. Browser-local custom presets are outside the public catalogue.

Recommended addition: a small, documented read-only catalogue endpoint and a supported render/import interface from Caption Studio. The MCP could then request any site preset without scraping the page bundle, preserve exact settings, and verify the generated artifacts. Keep custom browser-only presets explicitly separate.

### 4. The connection panel cannot prove Codex-client connectivity

The Premiere panel can report its bridge state and whether a project and active sequence are open. It has no evidence that a particular Codex chat has called the MCP, so it must not display a false “Codex connected” state. The simplified panel now explains how to connect from Codex and places path details and logs under Advanced settings.

## Changes made from this audit

- The built-in shorts-cutdown recipe now routes through static native Motion Position and Scale per shot and review frames. It no longer recommends Auto Reframe.
- The Zura reels skill explicitly prohibits Auto Reframe and Position keyframes between speakers or scene areas. At real camera cuts it uses a direct cut and a new static crop.
- The CEP panel no longer checks npm or offers an updater that could install the upstream premiere-pro-mcp package. MCP and panel updates now come through the Zura Codex plugin.
- The default Windows bridge folder is under the user's Adobe application data, with the same path used by the MCP and CEP panel.

## Deferred

A batch reel job is the highest-value feature addition, but it needs a resumable operation model and licensed-host verification before implementation. Caption Studio API work should be coordinated with that application's owner. The current package remains useful with the existing tools and skill workflow.