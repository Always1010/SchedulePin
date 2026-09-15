import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, ChevronRight, Download, ExternalLink, Laptop,
  Monitor, Palette, RefreshCw, RotateCcw, Type, Unplug,
} from "lucide-react";
import type { AppSettings, HelperStatus, MonitorInfo } from "../types";
import { defaultDesktopLayout, DesktopLayoutEditor } from "./DesktopLayoutEditor";

interface Props {
  settings: AppSettings;
  helper: HelperStatus;
  initialSection?: SettingsSection;
  onChange: (settings: AppSettings) => void;
  onRefreshHelper: () => void;
  onRestoreWallpaper: () => void;
  onOpenAppearance: () => void;
  onBack: () => void;
}

type SettingsSection = "hub" | "principle" | "desktop";

const previewMonitor: MonitorInfo = {
  id: "preview", index: 0, name: "显示器预览", x: 0, y: 0,
  width: 1920, height: 1080, primary: true,
};
const releasesUrl = "https://github.com/Always1010/SchedulePin/releases";

export function SettingsPage({ settings, helper, initialSection = "hub", onChange, onRefreshHelper, onRestoreWallpaper, onOpenAppearance, onBack }: Props) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => setSection(initialSection), [initialSection]);

  const monitors = helper.monitors.length ? helper.monitors : [previewMonitor];
  const activeMonitor = useMemo(() => monitors.find((monitor) => monitor.id === draft.selectedMonitorId) ?? monitors[0], [monitors, draft.selectedMonitorId]);
  const patch = (next: Partial<AppSettings>) => {
    const value = { ...draft, ...next };
    setDraft(value);
    onChange(value);
  };
  const layout = draft.layouts[activeMonitor.id] ?? defaultDesktopLayout;
  const goBack = () => {
    if (section === "hub" || initialSection !== "hub") onBack();
    else setSection("hub");
  };

  return (
    <main className="settings-page page-shell">
      <div className="page-title-row">
        <button type="button" className="back-button" onClick={goBack}><ArrowLeft size={17} />返回</button>
        <div><span className="eyebrow">Settings</span><h1>{section === "hub" ? "设置" : section === "principle" ? "Principle" : "桌面展示"}</h1><p>{section === "hub" ? "选择需要调整的部分。" : section === "principle" ? "编辑长期遵循的做事原则。" : "配置壁纸、显示器和桌面助手。"}</p></div>
      </div>

      {section === "hub" && (
        <div className="settings-hub">
          <button type="button" className="settings-hub-card appearance-entry" onClick={onOpenAppearance}>
            <span className="hub-icon"><Palette size={21} /></span>
            <div><h2>外观</h2><p>调整页面整体外观，并单独定制 Principle。</p><span className="appearance-summary"><i /><i /><i />{Math.round(draft.fontScale * 100)}% · {draft.cardRadius}px</span></div>
            <ChevronRight size={18} />
          </button>
          <button type="button" className="settings-hub-card" onClick={() => setSection("principle")}>
            <span className="hub-icon"><Type size={21} /></span>
            <div><h2>Principle</h2><p>编辑显示在主页顶部的原则段落。</p><span className="hub-preview-text">{draft.principle || "尚未填写 Principle"}</span></div>
            <ChevronRight size={18} />
          </button>
          <button type="button" className="settings-hub-card desktop-entry" onClick={() => setSection("desktop")}>
            <span className="hub-icon"><Monitor size={21} /></span>
            <div><h2>桌面展示</h2><p>桌面助手、显示器、位置、大小与透明度。</p><span className={helper.connected ? "hub-status connected" : "hub-status"}>{helper.connected ? `已连接 · ${helper.monitors.length} 块显示器` : "浏览器独立模式"}</span></div>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {section === "principle" && (
        <section className="settings-card settings-detail-card">
          <div className="settings-card-heading"><Type size={18} /><div><h2>Principle</h2><p>作为一段完整文字展示，不参与完成度。</p></div></div>
          <textarea className="settings-textarea principle-editor" rows={9} value={draft.principle} onChange={(event) => patch({ principle: event.target.value })} placeholder="写下做事时希望遵循的原则……" />
          <small className="field-help">内容即时保存。换行会被保留，桌面壁纸会自动折行。</small>
        </section>
      )}

      {section === "desktop" && (
        <section className="settings-card settings-detail-card desktop-settings-card">
          <div className={helper.connected ? "helper-card connected" : "helper-card"}>
            <span className="helper-icon">{helper.connected ? <Check size={17} /> : <Unplug size={17} />}</span>
            <span><strong>{helper.connected ? "桌面助手已连接" : "浏览器独立模式"}</strong><small>{helper.connected ? `版本 ${helper.version ?? "未知"} · ${helper.monitors.length} 块显示器` : "To-Do 可以独立使用；桌面壁纸需要本地助手。"}</small></span>
            <button onClick={onRefreshHelper} aria-label="重新检测"><RefreshCw size={14} /></button>
          </div>
          {!helper.connected && (
            <div className="release-download-card">
              <span><Download size={17} /></span>
              <div><strong>下载 Windows 桌面助手</strong><small>从 GitHub Releases 获取最新版助手和安装说明。</small></div>
              <a href={releasesUrl} target="_blank" rel="noreferrer">打开 Release <ExternalLink size={13} /></a>
            </div>
          )}

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
                <Laptop size={17} /><span><strong>{monitor.name}</strong><small>{monitor.width} × {monitor.height}{monitor.primary ? " · 主屏幕" : ""}</small></span><i>{monitor.index + 1}</i>
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
      )}
    </main>
  );
}
