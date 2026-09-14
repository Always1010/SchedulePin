import { useEffect, useMemo, useState } from "react";
import {
  AlignJustify, ArrowLeft, Check, Laptop, Monitor, Palette,
  RefreshCw, RotateCcw, Type, Unplug,
} from "lucide-react";
import type { AppSettings, HelperStatus, MonitorInfo } from "../types";
import { defaultDesktopLayout, DesktopLayoutEditor } from "./DesktopLayoutEditor";

interface Props {
  settings: AppSettings;
  helper: HelperStatus;
  onChange: (settings: AppSettings) => void;
  onRefreshHelper: () => void;
  onRestoreWallpaper: () => void;
  onBack: () => void;
}

const previewMonitor: MonitorInfo = {
  id: "preview", index: 0, name: "显示器预览", x: 0, y: 0,
  width: 1920, height: 1080, primary: true,
};

const themes: Array<{ value: AppSettings["theme"]; label: string; color: string }> = [
  { value: "warm", label: "暖色", color: "#efe5dc" },
  { value: "light", label: "明亮", color: "#edf3f1" },
  { value: "dark", label: "深色", color: "#25302b" },
  { value: "system", label: "跟随系统", color: "linear-gradient(135deg,#edf3f1 50%,#25302b 50%)" },
];

const fonts: Array<{ value: AppSettings["fontFamily"]; label: string; sample: string }> = [
  { value: "system", label: "系统默认", sample: "Aa 计划" },
  { value: "modern", label: "现代无衬线", sample: "Aa 计划" },
  { value: "reading", label: "阅读型", sample: "Aa 计划" },
  { value: "rounded", label: "圆润", sample: "Aa 计划" },
];

