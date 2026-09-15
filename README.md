# SchedulePin

SchedulePin 是一个本地优先的 Chrome / Edge 计划管理插件。插件负责编辑和保存计划；可选的 Windows 桌面助手负责把计划渲染进壁纸。桌面端没有需要移动、置底或关闭的伪桌面窗口，也不会遮挡其他应用。

## 目录

- [功能概览](#功能概览)
- [快速开始](#快速开始)
- [Windows 桌面助手](#windows-桌面助手)
- [开发与测试](#开发与测试)
- [构建与发布](#构建与发布)
- [数据与版本说明](#数据与版本说明)
- [项目文档](#项目文档)

## 功能概览

### 浏览器插件

- **计划管理**：顶部用一整段 `Principle` 展示做事原则，下方用连续的 To-Do List 管理待办。
- **快速操作**：在列表末尾输入内容并按 Enter 添加任务；拖动任务时，任务会跟随指针且相邻项目平滑让位。
- **自动归档**：当天完成的任务保留删除线，次日自动移入归档；归档页支持搜索、查看完成时间、恢复和删除。
- **个性化设置**：设置首页按外观、Principle 和桌面展示分类；外观编辑器可一边调整主题、字体、字号、界面密度和卡片圆角，一边预览新标签页或侧边栏。调整内容在保存前只作为草稿，不会影响正在使用的界面。
- **多入口访问**：默认由新标签页展示完整计划；点击扩展图标可在浏览网页时打开侧边栏计划，侧边栏顶部也可随时新开完整页面。
- **本地存储**：数据保存在 `chrome.storage.local`，无需登录或服务器。

### 可选桌面展示

- 将计划渲染为 Windows 壁纸，可指定一块显示器或全部显示器。
- 在浏览器设置页中拖动和缩放计划卡片，为每块显示器独立保存百分比布局。
- 任务、外观、日期或显示器配置变化后自动重绘；浏览器关闭后，助手仍可按最后一次快照刷新。
- 关闭桌面展示、主动恢复或卸载助手时，可恢复启用前的原壁纸。
- 壁纸只是静态桌面内容，不会遮挡应用，也不接受鼠标操作。

浏览器插件可以独立使用。只有需要桌面壁纸功能时，才需要安装和运行 Windows 桌面助手。

## 快速开始

### 1. 准备环境

仅构建和测试浏览器插件需要：

- Node.js 22（包含 npm）；
- Chrome 或 Edge；
- 在项目目录执行一次 `npm install`。

桌面助手仅支持 Windows 10/11。参与助手开发或完整联调时，还需要 Rust stable 工具链，以及与 Rust 工具链匹配的本机链接器：MSVC 工具链需要 Visual Studio Build Tools 的“使用 C++ 的桌面开发”，GNU 工具链需要 MinGW GCC。

### 2. 命令总览

项目命令集中列在这里，后续章节只解释各流程的用途和产物。

| 命令 | 用途 | 是否需要 Rust |
| --- | --- | --- |
| `npm install` | 安装前端依赖，首次拉取项目后执行 | 否 |
| `npm run dev` | 启动 React 界面预览 | 否 |
| `npm run build` | 类型检查并构建插件到 `dist` | 否 |
| `npm run extension:build` | 构建插件到 `dist`，当前等同于 `npm run build` | 否 |
| `npm run preview` | 本地预览已构建的前端资源 | 否 |
| `npm run test:local` | 构建插件与助手、执行测试、注册助手并启动隔离的 Edge 联调环境 | 是 |
| `npm run helper:test` | 运行 Rust 单元测试和壁纸渲染测试 | 是 |
| `npm run helper:build` | 构建 Release 模式的桌面助手 | 是 |
| `npm run helper:smoke` | 只读检查 Native Messaging 和显示器信息 | 是，且需先构建助手 |
| `npm run helper:install` | 注册本地开发版助手 | 是，且需先构建助手 |
| `npm run helper:uninstall` | 注销本地开发版助手并清理其数据 | 否 |
| `npm run helper:uninstall -- -KeepData` | 注销本地开发版助手，但保留缓存和壁纸备份 | 否 |
| `npm run release:local` | 测试并构建桌面助手，再生成单文件安装程序 | 是 |

正式发布时使用的 Git 命令也集中在此处。版本号必须与 `package.json` 一致；以下以 `0.3.0` 为例：

```powershell
git tag v0.3.0
git push origin v0.3.0
```

### 3. 加载浏览器插件

1. 运行 `npm run extension:build`。
2. 打开 `chrome://extensions`；Edge 使用 `edge://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择项目生成的 `dist` 目录。
5. 新开一个标签页即可使用；点击工具栏中的 SchedulePin 图标可打开侧边栏，侧边栏顶部的“完整页面”按钮可另开完整计划。

`npm run dev` 和 `npm run preview` 只适合快速查看 React 界面。普通网页没有扩展权限，因此不能用它们验证新标签页、侧边栏或桌面助手连接。

## Windows 桌面助手

### 安装正式版本

1. 从 [GitHub Releases](https://github.com/Always1010/SchedulePin/releases) 下载 `SchedulePin-Helper-Setup.exe`。
2. 双击安装。安装过程不需要管理员权限，也不需要手动填写扩展 ID。
3. 回到 Chrome 或 Edge 的扩展管理页，重新加载 SchedulePin。
4. 打开 SchedulePin 设置页并点击“重新检测”。显示“桌面助手已连接”后，即可启用桌面计划。

安装程序会：

- 把助手安装到 `%LOCALAPPDATA%\Programs\SchedulePin Helper`；
- 为 Chrome 和 Edge 注册 `com.schedulepin.helper`；
- 使用内置的固定扩展 ID 安全白名单；
- 注册当前用户的无窗口开机启动进程。

直接双击 `schedulepin-helper.exe` 不会打开界面。它是由浏览器启动、通过标准输入输出通信的 Native Messaging Host；正式用户应使用安装程序，而不是裸 EXE。

### 调整桌面布局

在设置中先选择“指定屏幕”或“全部屏幕”，再选择一块显示器编辑布局。拖动预览卡片可改变位置，拖动卡片右下角可改变大小；不透明度等设置会自动同步。布局按百分比保存，因此分辨率或缩放比例变化后仍会保持相对位置。

### 恢复壁纸与卸载

- **暂时关闭展示**：关闭“显示桌面计划”，恢复原壁纸，同时保留助手和任务。
- **立即恢复**：点击“恢复启用前的原壁纸”，恢复壁纸并关闭桌面展示。
- **卸载正式版本**：在 Windows“设置 → 应用 → 已安装的应用”中卸载。卸载程序会先尝试恢复壁纸，再注销 Native Messaging 和开机启动项。
- **卸载开发版本**：使用命令总览中的 `helper:uninstall` 命令；如需保留缓存和壁纸备份，使用带 `-KeepData` 的版本。

助手会备份各显示器启用时的壁纸图片、位置模式和背景色。当前版本不会重新启动 Windows 壁纸轮播；如果启用前使用轮播，恢复后会停留在当时捕获的那张图片。

更完整的正式安装和卸载说明见 [Windows 桌面助手安装](docs/HELPER_INSTALL.md)。

## 开发与测试

### 浏览器插件开发

只开发任务管理、新标签页、侧边栏或设置页面时，不需要 Rust。通过命令总览中的 `dev` 命令快速调整界面，再用 `extension:build` 生成真正的插件资源并按“加载浏览器插件”步骤验证扩展能力。

### 一键完整联调

环境准备完成后运行命令总览中的 `test:local`。脚本会依次：

1. 构建浏览器插件；
2. 测试并构建桌面助手；
3. 验证 Native Messaging；
4. 注册固定 ID 的开发版助手；
5. 使用独立测试配置启动 Edge，并自动加载 `dist`。

随后在新打开的 Edge 中进入设置，点击“重新检测”即可测试桌面壁纸。脚本无需扩展 ID 或其他参数；测试数据保存在项目的 `.tools/edge-test-profile`，不会与日常 Edge 配置混用。

### 单独测试桌面助手

需要分步排查助手时，按命令总览中的顺序运行 `helper:test`、`helper:build` 和 `helper:smoke`。其中 `helper:smoke` 只读取 Native Messaging 与显示器信息，不会修改壁纸。

Release 模式的开发版助手生成在：

```text
native-helper\target\release\schedulepin-helper.exe
```

该文件只用于开发联调和打包，不是面向用户的安装入口。

## 构建与发布

### 本地构建安装程序

除完整联调所需环境外，本地打包还需要 PowerShell 5.1 或 PowerShell 7，以及 Inno Setup 6。运行命令总览中的 `release:local` 后，脚本会检查依赖、测试并编译 Rust Helper，最后调用 Inno Setup 打包。

成功后，输出目录中只有一个交付文件：

```text
release\local\SchedulePin-Helper-Setup.exe
```

也可以直接运行 `scripts\release-local.ps1`。缺少 Rust、链接器或 Inno Setup 时，脚本会指出缺失项并停止，不会自动安装或修改本机软件。

### 使用 GitHub Actions 构建

仓库的 `Build Helper Installer` 工作流运行在 GitHub 提供的 `windows-2022` Standard Runner 上，不需要自建服务器。远程构建与本地构建共用 `scripts\release-local.ps1`，并在上传前通过静默安装、注册表检查和卸载验证完整安装流程。

手动测试构建：

1. 打开仓库的 `Actions` 页面。
2. 在左侧选择 `Build Helper Installer`。
3. 点击 `Run workflow`。
4. 构建完成后，从该次运行的 `Artifacts` 下载 `SchedulePin-Helper-Setup`。

手动构建产物保留 14 天，不会创建正式 GitHub Release。

### 发布正式版本

1. 确认 `package.json` 中的版本号。
2. 使用命令总览中的 Git 命令推送同版本的 `v*` 标签。
3. 工作流校验标签与包版本；不一致时会停止。
4. 构建和安装验证通过后，GitHub Release 只发布 `SchedulePin-Helper-Setup.exe`。

当前安装程序尚未配置商业代码签名证书，因此 Windows 可能显示“未知发布者”或 SmartScreen 提醒。这不影响安装流程；公开发布前可为工作流接入可信代码签名。

## 数据与版本说明

- 浏览器插件中的数据是主数据；助手只保存离线重绘所需的最后一份快照。
- 普通 To-Do 不受“当天”限制，未完成时会持续保留；`Principle` 是独立段落，不参与完成度或归档。
- 浏览器预览模式使用 `localStorage`，加载为扩展后使用 `chrome.storage.local`，两者不是同一份数据。
- 旧 Tauri / SQLite 原型数据不会自动迁移到 0.3 插件；旧版仅为测试原型，迁移层已随旧架构移除。
- 卸载浏览器扩展时，浏览器会清除该扩展的数据；卸载桌面助手不会删除浏览器里的任务。
- 原壁纸恢复支持逐屏图片、位置模式和背景色，但暂不恢复 Windows 壁纸轮播状态。

## 项目文档

- [架构说明](docs/ARCHITECTURE.md)：技术选型、数据流、安全边界和多显示器布局。
- [Windows 桌面助手安装](docs/HELPER_INSTALL.md)：正式助手的安装、卸载与恢复行为。
- [问题日志](docs/ISSUES.md)：已确认问题、原因、修复方案和验证记录。
