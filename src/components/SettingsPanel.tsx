import { useEffect, useMemo, useState } from "react";
import { Check, Laptop, Monitor, RefreshCw, RotateCcw, Unplug, X } from "lucide-react";
import type { AppSettings, HelperStatus, MonitorInfo } from "../types";
import { defaultDesktopLayout, DesktopLayoutEditor } from "./DesktopLayoutEditor";

interface Props {
  open: boolean;
  settings: AppSettings;
  helper: HelperStatus;
  onChange: (settings: AppSettings) => void;
  onRefreshHelper: () => void;
  onRestoreWallpaper: () => void;
  onClose: () => void;
}

const previewMonitor: MonitorInfo = {
  id: "preview", index: 0, name: "显示器预览", x: 0, y: 0,
  width: 1920, height: 1080, primary: true,
};

export function SettingsPanel({ open, settings, helper, onChange, onRefreshHelper, onRestoreWallpaper, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings, open]);

  const monitors = helper.monitors.length ? helper.monitors : [previewMonitor];
  const activeMonitor = useMemo(() => monitors.find((monitor) => monitor.id === draft.selectedMonitorId) ?? monitors[0], [monitors, draft.selectedMonitorId]);
  if (!open) return null;

  const patch = (next: Partial<AppSettings>) => {
    const value = { ...draft, ...next };
    setDraft(value);
    onChange(value);
  };
  const layout = draft.layouts[activeMonitor.id] ?? defaultDesktopLayout;

  return (
    <aside className="settings-panel extension-settings">
      <div className="settings-heading">
        <div><span className="eyebrow">SchedulePin</span><h2>设置</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
      </div>

      <section className="settings-section">
        <label className="settings-textarea-label" htmlFor="principle"><strong>Principle</strong><small>作为一段完整文字显示，不参与任务完成度。</small></label>
        <textarea id="principle" className="settings-textarea" rows={5} value={draft.principle} onChange={(event) => patch({ principle: event.target.value })} placeholder="写下做事时希望遵循的原则……" />
      </section>

      <section className="settings-section">
        <div className={helper.connected ? "helper-card connected" : "helper-card"}>
          <span className="helper-icon">{helper.connected ? <Check size={17} /> : <Unplug size={17} />}</span>
          <span><strong>{helper.connected ? "桌面助手已连接" : "浏览器独立模式"}</strong><small>{helper.connected ? `版本 ${helper.version ?? "未知"} · ${helper.monitors.length} 块显示器` : "任务管理可以正常使用；桌面壁纸功能需要可选助手。"}</small></span>
          <button onClick={onRefreshHelper} aria-label="重新检测"><RefreshCw size={14} /></button>
        </div>
        {!helper.connected && <p className="install-hint">安装桌面助手后，这里会自动解锁 Windows 壁纸同步。开发版请先运行项目提供的助手安装脚本。</p>}
      </section>

      <section className="settings-section">
        <button className="toggle-row" disabled={!helper.connected} onClick={() => patch({ desktopEnabled: !draft.desktopEnabled })}>
          <span className="setting-title"><Monitor size={17} /><span><strong>显示桌面计划</strong><small>生成壁纸，不创建任何桌面窗口</small></span></span>
          <i className={draft.desktopEnabled ? "toggle active" : "toggle"}><b /></i>
        </button>

        <div className="segmented">
          <button disabled={!helper.connected} className={draft.displayMode === "single" ? "active" : ""} onClick={() => patch({ displayMode: "single" })}>指定屏幕</button>
          <button disabled={!helper.connected} className={draft.displayMode === "all" ? "active" : ""} onClick={() => patch({ displayMode: "all" })}>全部屏幕</button>
        </div>

        <div className="monitor-list">
          {monitors.map((monitor) => (
            <button key={monitor.id} disabled={!helper.connected} className={activeMonitor.id === monitor.id ? "selected" : ""} onClick={() => patch({ selectedMonitorId: monitor.id })}>
              <Laptop size={17} />
              <span><strong>{monitor.name}</strong><small>{monitor.width} × {monitor.height}{monitor.primary ? " · 主屏幕" : ""}</small></span>
              <i>{monitor.index + 1}</i>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section designer-section">
        <div className="setting-title"><Monitor size={17} /><div><strong>壁纸布局</strong><small>在浏览器里完成移动和缩放</small></div></div>
        <DesktopLayoutEditor
          monitor={activeMonitor}
          layout={layout}
          opacity={draft.opacity}
          onChange={(next) => patch({ layouts: { ...draft.layouts, [activeMonitor.id]: next } })}
        />
        <div className="range-heading"><span>计划卡片不透明度</span><strong>{Math.round(draft.opacity * 100)}%</strong></div>
        <input className="range" type="range" min="0.35" max="1" step="0.01" value={draft.opacity} onChange={(event) => patch({ opacity: Number(event.target.value) })} />
      </section>

      <button className="restore-wallpaper" disabled={!helper.connected} onClick={onRestoreWallpaper}><RotateCcw size={15} />恢复启用前的原壁纸</button>
      <p className="settings-footnote">任务保存在浏览器本地。本地助手只接收用于生成壁纸的快照，不负责修改任务。</p>
    </aside>
  );
}
