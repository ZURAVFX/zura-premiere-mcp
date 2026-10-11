$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$pluginRoot = Join-Path $root "plugins\zura-premiere-reels"
$assetRoot = Join-Path $pluginRoot "assets"
$bundlePath = Join-Path $assetRoot "zura-premiere-mcp-source.zip"
$tempBundlePath = Join-Path $assetRoot ([guid]::NewGuid().ToString("N") + ".tmp.zip")
$rootFiles = @("package.json", "package-lock.json", "tsconfig.json", "README.md", "LICENSE", "CHANGELOG.md", "public-product-manifest.json")
$sourceDirectories = @("src", "scripts", "cep-plugin", "after-effects-cep-plugin", "uxp-plugin", "benchmarks\uxp-hybrid", "docs", "skills\zura-premiere-reels")
$files = [System.Collections.Generic.Dictionary[string, System.IO.FileInfo]]::new([System.StringComparer]::Ordinal)

foreach ($relativePath in $rootFiles) {
  $fullPath = Join-Path $root $relativePath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    $key = $relativePath.Replace("\", "/")
    $files[$key] = Get-Item -LiteralPath $fullPath
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
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
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
    "skills/zura-premiere-reels/scripts/install.ps1"
  )
  $missing = @($requiredEntries | Where-Object { -not $entries.Contains($_) })
  if ($missing.Count -gt 0) { throw "Source bundle is missing required files: $($missing -join ', ')" }
  $forbidden = @($entries | Where-Object { $_ -match "(^|/)(node_modules|\.git|dist|build|coverage)(/|$)" })
  if ($forbidden.Count -gt 0) { throw "Source bundle contains generated or development files: $($forbidden -join ', ')" }
}
finally { $zip.Dispose() }

[System.IO.File]::Copy($tempBundlePath, $bundlePath, $true)
[System.IO.File]::Delete($tempBundlePath)
$legacyBundle = Join-Path $assetRoot "premiere-reels-source.zip"
if (Test-Path -LiteralPath $legacyBundle -PathType Leaf) {
  $resolvedAssetRoot = (Resolve-Path -LiteralPath $assetRoot).Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $resolvedLegacy = [System.IO.Path]::GetFullPath($legacyBundle)
  if (-not $resolvedLegacy.StartsWith($resolvedAssetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove an unexpected legacy bundle path: $resolvedLegacy"
  }
  [System.IO.File]::Delete($resolvedLegacy)
}

$hash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $bundlePath).Length
Write-Host "Built $bundlePath ($size bytes, $($files.Count) files, SHA-256 $hash)"
