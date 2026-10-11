# Design system

## Surface

Premiere Pro CEP panel for checking the local MCP connector. Mode: Operate.

## Visual direction

Use the supplied dark, compact, card-based reference. Start with a near-black canvas and restrained charcoal surfaces. Use Zura Energetic Green `#AFFF41` for the Zura mark, active connection states, and primary actions. Use Off White `#EAEAEA` for primary text. Keep borders and secondary text in quiet neutral shades derived from the core palette.

## Hierarchy

1. Show whether the Premiere connector is running, using a clear state label and one next step.
2. Show the MCP command and tell the user to connect from their MCP client.
3. Keep bridge paths, manual start/stop, troubleshooting details, and logs behind an Advanced disclosure.

## Constraints

- This panel is a narrow, resizable desktop extension. Keep the primary connection state legible at narrow widths and avoid mobile-only navigation patterns.
- Distinguish the local Premiere connector from the Codex MCP client. Never infer a Codex connection from a running CEP bridge.
- Keep setup automatic and do not require the user to copy a bridge path or configure a UXP token for the CEP workflow.
- Follow the repository's existing CSP and local-only bridge boundary.
- Retain reduced-motion and forced-colour support.
