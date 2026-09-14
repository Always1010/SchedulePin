# SchedulePin

把今天真正重要的事钉在桌面上。

## 第一版功能

- 今日重点任务与完成进度
- 带开始/结束时间的日程安排
- 每日重复的纪律清单
- 临时备忘
- SQLite 本地存储（浏览器开发模式回退到 localStorage）
- 嵌入 Windows 桌面层，`Win + D` 后自然显示
- 保留原桌面、壁纸和图标，组件区域可直接交互
- 指定显示器或在全部显示器显示
- 开机自动启动

## 开发

需要 Node.js 和 Rust。标准 Windows 开发环境推荐使用 MSVC；项目脚本也会自动兼容当前电脑已有的 Rust GNU + MinGW 环境。

```powershell
npm install
npm run desktop:dev
```

仅预览界面：

```powershell
npm install
npm run dev
```

## 构建

只生成免安装测试程序：

```powershell
npm run desktop:build:portable
```

程序会生成在 `src-tauri/target/release/schedulepin.exe`。

需要安装程序时再运行：

```powershell
npm run desktop:build
```

安装程序会生成在 `src-tauri/target/release/bundle`。
