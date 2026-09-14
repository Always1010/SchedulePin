# SchedulePin

把今天真正重要的事钉在桌面上。

## 第一版功能

- 今日重点任务与完成进度
- 带开始/结束时间的日程安排
- 每日重复的纪律清单
- 临时备忘
- SQLite 本地存储（浏览器开发模式回退到 localStorage）
- 桌面显示模式，普通窗口会盖住组件，返回桌面时自然显示
- 无明显外边框，支持调节背景不透明度
- 可拖动、缩放，并为每块显示器保存独立布局
- 可指定显示器或在全部显示器各显示一个组件
- 托盘菜单支持显示、调整、隐藏和彻底退出
- 单实例运行，避免误开多个后台进程
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
