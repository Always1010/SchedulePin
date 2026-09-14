# SchedulePin

SchedulePin 把“编辑计划”和“桌面展示”拆成两个边界清楚的部分：Chrome / Edge 插件负责计划管理，可选 Windows 助手负责把计划渲染进桌面壁纸。它不再创建难以移动、无法关闭的伪桌面窗口。

## 这一版包含什么

- 新标签页：顶部以一整段 `Principle` 展示做事原则，下方用一张连续的 To-Do List 管理所有待办。
- 快速添加与排序：在列表末尾输入内容并按 Enter 即可添加；拖动时任务跟随指针，相邻任务平滑让位。
- 任务归档：当天完成的任务保留删除线，次日自动移出列表；独立归档页可搜索、查看完成时间、恢复或删除。
- 个性化设置：独立设置页支持主题、字体、字号、界面密度和卡片圆角，并实时预览。
- 浏览器侧边栏：点击扩展图标，在浏览网页时打开同一份计划。
- 浏览器本地存储：数据保存在 `chrome.storage.local`，不需要登录或服务器。
- 可选桌面壁纸：安装助手后，可指定一块显示器或全部显示器展示计划。
- 布局预览：在浏览器设置中拖动计划卡片，并从右下角调整大小；每块显示器独立保存百分比布局。
- 自动更新：任务或设置变化后自动重绘；浏览器关闭时，助手仍会在日期或显示器配置变化后刷新。
- 原壁纸恢复：关闭桌面展示、点击“恢复启用前的原壁纸”或卸载助手时均可恢复。
- 无桌面窗口：桌面内容只是壁纸的一部分，永远不会遮住普通应用，也不需要寻找关闭按钮。

完整技术取舍和数据流见 [架构说明](docs/ARCHITECTURE.md)，已确认问题及修复记录见 [问题日志](docs/ISSUES.md)。

## 只测试浏览器插件

只测试任务管理时不需要 Rust，也不需要安装任何程序。

```powershell
npm install
npm run extension:build
```

Chrome：

1. 打开 `chrome://extensions`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目生成的 `dist` 目录。
5. 新开一个标签页即可使用；点击工具栏中的 SchedulePin 图标可打开侧边栏。

Edge 的步骤相同，扩展管理地址是 `edge://extensions`。

开发服务器 `npm run dev` 只用于快速预览 React 界面；普通网页没有扩展权限，因此不能验证新标签页、侧边栏或桌面助手连接。

## 测试桌面壁纸功能

桌面功能需要 Rust 工具链。先构建并做只读测试：

```powershell
npm run helper:test
npm run helper:build
npm run helper:smoke
```

`helper:smoke` 只查询 Native Messaging 和显示器，不会改变壁纸。开发版助手原文件生成在：

```text
native-helper\target\release\schedulepin-helper.exe
```

它现在就在本机项目目录中，不需要服务器。设置页提供 [GitHub Releases](https://github.com/Always1010/SchedulePin/releases) 入口；推送 `v*` 标签后，自动发布流程会生成插件 ZIP、Windows 助手 ZIP 和 SHA-256 校验文件。

然后从 `chrome://extensions` 或 `edge://extensions` 复制 SchedulePin 的 32 位扩展 ID，运行：

```powershell
npm run helper:install -- -ExtensionId 这里替换成扩展ID
```

安装脚本会：

- 把助手复制到 `%LOCALAPPDATA%\SchedulePin`；
- 为 Chrome 和 Edge 注册 `com.schedulepin.helper`；
- 只允许传入的扩展 ID 连接；
- 注册当前用户开机启动的无窗口刷新进程。

安装后在扩展管理页重新加载 SchedulePin。打开 SchedulePin 设置并点击重新检测，显示“桌面助手已连接”后即可启用桌面计划。

## 桌面布局和恢复

在设置中先选“指定屏幕”或“全部屏幕”，再选择某块显示器编辑它的布局。拖动预览卡片可改变位置，拖动卡片右下角可改变大小；调整不透明度后会自动同步。

恢复方式有三种：

- 关闭“显示桌面计划”：恢复原壁纸，保留助手和任务。
- 点击“恢复启用前的原壁纸”：立即恢复，同时把桌面展示开关关闭。
- 运行卸载脚本：先恢复壁纸，再注销 Native Messaging 和开机启动。

```powershell
npm run helper:uninstall
```

需要卸载助手但保留缓存和壁纸备份时：

```powershell
npm run helper:uninstall -- -KeepData
```

助手会备份每块屏幕启用时的当前图片，并恢复壁纸位置模式和背景色。第一版不会重新启动 Windows 壁纸轮播；如果启用前使用轮播，恢复后会停留在当时捕获的那张图片。

## 数据和升级说明

- 插件数据是主数据，助手只保存用于离线重绘的最后一份快照。
- 普通 To-Do 不受“当天”限制，未完成时会持续保留；`Principle` 是独立段落，不参与完成度或归档。
- 浏览器预览模式使用 `localStorage`，加载为扩展后使用 `chrome.storage.local`，两者不是同一份数据。
- 旧 Tauri / SQLite 原型数据不会自动迁移到 0.3 插件；旧版仅为测试原型，迁移层已随旧架构一同移除。
- 卸载浏览器扩展会由浏览器清除该扩展的数据；卸载助手不会删除浏览器里的任务。

## 开发命令

```powershell
npm run dev             # 仅预览界面
npm run build           # 构建插件到 dist
npm run helper:test     # Rust 单元测试与壁纸渲染测试
npm run helper:build    # 构建 Release 助手
npm run helper:smoke    # 只读 Native Messaging 冒烟测试
```
