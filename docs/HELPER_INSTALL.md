# SchedulePin Windows 桌面助手安装

桌面助手是可选组件。只使用新标签页、侧边栏、To-Do、归档和个性化设置时，不需要安装它。

## 安装

1. 从 GitHub Releases 下载 `SchedulePin-Helper-Windows.zip` 并完整解压。
2. 在 Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions` 中找到 SchedulePin，复制扩展 ID。
3. 在解压目录打开 PowerShell，运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-helper.ps1 -ExtensionId 这里替换成扩展ID
```

4. 回到扩展管理页重新加载 SchedulePin，然后在设置页面点击“重新检测”。

安装脚本会把助手复制到当前用户的 `%LOCALAPPDATA%\SchedulePin`，注册 Chrome/Edge Native Messaging，并创建当前用户开机启动项。安装不需要管理员权限。

## 卸载与恢复壁纸

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-helper.ps1
```

卸载脚本会先尝试恢复启用 SchedulePin 之前的壁纸，再移除 Native Messaging 注册和开机启动项。
