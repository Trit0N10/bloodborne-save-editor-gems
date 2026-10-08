param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $dependenciesPath = Join-Path $projectRoot 'node_modules'
    if (-not $SkipInstall -and (Test-Path -LiteralPath $dependenciesPath) -and ((Get-Item -LiteralPath $dependenciesPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'node_modules is a junction. Use a clean checkout, or -SkipInstall with intentionally reused dependencies.'
    }
    if (-not $SkipInstall) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } }
    npm run check; if ($LASTEXITCODE -ne 0) { throw 'Publication checks failed.' }
    npm run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    cargo test --locked --manifest-path src-tauri/Cargo.toml --lib publication_
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic Rust tests failed.' }
    npm run tauri -- build --no-bundle -- --locked
    if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
} finally { Pop-Location }
