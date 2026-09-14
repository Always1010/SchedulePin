param(
  [switch]$KeepData
)

$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:LOCALAPPDATA "SchedulePin"
$installedExe = Join-Path $installDir "schedulepin-helper.exe"
$hostName = "com.schedulepin.helper"

if (Test-Path -LiteralPath $installedExe -PathType Leaf) {
  $restore = Start-Process -FilePath $installedExe -ArgumentList "--restore" -WindowStyle Hidden -Wait -PassThru
  if ($restore.ExitCode -ne 0) {
    throw "原壁纸恢复失败，已停止卸载并保留助手数据。"
  }
}

Get-Process -Name "schedulepin-helper" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and ([IO.Path]::GetFullPath($_.Path) -eq [IO.Path]::GetFullPath($installedExe)) } |
  Stop-Process -Force

$browserKeys = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
)
foreach ($key in $browserKeys) {
  if (Test-Path $key) { Remove-Item -Path $key -Recurse -Force }
}

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "SchedulePinHelper" -ErrorAction SilentlyContinue

if (-not $KeepData -and (Test-Path -LiteralPath $installDir)) {
  $resolvedTarget = [IO.Path]::GetFullPath($installDir).TrimEnd('\')
  $expectedTarget = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "SchedulePin")).TrimEnd('\')
  if ($resolvedTarget -ne $expectedTarget -or $resolvedTarget.Length -le 10) {
    throw "拒绝清理非预期目录：$resolvedTarget"
  }
  Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}

Write-Host $(if ($KeepData) { "助手已卸载，壁纸备份和缓存已保留。" } else { "助手已卸载，原壁纸已恢复，本地助手数据已清理。" })