export function SettingsPage({ settings, helper, onChange, onRefreshHelper, onRestoreWallpaper, onBack }: Props) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  const monitors = helper.monitors.length ? helper.monitors : [previewMonitor];
  const activeMonitor = useMemo(() => monitors.find((monitor) => monitor.id === draft.selectedMonitorId) ?? monitors[0], [monitors, draft.selectedMonitorId]);
  const patch = (next: Partial<AppSettings>) => {
    const value = { ...draft, ...next };
    setDraft(value);
    onChange(value);
  };
  const layout = draft.layouts[activeMonitor.id] ?? defaultDesktopLayout;

  return (
    <main className="settings-page page-shell">
      <div className="page-title-row">
        <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={17} />返回</button>
        <div><span className="eyebrow">Personalize</span><h1>设置</h1><p>调整页面外观、Principle 和桌面展示。</p></div>
      </div>

      <div className="settings-page-content">
        <section className="settings-card">
          <div className="settings-card-heading"><Palette size={18} /><div><h2>外观</h2><p>修改后立即应用到当前页面。</p></div></div>

          <label className="settings-control-label">主题</label>
          <div className="theme-options">
            {themes.map((theme) => (
              <button type="button" key={theme.value} className={draft.theme === theme.value ? "selected" : ""} onClick={() => patch({ theme: theme.value })}>
                <i style={{ background: theme.color }} />{theme.label}{draft.theme === theme.value && <Check size={14} />}
              </button>
            ))}
          </div>

          <label className="settings-control-label"><Type size={14} />字体</label>
          <div className="font-options">
            {fonts.map((font) => (
              <button type="button" key={font.value} data-font={font.value} className={draft.fontFamily === font.value ? "selected" : ""} onClick={() => patch({ fontFamily: font.value })}>
                <strong>{font.sample}</strong><small>{font.label}</small>
              </button>
            ))}
          </div>

          <div className="range-heading"><span>文字大小</span><strong>{Math.round(draft.fontScale * 100)}%</strong></div>
          <input className="range" type="range" min="0.85" max="1.25" step="0.05" value={draft.fontScale} onChange={(event) => patch({ fontScale: Number(event.target.value) })} />

          <label className="settings-control-label"><AlignJustify size={14} />界面密度</label>
          <div className="density-options segmented">
            {(["compact", "comfortable", "spacious"] as const).map((value) => (
              <button type="button" key={value} className={draft.density === value ? "active" : ""} onClick={() => patch({ density: value })}>
                {{ compact: "紧凑", comfortable: "标准", spacious: "宽松" }[value]}
              </button>
            ))}
          </div>

          <div className="range-heading"><span>卡片圆角</span><strong>{draft.cardRadius}px</strong></div>
          <input className="range" type="range" min="8" max="30" step="1" value={draft.cardRadius} onChange={(event) => patch({ cardRadius: Number(event.target.value) })} />
        </section>

        <section className="settings-card">
          <div className="settings-card-heading"><Type size={18} /><div><h2>Principle</h2><p>作为一段完整文字展示，不参与完成度。</p></div></div>
          <textarea className="settings-textarea principle-editor" rows={7} value={draft.principle} onChange={(event) => patch({ principle: event.target.value })} placeholder="写下做事时希望遵循的原则……" />
          <small className="field-help">换行会被保留，桌面壁纸会自动折行。</small>
        </section>

        <section className="settings-card desktop-settings-card">
          <div className="settings-card-heading"><Monitor size={18} /><div><h2>桌面展示</h2><p>可选功能；只生成壁纸，不创建桌面窗口。</p></div></div>

          <div className={helper.connected ? "helper-card connected" : "helper-card"}>
            <span className="helper-icon">{helper.connected ? <Check size={17} /> : <Unplug size={17} />}</span>
            <span><strong>{helper.connected ? "桌面助手已连接" : "浏览器独立模式"}</strong><small>{helper.connected ? `版本 ${helper.version ?? "未知"} · ${helper.monitors.length} 块显示器` : "To-Do 可以独立使用；桌面壁纸需要本地助手。"}</small></span>
            <button onClick={onRefreshHelper} aria-label="重新检测"><RefreshCw size={14} /></button>
          </div>

          <button className="toggle-row" disabled={!helper.connected} onClick={() => patch({ desktopEnabled: !draft.desktopEnabled })}>
            <span className="setting-title"><Monitor size={17} /><span><strong>显示桌面计划</strong><small>生成壁纸，不覆盖普通应用</small></span></span>
            <i className={draft.desktopEnabled ? "toggle active" : "toggle"}><b /></i>
          </button>

          <div className="segmented">
            <button disabled={!helper.connected} className={draft.displayMode === "single" ? "active" : ""} onClick={() => patch({ displayMode: "single" })}>指定屏幕</button>
            <button disabled={!helper.connected} className={draft.displayMode === "all" ? "active" : ""} onClick={() => patch({ displayMode: "all" })}>全部屏幕</button>
          </div>

          <div className="monitor-list">
            {monitors.map((monitor) => (
              <button type="button" key={monitor.id} disabled={!helper.connected} className={activeMonitor.id === monitor.id ? "selected" : ""} onClick={() => patch({ selectedMonitorId: monitor.id })}>
                <Laptop size={17} />
                <span><strong>{monitor.name}</strong><small>{monitor.width} × {monitor.height}{monitor.primary ? " · 主屏幕" : ""}</small></span>
                <i>{monitor.index + 1}</i>
              </button>
            ))}
          </div>

          <div className="desktop-page-designer">
            <DesktopLayoutEditor monitor={activeMonitor} layout={layout} opacity={draft.opacity} onChange={(next) => patch({ layouts: { ...draft.layouts, [activeMonitor.id]: next } })} />
            <div className="range-heading"><span>计划卡片不透明度</span><strong>{Math.round(draft.opacity * 100)}%</strong></div>
            <input className="range" type="range" min="0.35" max="1" step="0.01" value={draft.opacity} onChange={(event) => patch({ opacity: Number(event.target.value) })} />
          </div>

          <button className="restore-wallpaper" disabled={!helper.connected} onClick={onRestoreWallpaper}><RotateCcw size={15} />恢复启用前的原壁纸</button>
          <p className="settings-footnote">任务保存在浏览器本地。本地助手只接收用于生成壁纸的快照。</p>
        </section>
      </div>
    </main>
  );
}
