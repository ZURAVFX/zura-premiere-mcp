# Zura Premiere MCP feature audit

Audit date: 11 October 2026. Scope: MCP source and connector capabilities. No live Premiere session was used to claim host-side behaviour.

## Capabilities already present

- 393 registered core tools, 391 in the default profile, and 96 additional authenticated UXP operations, based on release metadata.
- Premiere transcript inspection through the authenticated UXP bridge. Premiere speech-to-text can also be started through UXP on supported versions; Adobe may use cloud services according to Premiere settings.
- Local silence detection, transcript analysis, clip and sequence inspection, native Motion controls, review-frame exports, and structured project context.
- Sequence export preflight, export operations, and post-export file verification.
- Caption-track creation and structural caption review through Premiere's available APIs.
- Local health diagnostics, no-write repair planning, and a privacy-safe support bundle.
- Protected local bridge-directory validation for Premiere CEP and After Effects CEP.

These areas already have tools. Adding duplicate tools would increase discovery and editing overhead without filling a real gap.

## Findings and priorities

### 1. Long editing jobs need resumable operations

Many bounded edits still require separate inspection, mutation, readback, and export calls. A durable batch operation could checkpoint work, resume safely after a failure, and report success separately for every item.

Any batch operation should preserve existing confirmation, capability, readback, and delivery-verification boundaries. It should not hide a partial failure behind a single success response.

### 2. Transcript access depends on the optional UXP bridge

Premiere's native transcript export and speech-to-text routes require the authenticated UXP bridge. The default CEP setup does not install or authenticate UXP. Premiere speech-to-text may use Adobe cloud services; it is not an offline guarantee.

A future installer could offer UXP transcript access as an explicit optional component, with the Adobe data-handling behaviour explained before transcription starts. Do not make UXP tokens or cloud transcription a hidden prerequisite.

### 3. The connection panel cannot prove client connectivity

The Premiere panel reports its bridge state and whether a project and active sequence are open. It has no evidence that a particular MCP client has called the server, so it must not display a false client-connected state.

## Changes made from this audit

- The connector panel reports local bridge and Premiere readiness without asserting that an MCP client is connected.
- Windows uses a private per-user Adobe application-data folder for bridge IPC instead of the shared Temp tree.
- Auto Reframe documentation states that its generated path can animate independently of ordinary Motion Position readback.

## Deferred

Resumable batch editing is the highest-value MCP addition, but it needs a clear job model and licensed-host verification before implementation. The current package remains useful with the existing bounded tools and readback contracts.
