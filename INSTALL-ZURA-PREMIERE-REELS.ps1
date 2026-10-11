$ErrorActionPreference = "Stop"

function Require-NativeSuccess([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "$Action failed with exit code $LASTEXITCODE." }
}

$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) { $codex = Get-Command codex -ErrorAction SilentlyContinue }
if (-not $codex) { throw "The Codex CLI was not found on PATH. Open this repository folder in Codex and run setup again." }

$marketplacePath = Join-Path $PSScriptRoot ".agents\plugins\marketplace.json"
if (-not (Test-Path -LiteralPath $marketplacePath -PathType Leaf)) {
  throw "Codex marketplace manifest not found: $marketplacePath"
}
$marketplace = Get-Content -LiteralPath $marketplacePath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $marketplace.name) { throw "The Codex marketplace manifest has no name." }

& $codex.Source plugin marketplace add $PSScriptRoot
Require-NativeSuccess "Adding the Zura local Codex marketplace"

$installed = (& $codex.Source plugin list --json | ConvertFrom-Json).installed
$plugin = $installed | Where-Object { $_.pluginId -eq "zura-premiere-reels@$($marketplace.name)" } | Select-Object -First 1
if (-not $plugin) {
  & $codex.Source plugin add zura-premiere-reels --marketplace $marketplace.name
  Require-NativeSuccess "Installing the Zura Premiere Reels Codex plugin"
} elseif (-not $plugin.enabled) {
  throw "The Zura Premiere Reels plugin is installed but disabled. Enable it in Codex, then run setup again."
}

$setup = Join-Path $PSScriptRoot "plugins\zura-premiere-reels\scripts\setup-zura-premiere-reels.ps1"
if (-not (Test-Path -LiteralPath $setup -PathType Leaf)) { throw "Bundled setup script not found: $setup" }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $setup
Require-NativeSuccess "Installing the Zura Premiere MCP and CEP connector"
