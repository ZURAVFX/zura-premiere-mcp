# Install Zura Premiere Reels

## From OA Motion GitHub

The OA Motion marketplace is private. Use an account that has access to the OA-Motion organisation.

Paste this into Codex:

> Set up Zura Premiere Reels from https://github.com/OA-Motion/OA_Motion_Software_Plugins/tree/main/software/Zura-Premiere-Reels on this Windows computer. Install GitHub CLI or Git for Windows with WinGet if missing and add the installed folders to this session's PATH. Check `gh auth status`; if signed out, run `gh auth login --hostname github.com --git-protocol https --web`, open the default browser, and wait for my approval. Run `gh auth setup-git --hostname github.com` and verify access with `gh repo view OA-Motion/OA_Motion_Software_Plugins`. Never ask me for a token; explain if my account needs OA-Motion access. Add the marketplace with sparse paths `.agents/plugins` and `software/Zura-Premiere-Reels/plugin`, or upgrade it if present. Remove and reinstall only `zura-premiere-reels@oa-motion-software` if it is already installed; otherwise add it. Run its bundled setup skill to install the custom MCP and Premiere panel. Do not install the upstream npm package.

Codex should use the default browser for GitHub's device login. It should not request a personal access token. If access to the private organisation is denied, stop and explain that an OA-Motion owner must grant repository access.

After authentication, install the marketplace and plugin:

    codex plugin marketplace add OA-Motion/OA_Motion_Software_Plugins --ref main --sparse .agents/plugins --sparse software/Zura-Premiere-Reels/plugin
    codex plugin add zura-premiere-reels@oa-motion-software

The plugin setup installs Node.js LTS only if needed, builds and installs the bundled Zura MCP, and installs the CEP panel. It configures the Codex plugin to use the local MCP. No footage is uploaded to a hosted editing service.

Premiere may need a restart to load the panel. Codex should not close Premiere automatically or risk unsaved work. A new Codex chat may be needed to load the plugin's MCP tools.

## From a complete local checkout

Open the repository folder in Codex and ask it to install Zura Premiere Reels from this folder, or run the installer:

    .\INSTALL-ZURA-PREMIERE-REELS.ps1

The script adds this local marketplace and plugin, installs the bundled MCP and Premiere CEP panel, and reports whether Premiere needs a restart.

## Using the skill

In any Codex chat, attach local footage and say to use Zura Premiere Reels. Include the brief, preferred reel count and duration if known. If subtitles are not addressed in the brief, the skill asks whether to add them. If the user says yes, it retrieves the current public Caption Studio preset names and asks which to use.

The Premiere panel starts its local bridge automatically. It shows bridge, project, and active-sequence readiness. It does not claim that Codex is connected until a Codex chat successfully calls the MCP.
