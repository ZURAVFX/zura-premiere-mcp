$ErrorActionPreference = "Stop"
# Prefer this host's built-in modules when launched from PowerShell 7 or an IDE.
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"

$installer = Join-Path $PSScriptRoot "scripts\install-zura-premiere-mcp.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "The Zura Premiere MCP installer was not found: $installer"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
if ($LASTEXITCODE -ne 0) {
  throw "Zura Premiere MCP setup failed with exit code $LASTEXITCODE."
}
