import { AlignJustify, ArrowLeft, Check, Monitor, RotateCcw, Save, Sidebar, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultSettings } from "../data";
import type { AppSettings, PlanItem } from "../types";
import { visualDesignStyle } from "../visualDesign";

interface Props {
  settings: AppSettings;
  items: PlanItem[];
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

const dateLabel = () => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

export function AppearanceEditor({ settings, items, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(settings);
  const [mode, setMode] = useState<"newtab" | "sidepanel">("newtab");
  const [saving, setSaving] = useState(false);
  const tasks = useMemo(() => items
    .filter((item) => item.kind === "task")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5), [items]);
  const completed = tasks.filter((item) => item.completed).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const appearanceClass = `theme-${draft.theme} font-${draft.fontFamily} principle-theme-${draft.principleTheme} principle-font-${draft.principleFontFamily} principle-style-${draft.principleTextStyle}`;

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
    await onSave(draft);
    setSaving(false);
  };

  return (
    <main className="appearance-editor-page">
      <header className="appearance-editor-header">
        <button type="button" className="back-button" onClick={onCancel}><ArrowLeft size={17} />取消</button>
        <div><span className="eyebrow">Live preview</span><h1>外观</h1><p>左侧调整，右侧即时查看真实页面效果。</p></div>
        <div className="appearance-editor-actions">
          <button type="button" className="reset-appearance" onClick={resetAppearance}><RotateCcw size={15} />恢复默认</button>
          <button type="button" className="save-appearance" disabled={saving} onClick={save}><Save size={15} />{saving ? "保存中…" : "保存"}</button>
        </div>
      </header>

      <div className="appearance-workspace">
        <aside className="appearance-controls">
          <section className="appearance-control-section">
            <div className="appearance-control-heading"><span>整体外观</span><small>页面与 To-Do</small></div>
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
              <button type="button" className={mode === "newtab" ? "active" : ""} onClick={() => setMode("newtab")}><Monitor size={14} />新标签页</button>
              <button type="button" className={mode === "sidepanel" ? "active" : ""} onClick={() => setMode("sidepanel")}><Sidebar size={14} />侧边栏</button>
            </div>
          </div>

          <div className={mode === "sidepanel" ? "preview-stage sidepanel-stage" : "preview-stage"}>
            <div
              className={`appearance-live-preview ${appearanceClass}${mode === "sidepanel" ? " compact-preview" : ""}`}
              style={{ ...visualDesignStyle(draft), "--font-scale": draft.fontScale, "--principle-font-scale": draft.principleFontScale, "--card-radius": `${draft.cardRadius}px` } as React.CSSProperties}
            >
              <div className="preview-appbar"><span className="preview-logo">✓</span><strong>SchedulePin</strong><small>{mode === "sidepanel" ? "浏览器侧边栏" : "To-Do · 新标签页"}</small></div>
              <div className="preview-page-content">
                <section className="preview-day">
                  <div><span>今天</span><h2>{dateLabel()}</h2></div>
                  <strong>{progress}%<small>{completed}/{tasks.length}</small></strong>
                </section>
                <section className="preview-principle"><small>HOW I WORK</small><h3>Principle</h3><p>{draft.principle || "在设置中写下希望长期遵循的做事原则。"}</p></section>
                <section className="preview-todos">
                  <div><h3>To-Do List</h3><small>按添加顺序排列</small></div>
                  {tasks.length ? tasks.map((item) => (
                    <article className={item.completed ? "completed" : ""} key={item.id}>
                      <i>⋮⋮</i><b>{item.completed ? "✓" : ""}</b><span>{item.title}<small>{item.startTime ? `${item.startTime}${item.endTime ? ` — ${item.endTime}` : ""}` : ""}</small></span>
                    </article>
                  )) : <p className="preview-empty">现在没有待办事项</p>}
                  <div className="preview-input">＋ 输入要做的事，按 Enter 添加…</div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
