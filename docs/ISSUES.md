# 问题日志

## SP-001：新增任务后当前面板短暂显示重复项

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：在浏览器预览模式新增一条任务后，任务列表和完成进度会在当前会话中把同一任务计算两次；刷新后恢复正常，实际存储中只有一条记录。
- 原因分析：本地存储写入函数主动触发了当前窗口的数据刷新事件，同时新增流程又向 React 状态追加返回的数据。两个异步状态更新产生竞态，导致内存状态重复追加。
- 解决方案：本地写入只负责持久化，不再向当前窗口主动发送同步事件；当前窗口由调用方更新状态，其他窗口继续依赖原生 `storage` 事件或 Tauri 广播同步。
- 验证方式：新增测试任务后刷新页面，任务只保留一份；勾选完成后进度从 `0/3` 正确更新为 `1/3`。
- 相关文件：`src/data.ts`、`src/App.tsx`

## SP-002：数据库首次启动时示例数据重复

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：Tauri 开发版第一次创建空数据库时，任务、纪律和备忘三条示例数据各出现两份。
- 原因分析：React 严格模式会在开发环境并发检查副作用；两个首次加载流程都在空查询返回后生成了随机 ID，因此数据库无法判断它们是同一批种子数据。
- 解决方案：为每条示例数据使用与日期或类型关联的确定性 ID，并将数据库写入改为 `INSERT OR IGNORE`，使并发初始化具备幂等性。
- 验证方式：清理本轮生成的重复示例记录后重新加载原生应用，查询 `plan_items`，每类示例数据只保留一条。
- 相关文件：`src/data.ts`

