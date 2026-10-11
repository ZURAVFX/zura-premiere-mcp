$ErrorActionPreference = "Stop"

$pluginRoot = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $pluginRoot "assets\zura-premiere-mcp-source.zip"
if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) {
  throw "Bundled Zura Premiere MCP source was not found: $bundlePath"
}

$localAppData = $env:LOCALAPPDATA
if (-not $localAppData) { throw "LOCALAPPDATA is not set; cannot choose a per-user install location." }
$installRoot = Join-Path $localAppData "Adobe\ZuraPremiereReelsMCP"
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

$bundleHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
$sourceRoot = Join-Path $installRoot ("plugin-source-" + $bundleHash.Substring(0, 16))
$packagePath = Join-Path $sourceRoot "package.json"
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
  New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
  Expand-Archive -LiteralPath $bundlePath -DestinationPath $sourceRoot -Force
}

if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
  throw "The bundled source did not contain package.json after extraction."
}
$package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.name -ne "zura-premiere-mcp") {
  throw "Unexpected MCP package '$($package.name)' in the bundled source."
}

$installer = Join-Path $sourceRoot "skills\zura-premiere-reels\scripts\install.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "The bundled installer was not found: $installer"
}
& $installer -PluginManaged
if (-not $?) { throw "The Zura Premiere MCP installer failed." }
