param(
  [string]$RepositoryUrl = "https://github.com/ZURAVFX/zura-premiere-reels.git",
  [switch]$PluginManaged
)

$ErrorActionPreference = "Stop"

function Require-NativeSuccess([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "$Action failed with exit code $LASTEXITCODE." }
}

function Get-RepoRootFromSkill([string]$SkillScriptsPath) {
  if ([string]::IsNullOrWhiteSpace($SkillScriptsPath)) { return $null }
  $candidate = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $SkillScriptsPath))
  $candidatePackage = Join-Path $candidate "package.json"
  if (Test-Path -LiteralPath $candidatePackage) {
    try {
      $metadata = Get-Content -LiteralPath $candidatePackage -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($metadata.name -eq "zura-premiere-mcp" -and
          (Test-Path -LiteralPath (Join-Path $candidate "skills\zura-premiere-reels\SKILL.md"))) {
        return $candidate
      }
    } catch { return $null }
  }
  return $null
}

$localAppData = $env:LOCALAPPDATA
if (-not $localAppData) { throw "LOCALAPPDATA is not set; cannot choose a per-user Premiere install location." }
$installDirectory = Join-Path $localAppData "Adobe\ZuraPremiereReelsMCP"
$sourceRecord = Join-Path $installDirectory "source-root.txt"
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null

$repoRoot = Get-RepoRootFromSkill $PSScriptRoot
if (-not $repoRoot -and (Test-Path -LiteralPath $sourceRecord)) {
  $recordedRoot = (Get-Content -LiteralPath $sourceRecord -Raw -Encoding UTF8).Trim()
  if ($recordedRoot -and (Test-Path -LiteralPath (Join-Path $recordedRoot "package.json"))) {
    $repoRoot = (Resolve-Path -LiteralPath $recordedRoot).Path
  }
}

if (-not $repoRoot) {
  $repoRoot = Join-Path $installDirectory "source"
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $git) {
      $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
      if (-not $winget) { throw "Git for Windows is required to download the Zura Premiere MCP source. Install Git or winget, then run setup again." }
      & $winget.Source install --id Git.Git --exact --accept-package-agreements --accept-source-agreements --silent
      Require-NativeSuccess "Installing Git for Windows"
      $gitCandidates = @(
        (Join-Path $env:ProgramFiles "Git\cmd\git.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\cmd\git.exe"),
        (Join-Path $localAppData "Programs\Git\cmd\git.exe")
      )
      $gitPath = $gitCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
      if ($gitPath) { $env:PATH = (Split-Path -Parent $gitPath) + ";" + $env:PATH }
      $git = Get-Command git.exe -ErrorAction SilentlyContinue
      if (-not $git) { throw "Git installed, but this PowerShell session cannot find git.exe. Open a new terminal and run setup again." }
    }
    & $git.Source clone --depth 1 $RepositoryUrl $repoRoot
    Require-NativeSuccess "Cloning the Zura Premiere MCP repository"
  }
}

$repoRoot = (Resolve-Path -LiteralPath $repoRoot).Path
$packagePath = Join-Path $repoRoot "package.json"
if (-not (Test-Path -LiteralPath $packagePath)) { throw "MCP package.json not found in $repoRoot." }
$package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.name -ne "zura-premiere-mcp") { throw "Unexpected Zura MCP package '$($package.name)' in $repoRoot." }

$codexNeedsRestart = $false
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw "Node.js 20.19 or newer is required. Install Node.js LTS, then run setup again." }
  & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
  Require-NativeSuccess "Installing Node.js LTS"
  $codexNeedsRestart = $true
  $programNode = Join-Path $env:ProgramFiles "nodejs"
  if (Test-Path -LiteralPath $programNode) { $env:PATH = "$programNode;$env:PATH" }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { throw "Node.js installed, but this PowerShell session cannot find node.exe. Open a new terminal and run setup again." }
}
$nodeVersionText = (& $node.Source --version).Trim().TrimStart("v")
$nodeVersion = [Version]$nodeVersionText
if ($nodeVersion -lt [Version]"20.19.0") {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw "Node.js $nodeVersionText is too old. Update Node.js LTS to 20.19 or newer, then run setup again." }
  & $winget.Source upgrade --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
  Require-NativeSuccess "Updating Node.js LTS"
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { throw "Node.js was updated, but this PowerShell session cannot find node.exe. Open a new terminal and run setup again." }
  $nodeVersionText = (& $node.Source --version).Trim().TrimStart("v")
  $nodeVersion = [Version]$nodeVersionText
  if ($nodeVersion -lt [Version]"20.19.0") { throw "Node.js $nodeVersionText is still too old; install Node.js 20.19 or newer." }
}

