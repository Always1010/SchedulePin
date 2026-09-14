# SchedulePin Windows 桌面助手安装

桌面助手是可选组件。只使用新标签页、侧边栏、To-Do、归档和个性化设置时，不需要安装它。

## 安装

1. 从 GitHub Releases 下载 `SchedulePin-Helper-Setup.exe`。
2. 双击安装，不需要管理员权限，也不需要复制扩展 ID。
3. 回到 Chrome 或 Edge 的扩展管理页重新加载 SchedulePin，然后在设置页面点击“重新检测”。

安装程序会把助手安装到当前用户的 `%LOCALAPPDATA%\Programs\SchedulePin Helper`，注册 Chrome/Edge Native Messaging，并创建当前用户开机启动项。运行数据、生成的壁纸和原壁纸备份仍保存在 `%LOCALAPPDATA%\SchedulePin`。

## 卸载与恢复壁纸

从 Windows“设置 → 应用 → 已安装的应用”中卸载 `SchedulePin Helper`。

卸载程序会先停止后台助手并尝试恢复启用 SchedulePin 之前的壁纸，再移除 Native Messaging 注册、开机启动项和安装文件。只有壁纸恢复成功时才清理运行数据与备份；恢复失败时会保留这些数据，避免丢失恢复依据。

仓库中的 `scripts/install-helper.ps1` 和 `scripts/uninstall-helper.ps1` 仅保留给本地开发联调，正式用户不需要运行它们。
