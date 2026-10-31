param(
  [string]$RepositoryUrl = "https://github.com/ZURAVFX/zura-premiere-mcp.git",
  [switch]$PluginManaged
)

$ErrorActionPreference = "Stop"
# Prefer this host's built-in modules when launched from PowerShell 7 or an IDE.
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"
$setupStarted = Get-Date
$env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";" + $env:PATH
Write-Host "[1/5] Checking the local bundled source and prerequisites..."

function Require-NativeSuccess([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "$Action failed with exit code $LASTEXITCODE." }
}

function Find-SourceRoot([string]$ScriptsPath) {
  if ([string]::IsNullOrWhiteSpace($ScriptsPath)) { return $null }
  $candidate = Split-Path -Parent $ScriptsPath
  if ((Test-Path -LiteralPath (Join-Path $candidate "package.json")) -and
      (Test-Path -LiteralPath (Join-Path $candidate "src\index.ts"))) {
    return (Resolve-Path -LiteralPath $candidate).Path
  }
  return $null
}

$localAppData = $env:LOCALAPPDATA
if (-not $localAppData) { throw "LOCALAPPDATA is not set; cannot choose a per-user install location." }
$installDirectory = Join-Path $localAppData "Adobe\ZuraPremiereMCP"
$sourceRecord = Join-Path $installDirectory "source-root.txt"
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null

$repoRoot = Find-SourceRoot $PSScriptRoot
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
      if (-not $winget) { throw "Git for Windows is required to download the Zura Premiere MCP source. Install Git or WinGet, then run setup again." }
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
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "MCP package.json not found in $repoRoot." }
$package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.name -ne "zura-premiere-mcp") { throw "Unexpected MCP package '$($package.name)' in $repoRoot." }

$codexNeedsRestart = $false
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeCompatible = $false
if ($node) {
  $nodeVersion = [version](& $node.Source -p "process.versions.node")
  Require-NativeSuccess "Checking Node.js"
  $nodeCompatible = $nodeVersion -ge [version]"20.19.0"
}
if (-not $nodeCompatible) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw "Node.js 20.19 or newer is required. Install Node.js LTS, then run setup again." }
  $nodeInstallAction = if ($node) { "upgrade" } else { "install" }
  & $winget.Source $nodeInstallAction --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
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

# npm.cmd finds node.exe beside itself, but npm lifecycle scripts resolve `node`
# through PATH. Put the verified Node directory first so a long inherited PATH
# cannot hide it from the child cmd.exe process.
$nodeDirectory = Split-Path -Parent $node.Source
$env:PATH = $nodeDirectory + [System.IO.Path]::PathSeparator + $env:PATH

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
$normalPath = $env:PATH
$gitForBuild = Get-Command git.exe -ErrorAction SilentlyContinue
# npm prepends node_modules/.bin to PATH for scripts. A long inherited Windows
# PATH can then exceed cmd.exe's limit and make even `node` disappear. Use a
# short, verified build PATH for npm, restoring the full session PATH after.
$buildPath = @(
  $nodeDirectory,
  (Split-Path -Parent $npm.Source),
  $npmGlobalBin,
  $(if ($gitForBuild) { Split-Path -Parent $gitForBuild.Source }),
  (Join-Path $env:SystemRoot "System32"),
  $env:SystemRoot,
  (Join-Path $env:SystemRoot "System32\Wbem")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique
$env:PATH = $buildPath -join [System.IO.Path]::PathSeparator
Write-Host "[2/5] Checking locked build dependencies..."
$env:npm_config_fetch_retries = "1"
$env:npm_config_fetch_timeout = "60000"
$dependencyLock = Join-Path $repoRoot "node_modules\.package-lock.json"
$lockFile = Join-Path $repoRoot "package-lock.json"
$dependencyStatePath = Join-Path $repoRoot "node_modules\.zura-source-lock.sha256"
$lockHash = (Get-FileHash -LiteralPath $lockFile -Algorithm SHA256).Hash
$installedLockHash = if (Test-Path -LiteralPath $dependencyStatePath) { (Get-Content -LiteralPath $dependencyStatePath -Raw).Trim() } else { "" }
$dependenciesChanged = -not (Test-Path -LiteralPath $dependencyLock) -or $installedLockHash -ne $lockHash
if ($dependenciesChanged) {
  Push-Location $repoRoot
  try {
    & $npm.Source ci --no-audit --no-fund
    Require-NativeSuccess "Installing the locked MCP build dependencies"
    Set-Content -LiteralPath $dependencyStatePath -Value $lockHash -Encoding ASCII
  } finally { Pop-Location }
}

Push-Location $repoRoot
try {
  Write-Host "[3/5] Building the bundled MCP (reusing a verified matching build when possible)..."
  $node = Get-Command node.exe -ErrorAction Stop
  $buildState = (& $node.Source (Join-Path $repoRoot "scripts\setup-build-state.mjs") $repoRoot | ConvertFrom-Json)
  Require-NativeSuccess "Checking the MCP build fingerprint"
  if ($dependenciesChanged -or -not $buildState.reusable) {
    & $npm.Source run build
    Require-NativeSuccess "Building the Premiere MCP"
    $buildState | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoRoot ".zura-build-state.json") -Encoding ASCII
  } else { Write-Host "The source, dependencies, Node version and built entrypoints match; skipped rebuilding." }
  & $npm.Source install --global --no-audit --no-fund $repoRoot
  Require-NativeSuccess "Installing the Premiere MCP for the current user"
} finally { Pop-Location }
$env:PATH = $nodeDirectory + [System.IO.Path]::PathSeparator + $normalPath

