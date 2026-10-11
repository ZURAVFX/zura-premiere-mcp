---
name: setup-zura-premiere-reels
description: Install or repair the local Zura Premiere Reels MCP and Premiere connector when the user asks to set up Zura Premiere Reels.
---

# Set up Zura Premiere Reels

Run this setup when the user asks to install, set up, or repair Zura Premiere Reels, including during the one-prompt GitHub install. On Windows, run the packaged installer directly; do not switch to the upstream npm package or use Computer Use.

1. Use the installed plugin record to find its setup script, so an older cached copy cannot be selected after an update. Run this PowerShell command:

   ```powershell
   $codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
   if (-not $codex) { $codex = Get-Command codex -ErrorAction SilentlyContinue }
   if (-not $codex) { throw "Codex CLI was not found on PATH." }
   $pluginList = (& $codex.Source plugin list --json | ConvertFrom-Json)
   if ($LASTEXITCODE -ne 0) { throw "Could not read the installed Codex plugin list." }
   $installed = @($pluginList.installed | Where-Object { $_.name -eq "zura-premiere-reels" -and $_.enabled })
   $oaPlugin = @($installed | Where-Object { $_.marketplaceName -eq "oa-motion-software" })
   if ($oaPlugin.Count -eq 1) { $plugin = $oaPlugin[0] }
   elseif ($installed.Count -eq 1) { $plugin = $installed[0] }
   else { throw "Enable one installed Zura Premiere Reels plugin before running setup." }
   $setup = Join-Path $plugin.source.path "scripts\setup-zura-premiere-reels.ps1"
   if (-not (Test-Path -LiteralPath $setup -PathType Leaf)) { throw "The installed Zura plugin setup script was not found at $setup." }
   & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setup
   if ($LASTEXITCODE -ne 0) { throw "Zura Premiere Reels setup failed with exit code $LASTEXITCODE." }
   ```

2. Wait for the installer to finish. It uses the MCP source bundled in this plugin, installs Node.js LTS with `winget` only if needed, builds and installs the local MCP, installs and auto-starts the CEP panel, and removes any duplicate standalone Codex MCP entry so the plugin owns the connection.
3. Confirm the installer reports success and `zura-premiere-mcp` is available on PATH. Do not claim Codex is connected until a fresh chat successfully calls the MCP.
4. Do not restart Premiere or Codex automatically. Tell the user if Premiere must be restarted to load the panel and if Codex must be restarted because Node.js was installed during setup. Do not ask them to repeat the installation.

If PowerShell or Windows raises a security prompt, stop and ask the user to resolve it directly. Do not click through security prompts. If setup fails, report the failing step and exact error, then stop rather than installing the upstream package.
