import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Download, ExternalLink, Laptop, Monitor, RefreshCw, RotateCcw, Type, Unplug } from "lucide-react";
import type { AppSettings, HelperStatus, MonitorInfo } from "../types";
import { defaultBackground, type BackgroundPreferences } from "../backgroundModel";
import { defaultDesktopLayout, DesktopLayoutEditor } from "./DesktopLayoutEditor";
import { ShortcutPanel } from "./ShortcutPanel";
import { useNavigation } from "../useNavigation";
import { changeNavigation, changeNewTabPreferences, type NewTabPreferences } from "../navigation";
import { OverallStyleEditor, PrincipleStyleEditor } from "./AppearanceEditor";
import { SettingsNavigation, type SettingsSection } from "./SettingsNavigation";

interface Props {
  settings: AppSettings; helper: HelperStatus; initialSection?: SettingsSection; onPatch: (patch: Partial<AppSettings>) => void;
  onRefreshHelper: () => void; onRestoreWallpaper: () => void; onBack: () => void; onNavigate: (section: SettingsSection) => void;
  background: BackgroundPreferences; onBackgroundPatch: (patch: Partial<BackgroundPreferences>) => void;
  backgroundPage: ReactNode; preview?: ReactNode; status?: "saved" | "saving" | "error"; error?: string; onRetry?: () => void;
}
const previewMonitor: MonitorInfo = { id: "preview", index: 0, name: "显示器预览", x: 0, y: 0, width: 1920, height: 1080, primary: true };
const releasesUrl = "https://github.com/Always1010/SchedulePin/releases";
const titles: Record<SettingsSection, [string, string]> = {
  style: ["整体样式", "设置浏览器页面的默认主题、字体与布局。"], background: ["页面背景", "只影响新标签页的背景与壁纸。"],
  shortcuts: ["快捷导航", "管理常用网站、分组与导航位置。"], tasks: ["待办区域", "控制新标签页中的计划显示方式。"],
  principle: ["原则卡片", "管理 Principle 的内容和卡片样式。"],
  desktop: ["桌面展示", "连接桌面助手，并在同一处选择显示器和调整每块屏幕的计划布局。"],
};

