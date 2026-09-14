param(
    [ValidateSet("build", "test")]
    [string]$Mode = "build"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Join-Path $projectRoot "src-tauri\Cargo.toml"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

if (Test-Path -LiteralPath $cargoBin) {
    $env:Path = "$cargoBin;$env:Path"
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Cargo was not found. Install Rust from https://rustup.rs first."
}

$hostLine = (& rustc -vV | Select-String '^host:').Line
if ($hostLine -match 'windows-gnu') {
    $gcc = Get-Command gcc -ErrorAction SilentlyContinue
    if (-not $gcc) {
        throw "The GNU Rust toolchain is active, but MinGW GCC was not found."
    }
    $libgcc = (& gcc -print-libgcc-file-name).Trim()
    if (-not (Test-Path -LiteralPath $libgcc)) {
        throw "The GCC runtime library was not found: $libgcc"
    }
    $compatDir = Join-Path $projectRoot ".tools\mingw-lib"
    $compatLib = Join-Path $compatDir "libgcc_eh.a"
    New-Item -ItemType Directory -Force -Path $compatDir | Out-Null
    if (-not (Test-Path -LiteralPath $compatLib)) {
        Copy-Item -LiteralPath $libgcc -Destination $compatLib
    }
    $env:RUSTFLAGS = "-L native=$compatDir"
}

Push-Location $projectRoot
try {
    if ($Mode -eq "test") {
        & cargo test --manifest-path $manifest
    }
    else {
        & cargo build --release --manifest-path $manifest
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
