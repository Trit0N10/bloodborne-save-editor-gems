param([string]$Executable)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $projectRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = $config.version
if (-not $Executable) { $Executable = Join-Path $projectRoot ('src-tauri\target\release\' + $config.mainBinaryName + '.exe') }
$Executable = (Resolve-Path -LiteralPath $Executable).Path
$releaseRoot = Join-Path $projectRoot 'release'
$stageRoot = Join-Path $releaseRoot ('Bloodborne-Save-Editor-Gems-' + $version + '-windows-x64')
if (Test-Path -LiteralPath $stageRoot) { throw 'Existing package staging directory; choose a fresh version or move it before rebuilding.' }
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
Copy-Item -LiteralPath $Executable -Destination (Join-Path $stageRoot ($config.mainBinaryName + '.exe'))
Copy-Item -LiteralPath (Join-Path $projectRoot 'src-tauri\resources') -Destination $stageRoot -Recurse
foreach ($name in @('LICENSE','NOTICE.md','README.md','README.zh-CN.md')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stageRoot }
Copy-Item -LiteralPath (Join-Path $projectRoot 'licenses') -Destination $stageRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination $stageRoot -Recurse
$binaryZip = Join-Path $releaseRoot ('Bloodborne-Save-Editor-Gems-' + $version + '-windows-x64.zip')
Compress-Archive -LiteralPath $stageRoot -DestinationPath $binaryZip
$sourceZip = Join-Path $releaseRoot ('Bloodborne-Save-Editor-Gems-' + $version + '-source.zip')
Push-Location $projectRoot
try {
    git archive --format=zip --prefix=('bloodborne-save-editor-gems-' + $version + '/') -o $sourceZip HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Source archive failed; commit the reviewed source first.' }
} finally { Pop-Location }
$checksumLines = foreach ($path in @($binaryZip,$sourceZip)) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + (Split-Path -Leaf $path) }
[IO.File]::WriteAllLines((Join-Path $releaseRoot 'SHA256SUMS.txt'), [string[]]$checksumLines, [Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath $binaryZip,$sourceZip,(Join-Path $releaseRoot 'SHA256SUMS.txt') | Select-Object Name,Length
