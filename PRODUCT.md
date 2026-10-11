# Product

<!-- impeccable:product-schema 1 -->

## Platform

Desktop MCP server and Premiere Pro connector.

## Users

Video editors and producers who want supported AI clients to inspect and edit Adobe Premiere Pro projects stored on their computer.

## Product Purpose

Zura Premiere MCP connects an MCP client to a local Premiere Pro installation through a local server and CEP panel.

## Positioning

Local-first access to Premiere's project, timeline, media, transcript, and export operations, with explicit safety limits and readback where supported.

## Operating Context

The user installs the MCP on a computer with Premiere Pro. The panel starts the local bridge and reports its readiness. An MCP client connects to the local server and requests operations.

## Capabilities and Constraints

- Keep source footage and project files local by default.
- Prefer Premiere's existing transcript and documented native APIs when available.
- Report the limits of the current Premiere version and bridge instead of implying unsupported operations succeeded.
- Verify mutations by reading the resulting Premiere state where the host API permits it.
- Keep the Windows bridge directory private to the current user; do not restore the insecure shared temporary-directory default.
- The Premiere panel reports connector readiness. It must not claim an AI client is connected unless that is directly verified.

## Brand Commitments

Use the Zura palette: Pure Black `#000000`, Energetic Green `#AFFF41`, and Off White `#EAEAEA`. Keep the dark, compact card interface used by the Premiere connection panel.

## Evidence on Hand

- Connection-panel reference image supplied in the design task.
- The maintained fork retains the upstream MIT licence and attribution in `LICENSE` and `UPSTREAM.md`.

## Product Principles

1. Keep media and project files local by default.
2. Make readiness and failure states truthful and easy to act on.
3. Prefer small, verified Premiere operations over opaque automatic effects.
4. Ask for confirmation only when an operation has a meaningful side effect or an unresolved choice.