& $node.Source (Join-Path $repoRoot "scripts\matte-runtime.mjs") --setup
Require-NativeSuccess "Preparing local person matting"

$mcpCommand = Get-Command zura-premiere-mcp.cmd -ErrorAction SilentlyContinue
if (-not $mcpCommand) { $mcpCommand = Get-Command zura-premiere-mcp -ErrorAction SilentlyContinue }
if (-not $mcpCommand) { throw "The installed zura-premiere-mcp command was not found on PATH." }
Write-Host "[4/5] Installing the Premiere panel..."
& $mcpCommand.Source --install-cep
Require-NativeSuccess "Installing the Premiere CEP connector"

$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) { $codex = Get-Command codex -ErrorAction SilentlyContinue }
if (-not $codex) { throw "The Codex CLI was not found on PATH, so the local MCP could not be registered." }
Write-Host "[5/5] Verifying plugin-managed registration..."
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" }
$configPath = Join-Path $codexHome "config.toml"
$configText = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 } else { "" }
foreach ($name in @("zura-premiere-reels", "premiere-reels", "premiere-pro-leancoderkavy", "premiere-pro-mcp", "zura-premiere-mcp")) {
  $tablePattern = "(?m)^\s*\[mcp_servers\.(?:`"|')?" + [regex]::Escape($name) + "(?:`"|')?(?:\.|\])"
  if ($configText -match $tablePattern) {
    & $codex.Source mcp remove $name
    Require-NativeSuccess "Removing the '$name' standalone Codex MCP registration"
  }
}
if (-not $PluginManaged) {
  & $codex.Source mcp add zura-premiere-mcp -- zura-premiere-mcp
  Require-NativeSuccess "Registering Zura Premiere MCP with Codex"
}

Set-Content -LiteralPath $sourceRecord -Value $repoRoot -Encoding UTF8
Write-Host ("Setup completed in {0:N1} minutes." -f ((Get-Date) - $setupStarted).TotalMinutes)
if ($PluginManaged) {
  Write-Host "Zura Premiere MCP and Premiere panel are installed."
  Write-Host "Restart Premiere Pro if it was already open, so it loads the new panel. Do not close it automatically."
  if ($codexNeedsRestart) {
    Write-Host "Restart Codex once so its MCP process receives the new Node.js PATH, then open a new chat."
  } else {
    Write-Host "Open a new Codex chat to load the plugin-managed MCP tools."
  }
} else {
  Write-Host "Zura Premiere MCP is installed. Restart Premiere Pro to load the CEP connector, then start a new Codex chat to load the MCP tools."
}
