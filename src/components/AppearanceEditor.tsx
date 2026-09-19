import { AlignJustify, ArrowLeft, Check, Monitor, RectangleVertical, RotateCcw, Save, Sidebar, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultSettings } from "../data";
import type { AppSettings, PlanItem } from "../types";
import { AppearancePreview, type PreviewMode } from "./AppearancePreview";
import type { NavigationData, NewTabPreferences } from "../navigation";
import "./appearance-preview.css";

interface Props {
  settings: AppSettings;
  items: PlanItem[];
  navigation: NavigationData;
  preferences: NewTabPreferences;
  onSave: (settings: AppSettings) => Promise<void>;
  onCancel: () => void;
}

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

const principleThemes: Array<{ value: AppSettings["principleTheme"]; label: string; color: string }> = [
  { value: "forest", label: "森林", color: "linear-gradient(135deg,#2c4038,#4c6258)" },
  { value: "ink", label: "夜墨", color: "linear-gradient(135deg,#242936,#41495d)" },
  { value: "paper", label: "纸张", color: "linear-gradient(135deg,#fffaf1,#e8dac5)" },
  { value: "sunset", label: "落日", color: "linear-gradient(135deg,#784038,#ad6751)" },
];


export function AppearanceEditor({ settings, items, navigation, preferences, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(settings);
  const [mode, setMode] = useState<PreviewMode>("newtab");
  const [saving, setSaving] = useState(false);
  const tasks = useMemo(() => items
    .filter((item) => item.kind === "task")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)), [items]);
  const [error, setError] = useState("");

  const resetAppearance = () => setDraft((current) => ({
    ...current,
    theme: defaultSettings.theme,
    fontFamily: defaultSettings.fontFamily,
    fontScale: defaultSettings.fontScale,
    density: defaultSettings.density,
    densityLevel: defaultSettings.densityLevel,
    cardRadius: defaultSettings.cardRadius,
    principleTheme: defaultSettings.principleTheme,
    principleFontFamily: defaultSettings.principleFontFamily,
    principleFontScale: defaultSettings.principleFontScale,
    principleTextStyle: defaultSettings.principleTextStyle,
  }));

  const save = async () => {
    setSaving(true);
    setError("");
    try { await onSave(draft); }
    catch { setError("外观保存失败，草稿已保留，请重试。"); }
    finally { setSaving(false); }
  };

  return (
    <main className="appearance-editor-page">
      <header className="appearance-editor-header">
        <button type="button" className="back-button" disabled={saving} onClick={onCancel}><ArrowLeft size={17} />取消</button>
        <div><span className="eyebrow">Live preview</span><h1>外观</h1><p>调整主题与排版，预览横屏、竖屏和侧边栏。</p></div>
        <div className="appearance-editor-actions">
          <button type="button" className="reset-appearance" disabled={saving} onClick={resetAppearance}><RotateCcw size={15} />恢复默认</button>
          <button type="button" className="save-appearance" disabled={saving} onClick={save}><Save size={15} />{saving ? "保存中…" : "保存"}</button>
        </div>
      </header>

      {error && <p role="alert" className="shortcut-error">{error}</p>}
      <div className="appearance-workspace">
        <aside className="appearance-controls">
          <section className="appearance-control-section">
            <div className="appearance-control-heading"><span>整体外观</span><small>导航与计划区域</small></div>
            <label className="settings-control-label">页面主题</label>
            <div className="theme-options">
              {themes.map((theme) => (
                <button type="button" key={theme.value} className={draft.theme === theme.value ? "selected" : ""} onClick={() => setDraft({ ...draft, theme: theme.value })}>
                  <i style={{ background: theme.color }} />{theme.label}{draft.theme === theme.value && <Check size={14} />}
                </button>
              ))}
            </div>

            <label className="settings-control-label"><Type size={14} />全局字体</label>
            <div className="font-options">
              {fonts.map((font) => (
                <button type="button" key={font.value} data-font={font.value} className={draft.fontFamily === font.value ? "selected" : ""} onClick={() => setDraft({ ...draft, fontFamily: font.value })}>
                  <strong>{font.sample}</strong><small>{font.label}</small>
                </button>
              ))}
            </div>

            <div className="range-heading"><span>全局文字大小</span><strong>{Math.round(draft.fontScale * 100)}%</strong></div>
            <input className="range" type="range" min="0.85" max="1.25" step="0.05" value={draft.fontScale} onChange={(event) => setDraft({ ...draft, fontScale: Number(event.target.value) })} />

            <div className="range-heading density-range-heading"><span><AlignJustify size={14} />布局间距</span><strong>{Math.round(draft.densityLevel)}%</strong></div>
            <input className="range density-range" type="range" min="0" max="100" step="5" value={draft.densityLevel} onChange={(event) => {
              const densityLevel = Number(event.target.value);
              const density = densityLevel < 34 ? "compact" : densityLevel > 66 ? "spacious" : "comfortable";
              setDraft({ ...draft, density, densityLevel });
            }} aria-label="布局间距" />
            <div className="range-scale" aria-hidden="true"><span>更紧凑</span><span>更宽松</span></div>

            <div className="range-heading"><span>卡片圆角</span><strong>{draft.cardRadius}px</strong></div>
            <input className="range" type="range" min="8" max="30" step="1" value={draft.cardRadius} onChange={(event) => setDraft({ ...draft, cardRadius: Number(event.target.value) })} />
          </section>

          <section className="appearance-control-section principle-appearance-controls">
            <div className="appearance-control-heading"><span>Principle 外观</span><small>仅影响原则卡片</small></div>
            <label className="settings-control-label">背景主题</label>
            <div className="theme-options">
              {principleThemes.map((theme) => (
                <button type="button" key={theme.value} className={draft.principleTheme === theme.value ? "selected" : ""} onClick={() => setDraft({ ...draft, principleTheme: theme.value })}>
                  <i style={{ background: theme.color }} />{theme.label}{draft.principleTheme === theme.value && <Check size={14} />}
                </button>
              ))}
            </div>

            <label className="settings-control-label"><Type size={14} />Principle 字体</label>
            <div className="font-options">
              {fonts.map((font) => (
                <button type="button" key={font.value} data-font={font.value} className={draft.principleFontFamily === font.value ? "selected" : ""} onClick={() => setDraft({ ...draft, principleFontFamily: font.value })}>
                  <strong>{font.sample}</strong><small>{font.label}</small>
                </button>
              ))}
            </div>

            <div className="range-heading"><span>Principle 文字大小</span><strong>{Math.round(draft.principleFontScale * 100)}%</strong></div>
            <input className="range" type="range" min="0.75" max="1.6" step="0.05" value={draft.principleFontScale} onChange={(event) => setDraft({ ...draft, principleFontScale: Number(event.target.value) })} />

            <label className="settings-control-label">文字样式</label>
            <div className="principle-style-options segmented">
              {(["regular", "medium", "bold"] as const).map((value) => (
                <button type="button" key={value} className={draft.principleTextStyle === value ? "active" : ""} onClick={() => setDraft({ ...draft, principleTextStyle: value })}>
                  {{ regular: "常规", medium: "醒目", bold: "加粗" }[value]}
                </button>
              ))}
            </div>
          </section>
          <p className="appearance-draft-hint">这里的变化只影响预览。点击“保存”后才会应用到 SchedulePin。</p>
        </aside>

        <section className="appearance-preview-area">
          <div className="preview-toolbar">
            <strong>实时预览</strong>
            <div className="preview-mode-switch">
              <button type="button" className={mode === "newtab" ? "active" : ""} onClick={() => setMode("newtab")}><Monitor size={14} />横屏</button>
              <button type="button" className={mode === "portrait" ? "active" : ""} onClick={() => setMode("portrait")}><RectangleVertical size={14} />竖屏</button>
              <button type="button" className={mode === "sidepanel" ? "active" : ""} onClick={() => setMode("sidepanel")}><Sidebar size={14} />侧边栏</button>
            </div>
          </div>

          <AppearancePreview settings={draft} tasks={tasks} navigation={navigation} preferences={preferences} mode={mode} />
        </section>
      </div>
    </main>
  );
}
