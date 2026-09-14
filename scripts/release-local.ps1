$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactDir = [IO.Path]::GetFullPath((Join-Path $projectRoot "release\local"))
$allowedRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
$installerScript = Join-Path $projectRoot "installer\SchedulePin-Helper.iss"
$setupPath = Join-Path $artifactDir "SchedulePin-Helper-Setup.exe"

if (-not $artifactDir.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Release output must stay inside the project: $artifactDir"
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "cargo was not found. Install the Rust toolchain described in README.md."
}

$isccCommand = Get-Command ISCC.exe -ErrorAction SilentlyContinue
$isccPath = if ($isccCommand) { $isccCommand.Source } else { $null }
if (-not $isccPath) {
  foreach ($root in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
    if (-not $root) { continue }
    $candidate = Join-Path $root "Inno Setup 6\ISCC.exe"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $isccPath = $candidate
      break
    }
  }
}
if (-not $isccPath) {
  throw "ISCC.exe was not found. Install Inno Setup 6 as described in README.md."
}
if (-not (Test-Path -LiteralPath $installerScript -PathType Leaf)) {
  throw "The Inno Setup script was not found: $installerScript"
}

$package = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = [string]$package.version
if ($version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
  throw "package.json contains an invalid release version: $version"
}

Push-Location $projectRoot
try {
  & (Join-Path $PSScriptRoot "helper.ps1") test
  if ($LASTEXITCODE -ne 0) { throw "Helper tests failed. Local release was stopped." }

  & (Join-Path $PSScriptRoot "helper.ps1") build
  if ($LASTEXITCODE -ne 0) { throw "Helper build failed." }

  if (Test-Path -LiteralPath $artifactDir) {
    Remove-Item -LiteralPath $artifactDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null

  & $isccPath "/DMyAppVersion=$version" "/O$artifactDir" "/FSchedulePin-Helper-Setup" $installerScript
  if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed to build the installer." }

  $artifacts = @(Get-ChildItem -LiteralPath $artifactDir -File)
  if ($artifacts.Count -ne 1 -or $artifacts[0].FullName -ne $setupPath) {
    throw "Local release must contain exactly one file: $setupPath"
  }

  Write-Host ""
  Write-Host "Local installer release created with one file:"
  Write-Host $setupPath
}
finally {
  Pop-Location
}
