param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceExe = Join-Path $projectRoot "src-tauri\target\release\schedulepin-helper.exe"
$installDir = Join-Path $env:LOCALAPPDATA "SchedulePin"
$installedExe = Join-Path $installDir "schedulepin-helper.exe"
$manifestPath = Join-Path $installDir "com.schedulepin.helper.json"
$hostName = "com.schedulepin.helper"

if (-not (Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
  throw "没有找到已构建的助手。请先运行 npm run helper:build。"
}

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Get-Process -Name "schedulepin-helper" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and ([IO.Path]::GetFullPath($_.Path) -eq [IO.Path]::GetFullPath($installedExe)) } |
  Stop-Process -Force
Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force

$manifest = [ordered]@{
  name = $hostName
  description = "SchedulePin optional Windows wallpaper helper"
  path = $installedExe
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($manifestPath, $manifestJson, (New-Object System.Text.UTF8Encoding($false)))

$browserKeys = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
)
foreach ($key in $browserKeys) {
  New-Item -Path $key -Force | Out-Null
  Set-Item -Path $key -Value $manifestPath
}

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
New-Item -Path $runKey -Force | Out-Null
Set-ItemProperty -Path $runKey -Name "SchedulePinHelper" -Value ('"{0}" --daemon' -f $installedExe)
Start-Process -FilePath $installedExe -ArgumentList "--daemon" -WindowStyle Hidden

Write-Host "SchedulePin 桌面助手已安装。"
Write-Host "允许访问的扩展 ID：$ExtensionId"
Write-Host "请在 Chrome 或 Edge 的扩展管理页重新加载 SchedulePin。"
