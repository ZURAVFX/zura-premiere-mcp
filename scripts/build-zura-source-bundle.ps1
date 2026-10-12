param([string]$OutputPath)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $root "dist\zura-premiere-mcp-source.zip"
} elseif (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $root $OutputPath
}
$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$tempBundlePath = Join-Path $outputDirectory ([guid]::NewGuid().ToString("N") + ".tmp.zip")
$rootFiles = @("package.json", "package-lock.json", "tsconfig.json", "README.md", "INSTALL.md", "INSTALL-ZURA-PREMIERE-MCP.mjs", "INSTALL-ZURA-PREMIERE-MCP.ps1", "INSTALL-ZURA-PREMIERE-MCP.command", "LICENSE", "CHANGELOG.md", "public-product-manifest.json")
$sourceDirectories = @("src", "scripts", "cep-plugin", "after-effects-cep-plugin", "uxp-plugin", "benchmarks\uxp-hybrid", "docs")
$files = [System.Collections.Generic.Dictionary[string, System.IO.FileInfo]]::new([System.StringComparer]::Ordinal)

foreach ($relativePath in $rootFiles) {
  $fullPath = Join-Path $root $relativePath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    $files[$relativePath.Replace("\", "/")] = Get-Item -LiteralPath $fullPath
  }
}

foreach ($relativeDirectory in $sourceDirectories) {
  $fullDirectory = Join-Path $root $relativeDirectory
  if (-not (Test-Path -LiteralPath $fullDirectory -PathType Container)) { continue }
  foreach ($file in Get-ChildItem -LiteralPath $fullDirectory -File -Recurse) {
    $key = [System.IO.Path]::GetRelativePath($root, $file.FullName).Replace("\", "/")
    if ($key -match "(^|/)(node_modules|\.git|dist|build|coverage)(/|$)") { continue }
    $files[$key] = $file
  }
}

if (-not $files.ContainsKey("package.json") -or -not $files.ContainsKey("package-lock.json")) {
  throw "The Zura source bundle requires package.json and package-lock.json."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($tempBundlePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
  $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    foreach ($key in ($files.Keys | Sort-Object)) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $files[$key].FullName,
        $key,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
  finally { $archive.Dispose() }
}
finally { $stream.Dispose() }

$zip = [System.IO.Compression.ZipFile]::OpenRead($tempBundlePath)
try {
  $entries = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  foreach ($entry in $zip.Entries) { [void]$entries.Add($entry.FullName) }
  $requiredEntries = @(
    "package.json",
    "package-lock.json",
    "src/index.ts",
    "cep-plugin/CSXS/manifest.xml",
    "scripts/install-cep.ps1",
    "scripts/install-zura-premiere-mcp.ps1",
    "INSTALL-ZURA-PREMIERE-MCP.command",
    "INSTALL-ZURA-PREMIERE-MCP.mjs",
    "scripts/install-zura-premiere-mcp.mjs",
    "scripts/install-cep.sh",
    "scripts/install-zura-premiere-mcp.sh"
  )
  $missing = @($requiredEntries | Where-Object { -not $entries.Contains($_) })
  if ($missing.Count -gt 0) { throw "Source bundle is missing required files: $($missing -join ', ')" }
  $forbidden = @($entries | Where-Object { $_ -match "(^|/)(node_modules|\.git|dist|build|coverage|plugins|skills)(/|$)" })
  if ($forbidden.Count -gt 0) { throw "Source bundle contains generated or workflow-plugin files: $($forbidden -join ', ')" }
}
finally { $zip.Dispose() }

[System.IO.File]::Copy($tempBundlePath, $OutputPath, $true)
[System.IO.File]::Delete($tempBundlePath)
$hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $OutputPath).Length
Write-Host "Built $OutputPath ($size bytes, $($files.Count) files, SHA-256 $hash)"