export function SettingsPage({ settings, helper, initialSection = "style", onPatch, onRefreshHelper, onRestoreWallpaper, onBack, onNavigate, background, onBackgroundPatch, backgroundPage, preview, status = "saved", error, onRetry }: Props) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const { navigation, preferences, navigationReady, navigationError } = useNavigation();
  const [preferenceError, setPreferenceError] = useState("");
  useEffect(() => setSection(initialSection), [initialSection]);
  const choose = (next: SettingsSection) => { setSection(next); onNavigate(next); };
  const changePreferences = async (next: Partial<NewTabPreferences>) => { setPreferenceError(""); try { await changeNewTabPreferences(next); } catch { setPreferenceError("无法保存页面偏好，请重试。"); } };
  const monitors = helper.monitors.length ? helper.monitors : [previewMonitor];
  const activeMonitor = useMemo(() => monitors.find(monitor => monitor.id === settings.selectedMonitorId) ?? monitors[0], [monitors, settings.selectedMonitorId]);
  const [heading, description] = titles[section];
  const desktopDisabled = !helper.connected;
  return <main className="settings-page page-shell">
    <div className="page-title-row"><button type="button" className="back-button" onClick={onBack}>返回</button><div><span className="eyebrow">Settings</span><h1>{heading}</h1><p>{description}</p></div></div>
    <div className="settings-layout"><SettingsNavigation section={section} onSelect={choose} /><div className="settings-content">
      {status !== "saved" && <p className={`settings-status ${status === "error" ? "error" : ""}`} role={status === "error" ? "alert" : "status"}>{status === "saving" ? "正在保存修改…" : `${error || "保存失败，修改仍保留在当前页面。"}`} {status === "error" && onRetry && <button type="button" onClick={onRetry}>重试</button>}</p>}
      {section === "style" && <><OverallStyleEditor settings={settings} onPatch={onPatch} saving={status === "saving"} /><section className="settings-card settings-detail-card"><div className="settings-card-heading"><Type size={18}/><div><h2>新标签页覆盖</h2><p>只在新标签页需要与默认主题不同时使用。</p></div></div><div className="settings-detail-actions"><button type="button" className="restore-appearance" onClick={() => onBackgroundPatch({ appearance: defaultBackground.appearance, accent: defaultBackground.accent, panelOpacity: defaultBackground.panelOpacity })}><RotateCcw size={15}/>恢复新标签页覆盖默认值</button></div><label>明暗模式<select aria-label="新标签页明暗模式" value={background.appearance} onChange={event => onBackgroundPatch({ appearance: event.target.value as BackgroundPreferences["appearance"] })}><option value="inherit">使用整体样式</option><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></label><label>强调色<select aria-label="新标签页强调色" value={background.accent} onChange={event => onBackgroundPatch({ accent: event.target.value as BackgroundPreferences["accent"] })}><option value="original">使用整体样式</option><option value="auto">从壁纸取色</option><option value="green">青绿</option><option value="blue">海蓝</option><option value="violet">紫色</option><option value="orange">暖橙</option></select></label><div className="range-heading"><span>面板不透明度</span><strong>{background.panelOpacity}%</strong></div><input className="range" aria-label="面板不透明度" type="range" min="60" max="100" value={background.panelOpacity} onChange={event => onBackgroundPatch({ panelOpacity: Number(event.target.value) })}/><p className="field-help">恢复整体样式不会清除这里的单独覆盖。</p></section>{preview}</>}
      {section === "background" && backgroundPage}
      {section === "shortcuts" && <section className="settings-card settings-detail-card shortcut-settings"><div className="shortcut-settings-options"><label>导航位置<select aria-label="导航位置" value={preferences.side} disabled={!navigationReady} onChange={event => void changePreferences({ side: event.target.value as "left" | "right" })}><option value="left">左侧</option><option value="right">右侧</option></select></label><label><input type="checkbox" checked={preferences.showDomains} disabled={!navigationReady} onChange={event => void changePreferences({ showDomains: event.target.checked })} />显示网站简称（如 example）</label></div>{(navigationError || preferenceError) && <p role="alert">{navigationError || preferenceError}</p>}{navigationReady && <ShortcutPanel data={navigation} preferences={preferences} onAction={changeNavigation} onPreferences={changeNewTabPreferences}/>}</section>}
      {section === "tasks" && <section className="settings-card settings-detail-card"><div className="settings-card-heading"><Type size={18}/><div><h2>待办区域</h2><p>决定新标签页是否直接展示完整计划。</p></div></div><label className="toggle-row"><span className="setting-title"><span><strong>默认展示完整待办</strong><small>关闭后显示待办摘要，仍可随时展开完整待办</small></span></span><input className="visually-hidden" type="checkbox" checked={preferences.tasksVisible} disabled={!navigationReady} onChange={event => void changePreferences({ tasksVisible: event.target.checked })}/><i className={preferences.tasksVisible ? "toggle active" : "toggle"}><b/></i></label>{preferenceError && <p role="alert">{preferenceError}</p>}</section>}
      {section === "principle" && <><section className="settings-card settings-detail-card"><div className="settings-card-heading"><Type size={18}/><div><h2>Principle 内容</h2><p>内容和样式分开保存；换行会保留在新标签页和桌面计划中。</p></div></div><label className="toggle-row"><span className="setting-title"><span><strong>默认展开原则卡片</strong><small>打开新标签页时直接显示完整原则内容</small></span></span><input className="visually-hidden" type="checkbox" checked={preferences.principleExpanded} disabled={!navigationReady} onChange={event => void changePreferences({ principleExpanded: event.target.checked })}/><i className={preferences.principleExpanded ? "toggle active" : "toggle"}><b/></i></label><textarea className="settings-textarea principle-editor" rows={9} value={settings.principle} onChange={event => onPatch({ principle: event.target.value })} placeholder="写下做事时希望遵循的原则…"/><small className="field-help">内容即时保存。</small>{preferenceError && <p role="alert">{preferenceError}</p>}</section><PrincipleStyleEditor settings={settings} onPatch={onPatch} saving={status === "saving"} followBackground={background.principleFollow} onFollowChange={principleFollow => onBackgroundPatch({ principleFollow })}/>{preview}</>}
      {section === "desktop" && <section className="settings-card settings-detail-card desktop-settings-card">
        <div className={helper.connected ? "helper-card connected" : "helper-card"}><span className="helper-icon">{helper.connected ? <Check size={17}/> : <Unplug size={17}/>}</span><span><strong>{helper.connected ? "桌面助手已连接" : "浏览器独立模式"}</strong><small>{helper.connected ? `版本 ${helper.version ?? "未知"} · ${helper.monitors.length} 块显示器` : "桌面计划需要本地助手。"}</small></span><button onClick={onRefreshHelper} aria-label="重新检测"><RefreshCw size={14}/></button></div>
        {!helper.connected && <div className="release-download-card"><span><Download size={17}/></span><div><strong>下载 Windows 桌面助手</strong><small>从 GitHub Releases 获取最新版助手和安装说明。</small></div><a href={releasesUrl} target="_blank" rel="noreferrer">打开 Release <ExternalLink size={13}/></a></div>}
        <button className="toggle-row" disabled={desktopDisabled} onClick={() => onPatch({ desktopEnabled: !settings.desktopEnabled })}><span className="setting-title"><Monitor size={17}/><span><strong>显示桌面计划</strong><small>生成壁纸，不覆盖普通应用</small></span></span><i className={settings.desktopEnabled ? "toggle active" : "toggle"}><b/></i></button>
        <div className="desktop-settings-section"><div className="settings-card-heading"><Monitor size={18}/><div><h2>显示范围与布局</h2><p>先选择显示范围，再选择一块屏幕编辑它的布局。</p></div></div>
          <div className="segmented"><button disabled={desktopDisabled} className={settings.displayMode === "single" ? "active" : ""} onClick={() => onPatch({ displayMode: "single" })}>指定屏幕</button><button disabled={desktopDisabled} className={settings.displayMode === "all" ? "active" : ""} onClick={() => onPatch({ displayMode: "all" })}>全部屏幕</button></div>
          <div className="monitor-list">{monitors.map(monitor => <button type="button" key={monitor.id} disabled={desktopDisabled} className={activeMonitor.id === monitor.id ? "selected" : ""} onClick={() => onPatch({ selectedMonitorId: monitor.id })}><Laptop size={17}/><span><strong>{monitor.name}</strong><small>{monitor.width} × {monitor.height}{monitor.primary ? " · 主屏幕" : ""}</small></span><i>{monitor.index + 1}</i></button>)}</div>
          <div className="desktop-layout-heading"><strong>{activeMonitor.name} 的计划布局</strong><small>{settings.displayMode === "all" ? "全部屏幕模式下，每块屏幕分别保存布局。" : "拖动和缩放卡片，设置这块屏幕上的位置。"}</small></div>
          <div className="desktop-page-designer"><DesktopLayoutEditor monitor={activeMonitor} layout={settings.layouts[activeMonitor.id] ?? defaultDesktopLayout} settings={settings} onChange={next => onPatch({ layouts: { ...settings.layouts, [activeMonitor.id]: next } })}/><div className="range-heading"><span>计划卡片不透明度</span><strong>{Math.round(settings.opacity * 100)}%</strong></div><input className="range" aria-label="计划卡片不透明度" type="range" min="0.35" max="1" step="0.01" value={settings.opacity} onChange={event => onPatch({ opacity: Number(event.target.value) })}/></div>
        </div>
        <button className="restore-wallpaper" disabled={desktopDisabled} onClick={onRestoreWallpaper}><RotateCcw size={15}/>恢复启用前的原壁纸</button>
      </section>}
    </div></div>
  </main>;
}