## SP-003：Windows PowerShell 5 无法解析开发脚本

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：通过 `npm run desktop:build` 启动构建时，Windows PowerShell 5 在脚本解析阶段报告字符串和右花括号语法错误。
- 原因分析：`apply_patch` 写入的脚本为无 BOM UTF-8，Windows PowerShell 5 按旧代码页读取其中的中文错误提示，乱码字节破坏了字符串边界。
- 解决方案：将仅供终端异常使用的脚本字符串改为 ASCII，避免依赖 PowerShell 版本和系统代码页。
- 验证方式：使用 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tauri.ps1 build` 进入 Tauri Release 构建流程。
- 相关文件：`scripts/tauri.ps1`

## SP-004：Windows 安装包无法找到应用图标

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：Release 主程序成功生成，但 WiX 安装包阶段提示找不到 `.ico` 图标并停止。
- 原因分析：图标文件已经生成在 `src-tauri/icons`，但 `bundle` 配置没有显式列出打包平台应使用的图标资源。
- 解决方案：在 Tauri `bundle.icon` 中配置 Windows ICO 和多尺寸 PNG 图标。
- 验证方式：重新运行 `npm run desktop:build`，安装包打包阶段能够定位 `.ico` 并继续执行。
- 相关文件：`src-tauri/tauri.conf.json`

## SP-005：发布构建被非目标安装格式中断

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：MSI 已成功生成，但发布命令随后继续构建 NSIS 安装包，并因本机 NSIS 扩展无法加载而以失败状态退出。
- 原因分析：首版仅需要稳定的 Windows 安装包，`bundle.targets` 却配置为 `all`，无条件引入了未验证的额外安装格式及其工具链依赖。
- 解决方案：将首版发布目标明确限制为 WiX MSI，保证发布命令的结果与实际交付格式一致。
- 验证方式：重新运行 `npm run desktop:build`，命令成功退出并生成 `SchedulePin_0.1.0_x64_en-US.msi`。
- 相关文件：`src-tauri/tauri.conf.json`

## SP-006：桌面嵌入方案导致多屏副本显示不全

- 日期：2026-09-14
- 状态：已解决（复测修正）
- 现象或修改背景：用户复测上一版后发现组件被明显裁切、无法改变位置和大小；选择“全部屏幕”时仍只能看到一块屏幕上的组件。
- 原因分析：将 WebView 直接设为 `WorkerW` 或 `Progman` 子窗口后，窗口坐标和裁剪范围受单个桌面宿主限制，无法可靠覆盖不同坐标空间的物理显示器，也不适合交互式调整顶层窗口尺寸。
- 解决方案：改为给每块物理显示器创建独立的无边框、无任务栏入口顶层窗口，并把桌面窗口设为其所有者，确保组件处于壁纸上方且保留全局坐标；编辑模式临时允许置顶、拖动和缩放，并按显示器分别保存布局。
- 验证方式：构建后切换“全部屏幕”，每块检测到的显示器分别创建窗口；进入布局编辑可独立移动、缩放，完成后恢复桌面显示模式并持久化布局。
- 相关文件：`src-tauri/src/desktop.rs`、`src-tauri/src/lib.rs`、`src/App.tsx`、`src/components/SettingsPanel.tsx`、`src-tauri/tauri.conf.json`

## SP-007：桌面组件缺少可靠的隐藏、退出和单实例控制

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：无边框且不显示在任务栏的组件没有明确关闭入口；重复启动测试程序会产生多个后台进程，用户难以判断或彻底退出。
- 原因分析：上一版只隐藏了系统窗口框架和任务栏入口，没有提供托盘生命周期控制，也没有限制应用只能运行一个实例。
- 解决方案：增加系统托盘菜单和面板内的隐藏、退出操作；关闭图标改为隐藏而非无提示退出；增加单实例插件，重复启动时唤回已有组件而不创建新进程。
- 验证方式：从面板和托盘均可隐藏组件，托盘可重新显示或彻底退出；连续启动免安装程序两次后系统中只保留一个 `schedulepin` 进程。
- 相关文件：`src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`、`src/App.tsx`、`src/components/SettingsPanel.tsx`

## SP-008：桌面展示窗口同时承担编辑导致布局操作不可用

- 日期：2026-09-14
- 状态：已解决（架构替换）
- 现象或修改背景：用户复测时点击“调整”后无法通过顶部区域移动组件，只有拖动左上角缩放点时位置会随尺寸变化；桌面展示、任务编辑和系统窗口控制混在同一个无边框窗口中，整体行为与“桌面只展示”的需求不一致。
- 原因分析：原生拖动需要在指针按下的有效时机立即进入系统移动循环，旧实现经过异步模块调用后错过了该时机；更根本的问题是展示层同时承载编辑交互，迫使一个桌面底层窗口处理焦点、拖动、缩放和退出等互相冲突的职责。
- 解决方案：废弃可交互桌面窗口，将任务管理迁移到可独立运行的 Manifest V3 浏览器插件；桌面布局改在浏览器显示器预览中用百分比坐标编辑，真实桌面不再接收鼠标输入。本地助手作为后续独立提交提供可选壁纸生成能力。
- 验证方式：`npm run build` 成功生成包含 `manifest.json`、Service Worker、新标签页和侧边栏资源的 `dist` 目录；浏览器独立模式不再调用 Tauri 窗口拖动接口。
- 相关文件：`public/manifest.json`、`public/service-worker.js`、`src/App.tsx`、`src/components/DesktopLayoutEditor.tsx`、`src/components/SettingsPanel.tsx`、`src/data.ts`
## SP-009：每日纪律完成状态不会按日期重置

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：浏览器插件初稿把完成状态直接存入每日重复条目，今天勾选的纪律会在第二天继续显示为已完成。
- 原因分析：迁移到 `chrome.storage.local` 时删掉了原 SQLite 的按日完成记录，却没有补充轻量的日期字段。
- 解决方案：为计划条目增加 `completedDate`；每日重复条目只在该日期与当前日期一致时显示完成，桌面助手渲染时采用相同规则。
- 验证方式：前端生产构建和 Rust 测试通过；完成状态判断同时覆盖浏览器界面和壁纸渲染。
- 相关文件：`src/types.ts`、`src/data.ts`、`native-helper/src/model.rs`、`native-helper/src/renderer.rs`

## SP-010：纪律被错误计入 To-Do 完成度

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：用户有 4 条 To-Do，全部完成后界面仍显示总数 5、完成度 80%。
- 原因分析：完成度分母把普通任务和纪律合并统计；1 条未完成纪律被当成第 5 条任务。
- 解决方案：页面总完成度只统计未归档 To-Do，纪律保留独立的当天勾选状态，不参与该百分比。
- 验证方式：4 条 To-Do 全部完成时分子和分母均为 4，完成度为 100%，纪律状态不会改变结果。
- 相关文件：`src/App.tsx`

## SP-011：任务行显示拖动图标但不能调整顺序

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：任务左侧一直显示拖动手柄，实际拖动没有任何效果，重新打开页面后顺序也不会改变。
- 原因分析：旧界面只渲染了 `GripVertical` 图标，没有注册拖放事件，也没有把调整后的 `sortOrder` 写回存储。
- 解决方案：使用 `dnd-kit` 的 Sortable 模型实现可抓取的拖动手柄；任务行跟随指针移动，其他任务以位移动画让出位置，释放后持久化新顺序，同时支持鼠标、触控和键盘操作。列表统一按 `sortOrder` 和添加时间显示，桌面壁纸采用同一顺序。
- 验证方式：拖动任意任务时任务行跟随指针、相邻任务平滑移动；释放后刷新页面，顺序保持不变，插件生产构建和助手渲染测试通过。
- 相关文件：`src/App.tsx`、`src/data.ts`、`src/styles.css`、`native-helper/src/model.rs`、`native-helper/src/renderer.rs`

## SP-012：原则内容被错误建模为可完成的纪律任务

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：原“纪律”区域把长期遵循的文字拆成多条带勾选框的记录，并显示完成数量，与用户需要的一整段原则说明不符。
- 原因分析：旧数据模型复用了任务的完成状态和每日重复字段，没有区分“行动项”和“长期原则”两种完全不同的信息。
- 解决方案：将模块改名为 `Principle`，作为设置中的独立段落保存；移除勾选、完成数量和逐条添加入口，并把旧纪律内容自动合并迁移。浏览器页面和桌面壁纸使用同一段原则文本。
- 验证方式：TypeScript 类型检查与 Rust 助手测试通过；原则不再出现在任务集合中，也不参与完成度和归档流程。
- 相关文件：`src/types.ts`、`src/data.ts`、`src/App.tsx`、`src/components/AddItemDialog.tsx`、`src/components/SettingsPanel.tsx`、`src/styles.css`、`public/service-worker.js`、`native-helper/src/model.rs`、`native-helper/src/renderer.rs`

## SP-013：本地助手联调要求手动复制扩展 ID

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：每次测试浏览器扩展与桌面助手时，都要求用户进入扩展管理页复制 32 位 ID 并作为安装参数，步骤繁琐且容易填错。
- 原因分析：Native Messaging 的 `allowed_origins` 必须包含确切扩展来源且不能使用通配符；开发版又没有固定 `manifest.key`，导致扩展 ID 被暴露为手工配置。
- 解决方案：为本地开发版加入固定公钥，使 Chrome/Edge 加载解压扩展时获得稳定 ID；安装脚本内置该开发 ID，并新增无参数 `npm run test:local`，自动完成构建、测试、注册和隔离 Edge 启动。安全白名单继续保留，但不再要求用户处理。
- 验证方式：确认清单公钥推导出的 ID 与安装脚本默认 ID一致；PowerShell 脚本语法检查、前端生产构建、助手单元测试和 Native Messaging 冒烟测试通过。
- 相关文件：`public/manifest.json`、`scripts/install-helper.ps1`、`scripts/test-local.ps1`、`package.json`、`README.md`

## SP-014：Windows PowerShell 5.1 无法完成助手安装

- 日期：2026-09-14
- 状态：已解决
- 现象或修改背景：无参数联调首次运行到助手注册阶段时，Windows PowerShell 5.1 无法正确解析 UTF-8 无 BOM 脚本中的中文文本；处理编码后，在已经存在的当前用户 `Run` 注册表键上再次执行 `New-Item -Force` 又触发系统 I/O 异常。
- 原因分析：旧版 Windows PowerShell 对 UTF-8 无 BOM 脚本按系统代码页解码；安装脚本同时对 Windows 默认存在的启动项父键做了不必要的强制重建。
- 解决方案：安装与卸载脚本的控制台和异常文本改为 ASCII，并仅在 `Run` 键不存在时创建它，保留原有注册、开机启动与卸载行为。
- 验证方式：在 Windows PowerShell 5.1 下完整执行 `npm run test:local` 成功；扩展生产构建、助手测试、Release 构建、Native Messaging 冒烟测试、注册和隔离 Edge 启动全部通过，并确认注册清单、助手 EXE 与后台进程均存在。
- 相关文件：`scripts/install-helper.ps1`、`scripts/uninstall-helper.ps1`、`scripts/test-local.ps1`

## SP-015：远程安装冒烟测试等待后台进程直至六小时超时

- 日期：2026-09-15
- 状态：已解决
- 现象或修改背景：手动运行 `Build Helper Installer` 时，Rust 配置和安装程序构建均成功，但 `Smoke test installer` 持续运行六小时，最终达到 GitHub Actions 上限并被取消，安装产物没有上传。
- 原因分析：冒烟测试使用 `Start-Process -Wait` 等待 Setup；该参数会等待 Setup 及其所有后代进程，而安装程序会启动长期运行的 `schedulepin-helper.exe --daemon`，因此等待永远不会自然结束。
- 解决方案：改用 `System.Diagnostics.Process.WaitForExit` 只等待 Setup 或 Uninstaller 自身，并为两者设置 120 秒超时；同时把整个 Windows Job 限制为 15 分钟，并在构建前输出 Rust、Cargo 和 Inno Setup 的实际版本与路径。
- 验证方式：GitHub Actions API 显示失败运行中 `Build helper installer` 在约两分钟内成功，唯一超时步骤为 `Smoke test installer`；本地进程树回归检查确认新的单进程等待不会等待父进程启动的长驻子进程，PowerShell 和工作流静态检查通过。
- 相关文件：`.github/workflows/release.yml`

## SP-016：Principle 编辑按钮错误进入设置首页

- 日期：2026-09-15
- 状态：已解决
- 现象或修改背景：点击主页 Principle 卡片上的“编辑”按钮后只会进入设置首页，用户还需要再次选择 Principle，未直接进入对应编辑器。
- 原因分析：Principle 编辑按钮与顶部设置按钮复用了同一个页面状态，而设置页始终将首页作为默认分区，没有接收入口目标。
- 解决方案：为设置页增加可指定的初始分区，并为主页 Principle 编辑按钮使用独立页面入口；顶部设置按钮仍进入设置首页。
- 验证方式：TypeScript 类型检查与生产构建通过；Principle 编辑入口直接渲染原则编辑器，设置入口仍渲染设置首页。
- 相关文件：`src/App.tsx`、`src/components/SettingsPage.tsx`
