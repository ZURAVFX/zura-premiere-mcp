# Zura Premiere MCP

<!-- mcp-name: io.github.zuravfx/zura-premiere -->

Zura Premiere MCP is a local Model Context Protocol server and connector for Adobe Premiere Pro. It lets supported AI clients inspect and edit local Premiere projects through Premiere's own APIs. Footage and project files stay on the user's computer.

The server uses a local Node.js process and a Premiere CEP panel. An optional authenticated UXP bridge exposes additional documented Premiere operations. The MCP can be installed and used on its own.

## Install on Windows

Paste this into Codex:

> Install Zura Premiere MCP from https://github.com/ZURAVFX/zura-premiere-mcp on this Windows PC. Check for Git, Node.js LTS and WinGet, install any missing prerequisites with WinGet, clone the repository, then run `INSTALL-ZURA-PREMIERE-MCP.ps1`. Register the local MCP with Codex and install the Premiere panel. Guide me only if I need to approve a Windows prompt, then confirm which apps need restarting.

The installer builds and registers the local MCP, installs the Premiere CEP panel, and configures the current Codex user. It does not install Adobe Premiere Pro. Restart Premiere if it was already running during installation, then open a new Codex chat to load the MCP tools.

## Capabilities

- Inspect Premiere projects, sequences, clips, transcripts and media.
- Make bounded timeline edits and verify their results by reading the project state back.
- Export sequences and inspect rendered files.
- Use the native Premiere transcript where available.
- Connect through CEP, with an optional authenticated UXP bridge for supported Premiere versions.

The server does not upload footage or operate a hosted Premiere session. A tool being available does not establish that the current Premiere version supports it; see [supported actions](docs/supported-actions.md) and [host validation limits](docs/editorial-workflow-host-validation.md).

## Source setup

For a local checkout, run:

```powershell
.\INSTALL-ZURA-PREMIERE-MCP.ps1
```

The installer supports Windows. On macOS, install Node.js 20.19 or newer, run `npm ci`, `npm run build`, `npm install --global .`, and `npm run install-cep`. Add `zura-premiere-mcp` to the MCP client using `zura-premiere-mcp --print-client-config <client>` to print a configuration for the current installation.

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
