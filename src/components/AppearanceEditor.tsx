import { AlignJustify, ArrowLeft, Check, Monitor, RotateCcw, Save, Sidebar, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultSettings } from "../data";
import type { AppSettings, PlanItem } from "../types";

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
  const appearanceClass = `theme-${draft.theme} font-${draft.fontFamily} density-${draft.density}`;

  const resetAppearance = () => setDraft((current) => ({
    ...current,
    theme: defaultSettings.theme,
    fontFamily: defaultSettings.fontFamily,
    fontScale: defaultSettings.fontScale,
    density: defaultSettings.density,
    cardRadius: defaultSettings.cardRadius,
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
          <label className="settings-control-label">主题</label>
          <div className="theme-options">
            {themes.map((theme) => (
              <button type="button" key={theme.value} className={draft.theme === theme.value ? "selected" : ""} onClick={() => setDraft({ ...draft, theme: theme.value })}>
                <i style={{ background: theme.color }} />{theme.label}{draft.theme === theme.value && <Check size={14} />}
              </button>
            ))}
          </div>

          <label className="settings-control-label"><Type size={14} />字体</label>
          <div className="font-options">
            {fonts.map((font) => (
              <button type="button" key={font.value} data-font={font.value} className={draft.fontFamily === font.value ? "selected" : ""} onClick={() => setDraft({ ...draft, fontFamily: font.value })}>
                <strong>{font.sample}</strong><small>{font.label}</small>
              </button>
            ))}
          </div>

          <div className="range-heading"><span>文字大小</span><strong>{Math.round(draft.fontScale * 100)}%</strong></div>
          <input className="range" type="range" min="0.85" max="1.25" step="0.05" value={draft.fontScale} onChange={(event) => setDraft({ ...draft, fontScale: Number(event.target.value) })} />

          <label className="settings-control-label"><AlignJustify size={14} />界面密度</label>
          <div className="density-options segmented">
            {(["compact", "comfortable", "spacious"] as const).map((value) => (
              <button type="button" key={value} className={draft.density === value ? "active" : ""} onClick={() => setDraft({ ...draft, density: value })}>
                {{ compact: "紧凑", comfortable: "标准", spacious: "宽松" }[value]}
              </button>
            ))}
          </div>

          <div className="range-heading"><span>卡片圆角</span><strong>{draft.cardRadius}px</strong></div>
          <input className="range" type="range" min="8" max="30" step="1" value={draft.cardRadius} onChange={(event) => setDraft({ ...draft, cardRadius: Number(event.target.value) })} />
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
              style={{ "--font-scale": draft.fontScale, "--card-radius": `${draft.cardRadius}px` } as React.CSSProperties}
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
