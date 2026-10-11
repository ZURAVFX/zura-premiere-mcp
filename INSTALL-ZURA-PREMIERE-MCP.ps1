$ErrorActionPreference = "Stop"

$installer = Join-Path $PSScriptRoot "scripts\install-zura-premiere-mcp.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "The Zura Premiere MCP installer was not found: $installer"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
if ($LASTEXITCODE -ne 0) {
  throw "Zura Premiere MCP setup failed with exit code $LASTEXITCODE."
}
