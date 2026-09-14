param(
    [ValidateSet("dev", "build")]
    [string]$Mode = "dev"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

if (Test-Path -LiteralPath $cargoBin) {
    $env:Path = "$cargoBin;$env:Path"
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "未找到 Cargo。请先安装 Rust：https://rustup.rs"
}

$hostLine = (& rustc -vV | Select-String '^host:').Line
if ($hostLine -match 'windows-gnu') {
    $gcc = Get-Command gcc -ErrorAction SilentlyContinue
    if (-not $gcc) {
        throw "当前 Rust 使用 GNU 工具链，但未找到 MinGW GCC。"
    }

    $libgcc = (& gcc -print-libgcc-file-name).Trim()
    if (-not (Test-Path -LiteralPath $libgcc)) {
        throw "未找到 GCC 运行库：$libgcc"
    }

    $compatDir = Join-Path $projectRoot ".tools\mingw-lib"
    $compatLib = Join-Path $compatDir "libgcc_eh.a"
    New-Item -ItemType Directory -Force -Path $compatDir | Out-Null
    if (-not (Test-Path -LiteralPath $compatLib)) {
        Copy-Item -LiteralPath $libgcc -Destination $compatLib
    }
    $env:RUSTFLAGS = "-L native=$compatDir"
}

$tauriCli = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
if (-not (Test-Path -LiteralPath $tauriCli)) {
    throw "尚未安装项目依赖，请先运行 npm install。"
}

Push-Location $projectRoot
try {
    & $tauriCli $Mode
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
