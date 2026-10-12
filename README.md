# Zura Premiere MCP

<!-- mcp-name: io.github.zuravfx/zura-premiere -->

Zura Premiere MCP is a local Model Context Protocol server and connector for Adobe Premiere Pro. It lets supported AI clients inspect and edit local Premiere projects through Premiere's own APIs. Footage and project files stay on the user's computer.

The server uses a local Node.js process and a Premiere CEP panel. An optional authenticated UXP bridge exposes additional documented Premiere operations. The MCP can be installed and used on its own.

## Install with Codex (Mac or Windows)

Copy this entire message into Codex on either operating system:

```text
Install Zura Premiere MCP from https://github.com/ZURAVFX/zura-premiere-mcp on this computer. Detect whether this is Windows or macOS. Check for Git, Node.js 20.19 or newer, npm and the Codex CLI. On Windows, use WinGet for missing Git or Node.js prerequisites. On macOS, use an existing package manager for missing Node.js LTS, or guide me through installing it. Resolve any missing Codex CLI before continuing. Clone the repository into a permanent user-writable folder, preserving any existing checkout changes. From the repository root, run node INSTALL-ZURA-PREMIERE-MCP.mjs. Install the Premiere panel and register this local MCP with Codex; do not substitute the upstream npm package. Do not close apps automatically. Tell me which apps need restarting, then verify the Premiere connection once I reopen the panel.
```

The shared command detects the operating system and runs the matching Windows PowerShell or macOS Bash installer. It builds and registers the local MCP, installs the Premiere CEP panel, and configures the current Codex user. Premiere Pro must already be installed and licensed. Restart Premiere if it was already running during installation, then open a new Codex chat to load the MCP tools.

## Install on Windows

The Codex prompt above handles Windows prerequisites. To run the native installer directly from a checkout in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALL-ZURA-PREMIERE-MCP.ps1
```

## Install on macOS

Install Node.js 20.19 or newer (LTS recommended) and the Codex CLI, then clone this repository or download and extract its source. In Terminal, open the repository folder and run:

```bash
node INSTALL-ZURA-PREMIERE-MCP.mjs
```

The installer builds the local server, installs it under `~/Library/Application Support/Adobe/ZuraPremiereMCP`, copies the CEP panel into your user Library, and registers it with Codex using absolute paths. It requires no `sudo` or global npm permissions and uses the installed Node.js on Intel and Apple Silicon Macs. Keep Node.js installed at that location; rerun setup after moving or replacing it.

Restart Premiere Pro if it was already open, choose **Window > Extensions > Zura Premiere MCP**, then open a new Codex chat. Premiere must already be installed and licensed. Local installation checks do not establish a live host connection; ask Codex to verify the Premiere connection before editing.

For another MCP client, run `bash INSTALL-ZURA-PREMIERE-MCP.command --skip-codex`, then use the installed server's `--print-client-config <claude|cursor|vscode|codex>` action. The installer prints the absolute paths for your installation. Integrations that manage their own MCP registration can use `--plugin-managed` to leave Codex configuration unchanged.

## Capabilities

- Inspect Premiere projects, sequences, clips, transcripts and media.
- Make bounded timeline edits and verify their results by reading the project state back.
- Export sequences and inspect rendered files.
- Use the native Premiere transcript where available.
- Connect through CEP, with an optional authenticated UXP bridge for supported Premiere versions.

The server does not upload footage or operate a hosted Premiere session. A tool being available does not establish that the current Premiere version supports it; see [supported actions](docs/supported-actions.md) and [host validation limits](docs/editorial-workflow-host-validation.md).

## Local Reel Workflow

For centered local reels, use `PREMIERE_MCP_TOOL_PACKS=reels` to advertise a compact editing/export catalog. Measure source-shot subject regions, plan static crops with `plan_centered_shot_framing`, verify a rendered pilot, then apply up to 50 clips per active sequence with `set_static_clip_framing_batch`. The batch preflights all targets, refuses animated Motion and Auto Reframe, verifies host units and values, and reports an applied prefix if a later write fails. Rendered composition still needs inspection. Detect cuts only within shortlisted ranges using the optional start/duration arguments of `detect_source_scene_changes`.

For OA Caption Studio captions, resolve the exact live preset and full normalized settings once with `node scripts/caption-studio-presets.mjs --preset "V4V sub" --output <new work selection JSON>`. V4V aliases resolve only when one live V4V entry exists. Names with spaces are supported. Verify each editable caption project offline with `--selection <work selection JSON> --verify-project <project JSON>`; a wrong preset or changed settings must fail before rendering. This helper does not supply or approximate a caption renderer, execute downloaded JavaScript, or upload media.

The reel workflow records a 30-minute deadline, reuses transcripts and shot geometry, and limits recovery to one inspection plus one justified retry. A cold model download, unavailable renderer or large export volume can exceed that target; report it early and deliver only verified results. No end-to-end 30-minute host benchmark is claimed.

Windows setup refreshes PATH, checks the Node version and reports its stages. Successful builds are reused only while the source, dependency lock, Node version and built entrypoints match. The optional source-bundle `-SourceRevision <full Git SHA>` argument emits a SHA-256 manifest for integrations to verify before extracting.

## Source setup

After cloning or downloading this repository and installing Node.js 20.19 or newer, run this same command in PowerShell on Windows or Terminal on macOS:

```sh
node INSTALL-ZURA-PREMIERE-MCP.mjs
```

`npm run setup` runs the same launcher. The native entrypoints remain available: `INSTALL-ZURA-PREMIERE-MCP.ps1` on Windows and `bash INSTALL-ZURA-PREMIERE-MCP.command` on macOS. For manual setup without the full installer, run `npm ci`, `npm run build`, and `npm run install-cep`, then print an absolute-path client configuration with `node dist/index.js --print-client-config <client>`.

## Development

Use Node.js 20.19 or newer.

```powershell
npm ci
npm run build
```

The `scripts/build-zura-source-bundle.ps1` script creates the source archive used by integrations that bundle the MCP. Keep the package name, executable, MCP server name and installer path stable so those integrations continue to work.

## Project details

- Local command: `zura-premiere-mcp`
- MCP server name: `io.github.zuravfx/zura-premiere`
- GitHub source: [ZURAVFX/zura-premiere-mcp](https://github.com/ZURAVFX/zura-premiere-mcp)
- Licence: MIT, with upstream attribution in [UPSTREAM.md](UPSTREAM.md)
