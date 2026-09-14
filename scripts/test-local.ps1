$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$profilePath = Join-Path $projectRoot ".tools\edge-test-profile"

function Invoke-Checked {
  param([string]$FilePath, [string[]]$Arguments)
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

foreach ($command in @("node", "npm", "cargo")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Missing command: $command. Install the local test dependencies described in README.md."
  }
}

Push-Location $projectRoot
try {
  Write-Host "[1/5] Building browser extension..."
  Invoke-Checked "npm" @("run", "build")

  Write-Host "[2/5] Testing local helper..."
  Invoke-Checked "npm" @("run", "helper:test")

  Write-Host "[3/5] Building local helper..."
  Invoke-Checked "npm" @("run", "helper:build")

  Write-Host "[4/5] Checking Native Messaging and monitor discovery..."
  Invoke-Checked "npm" @("run", "helper:smoke")

  Write-Host "[5/5] Registering the fixed-ID development helper..."
  & (Join-Path $PSScriptRoot "install-helper.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Local helper installation failed." }

  $edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
  )
  $edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1

  if ($edgePath) {
    New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
    $arguments = @(
      "--user-data-dir=$profilePath",
      "--disable-extensions-except=$distPath",
      "--load-extension=$distPath",
      "edge://newtab/"
    )
    Start-Process -FilePath $edgePath -ArgumentList $arguments
    Write-Host ""
    Write-Host "Local test environment started. Open Settings in the new Edge window and click Refresh."
  }
  else {
    Write-Warning "Microsoft Edge was not found, so the test browser could not be opened automatically."
    Write-Host "Load this directory in a Chromium browser: $distPath"
  }
}
finally {
  Pop-Location
}
