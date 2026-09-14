import { useEffect, useState } from "react";
import { Laptop, Layers3, Monitor, Power, X } from "lucide-react";
import type { AppSettings, MonitorInfo } from "../types";

interface Props {
  open: boolean;
  settings: AppSettings;
  monitors: MonitorInfo[];
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ open, settings, monitors, onChange, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings, open]);
  if (!open) return null;

  const patch = (next: Partial<AppSettings>) => {
    const value = { ...draft, ...next };
    setDraft(value);
    onChange(value);
  };

  return (
    <aside className="settings-panel">
      <div className="settings-heading">
        <div><span className="eyebrow">SchedulePin</span><h2>桌面设置</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
      </div>

      <section className="settings-section">
        <div className="setting-title"><Monitor size={17} /><div><strong>显示位置</strong><small>选择计划板出现在哪块屏幕</small></div></div>
        <div className="segmented">
          <button className={draft.displayMode === "single" ? "active" : ""} onClick={() => patch({ displayMode: "single" })}>指定屏幕</button>
          <button className={draft.displayMode === "all" ? "active" : ""} onClick={() => patch({ displayMode: "all" })}>全部屏幕</button>
        </div>
        <div className="monitor-list">
          {monitors.map((monitor) => (
            <button key={monitor.index} className={draft.monitorIndex === monitor.index ? "selected" : ""} onClick={() => patch({ monitorIndex: monitor.index })}>
              <Laptop size={18} />
              <span><strong>{monitor.name || `显示器 ${monitor.index + 1}`}</strong><small>{monitor.width} × {monitor.height} · {Math.round(monitor.scaleFactor * 100)}%</small></span>
              <i>{monitor.index + 1}</i>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="desktop-mode-info">
          <Layers3 size={18} />
          <span><strong>桌面组件模式</strong><small>计划板属于桌面层；普通软件会盖住它，返回桌面时会自然出现。</small></span>
        </div>
        <button className="toggle-row" onClick={() => patch({ launchAtStartup: !draft.launchAtStartup })}>
          <span className="setting-title"><Power size={17} /><span><strong>开机自动启动</strong><small>登录 Windows 后显示今日计划</small></span></span>
          <i className={draft.launchAtStartup ? "toggle active" : "toggle"}><b /></i>
        </button>
      </section>

      <section className="settings-section">
        <div className="range-heading"><span>面板不透明度</span><strong>{Math.round(draft.opacity * 100)}%</strong></div>
        <input className="range" type="range" min="0.72" max="1" step="0.01" value={draft.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} />
      </section>

      <p className="settings-footnote">所有数据保存在本机。第一版不需要账号，也不会上传任务内容。</p>
    </aside>
  );
}
