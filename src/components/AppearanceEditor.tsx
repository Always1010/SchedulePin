import { AlignJustify, Check, Monitor, RectangleVertical, RotateCcw, Sidebar, Type } from "lucide-react";
import { useState } from "react";
import { defaultSettings } from "../data";
import { defaultBackground } from "../backgroundModel";
import type { AppSettings } from "../types";
import type { PlanItem } from "../types";
import type { NavigationData, NewTabPreferences } from "../navigation";
import type { BackgroundPreferences, Wallpaper } from "../backgroundModel";
import { AppearancePreview, type PreviewMode } from "./AppearancePreview";

const themes: Array<{ value: AppSettings["theme"]; label: string; color: string }> = [
  { value: "warm", label: "暖色", color: "#efe5dc" }, { value: "light", label: "明亮", color: "#edf3f1" },
  { value: "dark", label: "深色", color: "#25302b" }, { value: "system", label: "跟随系统", color: "linear-gradient(135deg,#edf3f1 50%,#25302b 50%)" },
];
const fonts: Array<{ value: AppSettings["fontFamily"]; label: string; sample: string }> = [
  { value: "system", label: "系统默认", sample: "Aa 计划" }, { value: "modern", label: "现代无衬线", sample: "Aa 计划" },
  { value: "reading", label: "阅读型", sample: "Aa 计划" }, { value: "rounded", label: "圆润", sample: "Aa 计划" },
];
const principleThemes: Array<{ value: AppSettings["principleTheme"]; label: string; color: string }> = [
  { value: "forest", label: "森林", color: "linear-gradient(135deg,#2c4038,#4c6258)" }, { value: "ink", label: "夜墨", color: "linear-gradient(135deg,#242936,#41495d)" },
  { value: "paper", label: "纸张", color: "linear-gradient(135deg,#fffaf1,#e8dac5)" }, { value: "sunset", label: "落日", color: "linear-gradient(135deg,#784038,#ad6751)" },
];
type CommonProps = { settings: AppSettings; onPatch: (patch: Partial<AppSettings>) => void; saving?: boolean };

export function OverallStyleEditor({ settings, onPatch, saving }: CommonProps) {
  const restore = () => onPatch({ theme: defaultSettings.theme, fontFamily: defaultSettings.fontFamily, fontScale: defaultSettings.fontScale, density: defaultSettings.density, densityLevel: defaultSettings.densityLevel, cardRadius: defaultSettings.cardRadius });
  return <section className="settings-card settings-detail-card appearance-controls">
    <div className="settings-card-heading"><Type size={18} /><div><h2>整体样式</h2><p>作为浏览器页面的默认样式；桌面计划也会同步使用字体和主题。</p></div></div>
    <div className="settings-detail-actions"><button type="button" className="restore-appearance" disabled={saving} onClick={restore}><RotateCcw size={15} />恢复整体样式默认值</button></div>
    <label className="settings-control-label">页面主题</label><div className="theme-options">{themes.map(theme => <button type="button" key={theme.value} className={settings.theme === theme.value ? "selected" : ""} onClick={() => onPatch({ theme: theme.value })}><i style={{ background: theme.color }} />{theme.label}{settings.theme === theme.value && <Check size={14} />}</button>)}</div>
    <label className="settings-control-label"><Type size={14} />默认字体</label><div className="font-options">{fonts.map(font => <button type="button" key={font.value} aria-label={font.label} data-font={font.value} className={settings.fontFamily === font.value ? "selected" : ""} onClick={() => onPatch({ fontFamily: font.value })}><strong>{font.sample}</strong><small>{font.label}</small></button>)}</div>
    <Range label="默认文字大小" value={`${Math.round(settings.fontScale * 100)}%`} min="0.85" max="1.25" step="0.05" current={settings.fontScale} onChange={fontScale => onPatch({ fontScale })} />
    <div className="range-heading density-range-heading"><span><AlignJustify size={14} />布局间距</span><strong>{Math.round(settings.densityLevel)}%</strong></div><input className="range density-range" aria-label="布局间距" type="range" min="0" max="100" step="5" value={settings.densityLevel} onChange={event => { const densityLevel = Number(event.target.value); onPatch({ densityLevel, density: densityLevel < 34 ? "compact" : densityLevel > 66 ? "spacious" : "comfortable" }); }} /><div className="range-scale"><span>更紧凑</span><span>更宽松</span></div>
    <Range label="卡片圆角" value={`${settings.cardRadius}px`} min="8" max="30" step="1" current={settings.cardRadius} onChange={cardRadius => onPatch({ cardRadius })} />
    <p className="field-help">修改会立即应用并保存。下方可为新标签页单独覆盖明暗模式与强调色。</p>
  </section>;
}

