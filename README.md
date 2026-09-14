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

## 一键启动本地完整测试

第一次使用先准备：

- Windows 10/11 和 Microsoft Edge；
- Node.js 22（包含 npm）；
- Rust stable 工具链；
- Rust MSVC 工具链需要 Visual Studio Build Tools 的“使用 C++ 的桌面开发”，GNU 工具链需要 MinGW GCC；
- 在项目目录执行一次 `npm install` 安装前端依赖。

之后无需填写扩展 ID 或其他参数，直接运行：

```powershell
npm run test:local
```

脚本会依次构建扩展、测试并构建助手、验证 Native Messaging、注册固定开发版助手，然后用独立测试配置启动 Edge 并自动加载 `dist`。在新打开的 Edge 中进入设置，点击“重新检测”即可继续测试桌面壁纸。

扩展内部仍然使用 Chrome 要求的 `allowed_origins` 安全白名单，但开发版通过 `manifest.key` 获得固定 ID；该细节已经内置在脚本中，使用者不需要复制或传入 ID。测试浏览器数据保存在项目的 `.tools/edge-test-profile`，不会和日常 Edge 配置混用。

直接双击 `schedulepin-helper.exe` 不会打开界面：它是由浏览器启动、通过标准输入输出通信的 Native Messaging Host。

## 本地生成助手 Release

本地 Release 生成的是可以直接双击安装的单文件安装程序，不再交付裸 Helper。依赖准备完成后运行：

```powershell
npm run release:local
```

脚本先检查依赖，再测试并编译 Rust Helper，最后调用 Inno Setup 打包。成功后输出目录中严格只有一个文件：

```text
release\local\SchedulePin-Helper-Setup.exe
```

本地构建需要：

- PowerShell 5.1 或 PowerShell 7；
- Rust stable 和与工具链匹配的 C/C++ 链接器；
- Inno Setup 6；
- 使用上面的 npm 命令时需要 Node.js/npm，也可以直接运行 `scripts\release-local.ps1`。

缺少 Rust 或 Inno Setup 时，脚本会说明缺少的依赖后停止，不会自动修改或安装本机软件。因此可以先保留脚本，等需要本机构建时再安装依赖。

## 使用 GitHub Standard Runner 构建

仓库的 `Build Helper Installer` 工作流使用 GitHub 提供的 `windows-2022` Standard Runner，不需要自己的服务器。远程构建和本地构建调用同一个 `scripts\release-local.ps1`，并在上传前静默安装、检查注册表、卸载，以验证安装程序的完整流程。

### 手动测试构建

工作流进入 GitHub 默认分支后：

1. 打开仓库的 `Actions` 页面；
2. 在左侧选择 `Build Helper Installer`；
3. 点击 `Run workflow`；
4. 构建完成后，在该次运行页面的 `Artifacts` 下载 `SchedulePin-Helper-Setup`。

手动构建产物保留 14 天，不会创建正式 GitHub Release。

### 正式版本发布

确认 `package.json` 中的版本号后，推送相同版本的 `v*` 标签，例如：

```powershell
git tag v0.3.0
git push origin v0.3.0
```

标签版本与 `package.json` 不一致时工作流会停止。验证成功后，GitHub Release 只包含 `SchedulePin-Helper-Setup.exe`。

当前安装程序尚未配置商业代码签名证书，因此 Windows 可能显示“未知发布者”或 SmartScreen 提醒；这不影响安装流程。面向公开用户发布前，可以再为工作流接入可信代码签名。

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

它现在就在本机项目目录中，不需要服务器，但裸 EXE 只供开发和打包，不是最终安装入口。设置页提供 [GitHub Releases](https://github.com/Always1010/SchedulePin/releases) 入口；正式发布后，下载并双击 `SchedulePin-Helper-Setup.exe` 即可。安装程序会：

- 把助手安装到 `%LOCALAPPDATA%\Programs\SchedulePin Helper`；
- 为 Chrome 和 Edge 注册 `com.schedulepin.helper`；
- 使用内置的固定扩展 ID 安全白名单，不要求复制或填写 ID；
- 注册当前用户开机启动的无窗口刷新进程。

安装不需要管理员权限。完成后在扩展管理页重新加载 SchedulePin，打开设置并点击重新检测；显示“桌面助手已连接”后即可启用桌面计划。

## 桌面布局和恢复

在设置中先选“指定屏幕”或“全部屏幕”，再选择某块显示器编辑它的布局。拖动预览卡片可改变位置，拖动卡片右下角可改变大小；调整不透明度后会自动同步。

恢复方式有三种：

- 关闭“显示桌面计划”：恢复原壁纸，保留助手和任务。
- 点击“恢复启用前的原壁纸”：立即恢复，同时把桌面展示开关关闭。
- 从 Windows“设置 → 应用 → 已安装的应用”卸载正式安装版：先恢复壁纸，再注销 Native Messaging 和开机启动。

使用 `npm run test:local` 注册的开发版助手仍通过下面的命令卸载：

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
