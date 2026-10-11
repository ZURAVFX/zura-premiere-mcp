# Zura Premiere Reels

<!-- mcp-name: io.github.zuravfx/zura-premiere -->

Zura Premiere Reels is a local-first Codex plugin for turning footage into editable short videos in Adobe Premiere Pro. It installs a custom Zura MCP and an auto-starting Premiere panel from this repository. Footage stays on the user's computer.

The MCP is a Zura-maintained fork of the MIT-licensed Premiere Pro MCP. See [UPSTREAM.md](UPSTREAM.md) for source and licence attribution.

## Install from the OA Motion GitHub page

The repository is private to the OA Motion organisation. Team members need an OA-Motion GitHub account with repository access.

Copy this prompt into Codex:

> Set up Zura Premiere Reels from https://github.com/OA-Motion/OA_Motion_Software_Plugins/tree/main/software/Zura-Premiere-Reels on this Windows computer. Do the setup yourself: install GitHub CLI or Git for Windows with WinGet if missing and add their installed folders to this session's PATH; check `gh auth status`, and if signed out run `gh auth login --hostname github.com --git-protocol https --web`, open the default browser, and wait for my approval; then run `gh auth setup-git --hostname github.com` and verify access with `gh repo view OA-Motion/OA_Motion_Software_Plugins`. Never ask me for a token; if access is denied, explain that my account needs OA-Motion access. Add the marketplace with `codex plugin marketplace add OA-Motion/OA_Motion_Software_Plugins --ref main --sparse .agents/plugins --sparse software/Zura-Premiere-Reels/plugin`, or upgrade it if already configured. If `zura-premiere-reels@oa-motion-software` is already installed, remove only that plugin and reinstall it; otherwise add it. Run its bundled setup skill to install the custom MCP and Premiere panel, then tell me if Premiere or Codex needs a restart. Use the MCP source bundled with the plugin; do not install the upstream npm package.

When needed, Codex installs the two small GitHub bootstrap tools on Windows with:

    winget install --id GitHub.cli --exact --accept-package-agreements --accept-source-agreements
    winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements

If GitHub CLI needs authentication, the browser sign-in is the only manual step. Codex should resume when it completes and should not ask the user to paste commands or a personal access token. If repository access is denied, the GitHub account needs OA-Motion organisation access.

After GitHub access is ready, the marketplace commands are:

    codex plugin marketplace add OA-Motion/OA_Motion_Software_Plugins --ref main --sparse .agents/plugins --sparse software/Zura-Premiere-Reels/plugin
    codex plugin add zura-premiere-reels@oa-motion-software

The bundled setup installs Node.js LTS if needed, builds the local Zura MCP, registers the plugin-managed connection, and installs the auto-starting Premiere CEP panel. It does not install or run ChatCut and does not send footage to a hosted editor. Windows may ask the user to approve a software installer or GitHub browser login. Codex should guide those steps and resume automatically when they finish.

Premiere may need a restart before it loads a newly installed or updated panel. Codex should never close Premiere or interrupt an open project automatically. A fresh Codex chat may be needed to load newly installed plugin tools.

## Use it

Attach local footage in any Codex chat and mention **Zura Premiere Reels** in the brief. Once installed, the skill is available in new chats.

For a long-form source with no other requirements, Zura selects up to 20 distinct moments, 15–30 seconds each, in vertical 9:16. It uses the existing Premiere transcript when available and otherwise follows the configured local transcription route. It does not silently upload footage or switch to a cloud transcription service.

The reel workflow avoids Auto Reframe. Each uninterrupted camera shot gets a fixed native Motion crop. At a real camera cut, the next shot receives its own fixed crop. It does not animate Position between speakers or scene areas. Trimming focuses on genuinely empty or low-value sections and keeps useful pauses, reactions, breaths, and emphasis.

If the brief does not already say whether subtitles are wanted, Zura asks. When subtitles are requested, it reads the current public preset names from the Caption Studio site and asks the user to choose before rendering. Browser-local custom presets are not in that public list; the user's existing Caption Studio project or exported preset is needed for those.

## Delivery

Each edit is saved as a new Premiere project and rendered reels. When Caption Studio subtitles are used, keep the editable caption projects and rendered overlay frames with the delivery:

    <delivery folder>/
      Caption Studio Projects/
      Overlay Sequences/
      <project name>.prproj
      Final Reels/

Caption-related folders are omitted when captions are not used. The project stays editable in Premiere; each final MP4 is verified before delivery.

## Premiere panel

The Zura Premiere Reels panel is a connection and readiness view. It shows whether its local bridge is running and whether a project and active sequence are open. It does not claim to know whether Codex itself is connected. Setup installs the panel and starts its bridge automatically. Advanced connection settings contain the local bridge folder and activity log.

The optional UXP bridge is for advanced Premiere operations. It is not needed for the normal reels workflow.

## Feature coverage and known gaps

The source includes 393 registered core tools, 391 in the default profile, plus 96 authenticated UXP additions. It already covers native Premiere transcripts, silence detection, static Motion edits, frame review, sequence export, delivery-file verification, and local diagnostics.

Current practical gaps are recorded in [docs/zura-feature-audit.md](docs/zura-feature-audit.md). The main workflow opportunity is a resumable batch operation that creates and verifies many reels with fewer round trips. Caption Studio rendering remains a separate handoff because its site owns preset rendering and overlay generation.

## Run from a local source checkout

For development or a complete local clone, open the repository folder in Codex and ask it to install Zura Premiere Reels from this folder, or run:

    .\INSTALL-ZURA-PREMIERE-REELS.ps1

This adds the local Codex marketplace and runs the bundled installer.

Maintainers should run `scripts/build-zura-source-bundle.ps1` after changing the MCP or Premiere panel, then sync `plugins/zura-premiere-reels` into the OA Motion software repository. This refreshes the private MCP source archive distributed with the plugin.

## Distribution and source

- Product name: Zura Premiere Reels
- Codex plugin: zura-premiere-reels
- Local MCP command: zura-premiere-mcp
- GitHub source: [ZURAVFX/zura-premiere-reels](https://github.com/ZURAVFX/zura-premiere-reels)
- OA Motion team marketplace: [OA_Motion_Software_Plugins](https://github.com/OA-Motion/OA_Motion_Software_Plugins/tree/main/software/Zura-Premiere-Reels)
- Licence: MIT, with upstream attribution retained