export function PrincipleStyleEditor({ settings, onPatch, saving, followBackground, onFollowChange }: CommonProps & { followBackground: boolean; onFollowChange: (follow: boolean) => void }) {
  const restore = () => { onPatch({ principleTheme: defaultSettings.principleTheme, principleFontFamily: defaultSettings.principleFontFamily, principleFontScale: defaultSettings.principleFontScale, principleTextStyle: defaultSettings.principleTextStyle }); onFollowChange(defaultBackground.principleFollow); };
  return <section className="settings-card settings-detail-card appearance-controls">
    <div className="settings-card-heading"><Type size={18} /><div><h2>卡片样式</h2><p>只影响 Principle 卡片；不改变文字内容。</p></div></div>
    <div className="settings-detail-actions"><button type="button" className="restore-appearance" disabled={saving} onClick={restore}><RotateCcw size={15} />恢复卡片样式默认值</button></div>
    <label className="toggle-row"><span className="setting-title"><span><strong>跟随页面背景配色</strong><small>使用背景的强调色生成卡片颜色</small></span></span><input className="visually-hidden" type="checkbox" checked={followBackground} onChange={event => onFollowChange(event.target.checked)} /><i className={followBackground ? "toggle active" : "toggle"}><b /></i></label>
    {followBackground ? <p className="appearance-draft-hint">新标签页的卡片颜色由背景配色控制；侧边栏与桌面计划仍使用下面保留的独立文字样式和主题。</p> : <><label className="settings-control-label">卡片主题</label><div className="theme-options">{principleThemes.map(theme => <button type="button" key={theme.value} className={settings.principleTheme === theme.value ? "selected" : ""} onClick={() => onPatch({ principleTheme: theme.value })}><i style={{ background: theme.color }} />{theme.label}{settings.principleTheme === theme.value && <Check size={14} />}</button>)}</div></>}
    <>
      <label className="settings-control-label"><Type size={14} />卡片字体</label><div className="font-options">{fonts.map(font => <button type="button" key={font.value} aria-label={font.label} data-font={font.value} className={settings.principleFontFamily === font.value ? "selected" : ""} onClick={() => onPatch({ principleFontFamily: font.value })}><strong>{font.sample}</strong><small>{font.label}</small></button>)}</div>
      <Range label="卡片文字大小" value={`${Math.round(settings.principleFontScale * 100)}%`} min="0.75" max="1.6" step="0.05" current={settings.principleFontScale} onChange={principleFontScale => onPatch({ principleFontScale })} />
      <label className="settings-control-label">文字样式</label><div className="principle-style-options segmented">{(["regular", "medium", "bold"] as const).map(value => <button type="button" key={value} className={settings.principleTextStyle === value ? "active" : ""} onClick={() => onPatch({ principleTextStyle: value })}>{{ regular: "常规", medium: "醒目", bold: "加粗" }[value]}</button>)}</div>
    </>
  </section>;
}
export function AppearancePreviewControls({ settings, tasks, navigation, preferences, background, wallpaper }: { settings: AppSettings; tasks: PlanItem[]; navigation: NavigationData; preferences: NewTabPreferences; background: BackgroundPreferences; wallpaper?: Wallpaper }) {
  const [mode, setMode] = useState<PreviewMode>("newtab");
  return <section className="settings-card settings-detail-card settings-live-preview"><div className="settings-card-heading"><Monitor size={18}/><div><h2>即时预览</h2><p>预览会随当前修改更新，不会额外保存设置。</p></div></div><div className="preview-mode-switch" aria-label="预览尺寸">{([['newtab', '横屏', Monitor], ['portrait', '竖屏', RectangleVertical], ['sidepanel', '侧边栏', Sidebar]] as const).map(([value, label, Icon]) => <button type="button" key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}><Icon size={14}/>{label}</button>)}</div><AppearancePreview settings={settings} tasks={tasks} navigation={navigation} preferences={preferences} mode={mode} background={background} wallpaper={wallpaper}/></section>;
}
function Range({ label, value, min, max, step, current, onChange }: { label: string; value: string; min: string; max: string; step: string; current: number; onChange: (value: number) => void }) {
  return <><div className="range-heading"><span>{label}</span><strong>{value}</strong></div><input className="range" aria-label={label} type="range" min={min} max={max} step={step} value={current} onChange={event => onChange(Number(event.target.value))} /></>;
}