$npmGlobalBin = if ($env:APPDATA) { Join-Path $env:APPDATA "npm" } else { $null }
if ($npmGlobalBin) {
  $currentPathEntries = $env:PATH -split [System.IO.Path]::PathSeparator
  if (-not ($currentPathEntries | Where-Object { $_.TrimEnd('\') -ieq $npmGlobalBin.TrimEnd('\') })) {
    $env:PATH = $npmGlobalBin + [System.IO.Path]::PathSeparator + $env:PATH
    $codexNeedsRestart = $true
  }
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $userPathEntries = @($userPath -split [System.IO.Path]::PathSeparator | Where-Object { $_ })
  if (-not ($userPathEntries | Where-Object { $_.TrimEnd('\') -ieq $npmGlobalBin.TrimEnd('\') })) {
    [Environment]::SetEnvironmentVariable("Path", (($userPathEntries + $npmGlobalBin) -join [System.IO.Path]::PathSeparator), "User")
    $codexNeedsRestart = $true
  }
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { throw "npm.cmd was not found beside Node.js. Repair the Node.js installation and run setup again." }
$dependencyLock = Join-Path $repoRoot "node_modules\.package-lock.json"
$lockFile = Join-Path $repoRoot "package-lock.json"
if (-not (Test-Path -LiteralPath $dependencyLock) -or
    (Get-Item -LiteralPath $lockFile).LastWriteTimeUtc -gt (Get-Item -LiteralPath $dependencyLock).LastWriteTimeUtc) {
  Push-Location $repoRoot
  try {
    & $npm.Source ci
    Require-NativeSuccess "Installing the locked MCP build dependencies"
  } finally { Pop-Location }
}

Push-Location $repoRoot
try {
  & $npm.Source run build
  Require-NativeSuccess "Building the Premiere MCP"
  & $npm.Source install --global $repoRoot
  Require-NativeSuccess "Installing the Premiere MCP for the current user"
} finally { Pop-Location }

$mcpCommand = Get-Command zura-premiere-mcp.cmd -ErrorAction SilentlyContinue
if (-not $mcpCommand) { $mcpCommand = Get-Command zura-premiere-mcp -ErrorAction SilentlyContinue }
if (-not $mcpCommand) { throw "The installed zura-premiere-mcp command was not found on PATH." }
& $mcpCommand.Source --install-cep
Require-NativeSuccess "Installing the Premiere CEP connector"

$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) { $codex = Get-Command codex -ErrorAction SilentlyContinue }
if (-not $codex) { throw "The Codex CLI was not found on PATH, so the local MCP could not be registered." }
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" }
$configPath = Join-Path $codexHome "config.toml"
$configText = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 } else { "" }
foreach ($name in @("zura-premiere-reels", "premiere-reels", "premiere-pro-leancoderkavy", "premiere-pro-mcp")) {
  $tablePattern = "(?m)^\s*\[mcp_servers\.(?:`"|')?" + [regex]::Escape($name) + "(?:`"|')?(?:\.|\])"
  if ($configText -match $tablePattern) {
    & $codex.Source mcp remove $name
    Require-NativeSuccess "Removing the '$name' standalone Codex MCP registration"
  }
}
if (-not $PluginManaged) {
  & $codex.Source mcp add zura-premiere-reels -- zura-premiere-mcp
  Require-NativeSuccess "Registering Zura Premiere Reels with Codex"
}

if (-not $PluginManaged) {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" }
  $skillSource = Join-Path $repoRoot "skills\zura-premiere-reels"
  if (-not (Test-Path -LiteralPath (Join-Path $skillSource "SKILL.md"))) {
    throw "The bundled Zura Premiere Reels skill was not found at $skillSource."
  }
  $skillDestination = Join-Path $codexHome "skills\zura-premiere-reels"
  if ((Resolve-Path -LiteralPath $skillSource).Path -ne $skillDestination) {
    New-Item -ItemType Directory -Force -Path $skillDestination | Out-Null
    Copy-Item -Path (Join-Path $skillSource "*") -Destination $skillDestination -Recurse -Force
  }
}

Set-Content -LiteralPath $sourceRecord -Value $repoRoot -Encoding UTF8
if ($PluginManaged) {
  Write-Host "Zura Premiere Reels MCP and Premiere panel are installed."
  Write-Host "Restart Premiere Pro if it was already open, so it loads the new panel. Do not close it automatically."
  if ($codexNeedsRestart) {
    Write-Host "Restart Codex once so its MCP process receives the new Node.js PATH, then open a new chat."
  } else {
    Write-Host "Open a new Codex chat to load the plugin-managed MCP tools."
  }
} else {
  Write-Host "Zura Premiere Reels is installed. Restart Premiere Pro to load the CEP connector, then start a new Codex chat to load the MCP tools."
}
