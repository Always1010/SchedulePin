$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactDir = [IO.Path]::GetFullPath((Join-Path $projectRoot "release\local"))
$allowedRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'

if (-not $artifactDir.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Release output must stay inside the project: $artifactDir"
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "cargo was not found. Install the Rust toolchain described in README.md."
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
  Copy-Item -LiteralPath (Join-Path $projectRoot "native-helper\target\release\schedulepin-helper.exe") -Destination (Join-Path $artifactDir "schedulepin-helper.exe")

  Write-Host ""
  Write-Host "Local release created with one file:"
  Write-Host (Join-Path $artifactDir "schedulepin-helper.exe")
}
finally {
  Pop-Location
}
