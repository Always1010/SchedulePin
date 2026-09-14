import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck, Check, ChevronRight, Clock3, Flame, Focus, GripVertical,
  ListTodo, Plus, Settings, Sparkles, StickyNote, Trash2, X,
} from "lucide-react";
import { AddItemDialog } from "./components/AddItemDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { createItem, loadItems, loadSettings, removeItem, saveSettings, setCompleted, todayKey } from "./data";
import type { AppSettings, DesktopConfiguration, MonitorInfo, NewPlanItem, PlanItem } from "./types";

const isTauri = () => "__TAURI_INTERNALS__" in window;
const compact = new URLSearchParams(location.search).has("panel");

const dateLabel = (date: Date) => new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long",
}).format(date);

function CheckButton({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return <button className={checked ? "check-button checked" : "check-button"} onClick={onClick} aria-label={checked ? "标记为未完成" : "标记为完成"}>{checked && <Check size={14} strokeWidth={3} />}</button>;
}

function TaskRow({ item, onToggle, onDelete }: { item: PlanItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <article className={item.completed ? "task-row completed" : "task-row"}>
      <GripVertical className="grip" size={15} />
      <CheckButton checked={item.completed} onClick={onToggle} />
      <div className="task-copy">
        <strong>{item.title}</strong>
        {(item.startTime || item.endTime) && <span><Clock3 size={13} />{item.startTime || "--:--"}{item.endTime ? ` — ${item.endTime}` : ""}</span>}
      </div>
      <span className={`priority priority-${item.priority}`}>{item.priority === 3 ? "重点" : item.priority === 2 ? "重要" : ""}</span>
      <button className="delete-button" onClick={onDelete} aria-label="删除"><Trash2 size={14} /></button>
    </article>
  );
}

export default function App() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [desktopState, setDesktopState] = useState<DesktopConfiguration | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([{ index: 0, name: "当前显示器", x: 0, y: 0, width: screen.width, height: screen.height, scaleFactor: devicePixelRatio }]);
  const nativeInitialized = useRef(false);
  const today = todayKey();

  const refresh = useCallback(async () => {
    try { setItems(await loadItems(today)); }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener("storage", sync);
    window.addEventListener("schedulepin-data", sync);
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      import("@tauri-apps/api/event").then(({ listen }) => listen("schedulepin://data-changed", sync)).then((fn) => { unlisten = fn; });
    }
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("schedulepin-data", sync); unlisten?.(); };
  }, [refresh]);

  useEffect(() => {
    if (!isTauri() || nativeInitialized.current) return;
    nativeInitialized.current = true;
    const initializeDesktop = async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const available = await invoke<MonitorInfo[]>("list_monitors");
      setMonitors(available);
      const result = await invoke<DesktopConfiguration>("configure_windows", { settings: {
        displayMode: settings.displayMode,
        monitorIndex: settings.monitorIndex,
      }});
      setDesktopState(result);
    };
    initializeDesktop().catch((error) => console.warn("Could not connect to desktop", error));
  }, [settings.displayMode, settings.monitorIndex]);

  const broadcast = async () => {
    if (!isTauri()) return;
    const { emit } = await import("@tauri-apps/api/event");
    await emit("schedulepin://data-changed");
  };

  const toggle = async (item: PlanItem) => {
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row));
    await setCompleted(item.id, today, !item.completed);
    await broadcast();
  };

  const remove = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    await removeItem(id);
    await broadcast();
  };

  const add = async (input: NewPlanItem) => {
    const created = await createItem(input);
    setItems((current) => [...current, created]);
    await broadcast();
  };

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
    if (!isTauri()) return;
    try {
      const [{ invoke }, autostart] = await Promise.all([
        import("@tauri-apps/api/core"), import("@tauri-apps/plugin-autostart"),
      ]);
      const result = await invoke<DesktopConfiguration>("configure_windows", { settings: {
        displayMode: next.displayMode,
        monitorIndex: next.monitorIndex,
      }});
      setDesktopState(result);
      const enabled = await autostart.isEnabled();
      if (next.launchAtStartup && !enabled) await autostart.enable();
      if (!next.launchAtStartup && enabled) await autostart.disable();
    } catch (error) { console.warn("Could not apply desktop setting", error); }
  };

  const quit = async () => {
    if (!isTauri()) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit_app");
  };

  const tasks = useMemo(() => items.filter((item) => item.kind === "task").sort((a, b) => b.priority - a.priority || (a.startTime || "99:99").localeCompare(b.startTime || "99:99")), [items]);
  const disciplines = items.filter((item) => item.kind === "discipline");
  const notes = items.filter((item) => item.kind === "note");
  const trackable = [...tasks, ...disciplines];
  const completed = trackable.filter((item) => item.completed).length;
  const progress = trackable.length ? Math.round(completed / trackable.length * 100) : 0;
  const focusTasks = tasks.slice(0, 3);

  return (
    <div className={compact ? "app compact" : "app"} style={{ "--panel-opacity": settings.opacity } as React.CSSProperties}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><CalendarCheck size={19} /></span><span className="brand-copy"><strong>SchedulePin</strong><small className={desktopState ? "desktop-status ready" : "desktop-status"}>{isTauri() ? desktopState ? `桌面已连接 · ${desktopState.attachedWindows} 屏` : "正在连接桌面…" : "界面预览"}</small></span></div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="设置"><Settings size={18} /></button>
          <button className="icon-button close-control" onClick={quit} aria-label="退出"><X size={17} /></button>
        </div>
      </header>

      <main>
        <section className="day-hero">
          <div>
            <span className="eyebrow">今天</span>
            <h1>{dateLabel(new Date())}</h1>
            <p>{progress === 100 && trackable.length ? "今天的承诺都兑现了。" : progress >= 50 ? "已经过半，继续保持节奏。" : "把注意力留给真正重要的事。"}</p>
          </div>
          <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{progress}%</strong><span>{completed}/{trackable.length}</span></div>
          </div>
        </section>

        <section className="focus-card">
          <div className="section-heading">
            <div><span className="section-icon coral"><Focus size={16} /></span><div><h2>今日重点</h2><p>最多只盯住三件事</p></div></div>
            <button onClick={() => setAddOpen(true)}><Plus size={16} />添加</button>
          </div>
          <div className="task-list">
            {loading ? <div className="empty">正在打开今天的计划…</div> : focusTasks.length ? focusTasks.map((item) => <TaskRow key={item.id} item={item} onToggle={() => toggle(item)} onDelete={() => remove(item.id)} />) : <button className="empty-action" onClick={() => setAddOpen(true)}><Sparkles size={18} /><span><strong>今天最重要的是什么？</strong><small>添加第一项重点任务</small></span><ChevronRight size={16} /></button>}
          </div>
          {tasks.length > 3 && (
            <div className="other-tasks">
              <div className="other-tasks-label"><ListTodo size={14} /><span>其他任务</span><b>{tasks.length - 3}</b></div>
              {tasks.slice(3).map((item) => <TaskRow key={item.id} item={item} onToggle={() => toggle(item)} onDelete={() => remove(item.id)} />)}
            </div>
          )}
        </section>

        <div className="two-column">
          <section className="small-card schedule-card">
            <div className="section-heading compact-heading">
              <div><span className="section-icon blue"><Clock3 size={15} /></span><div><h2>时间安排</h2><p>为任务留出位置</p></div></div>
            </div>
            <div className="timeline">
              {tasks.filter((task) => task.startTime).length ? tasks.filter((task) => task.startTime).map((item) => (
                <div className={item.completed ? "timeline-item completed" : "timeline-item"} key={item.id}>
                  <time>{item.startTime}</time><i /><button onClick={() => toggle(item)}>{item.title}</button>
                </div>
              )) : <p className="empty-mini">给任务添加时间，就会出现在这里。</p>}
            </div>
          </section>

          <section className="small-card discipline-card">
            <div className="section-heading compact-heading">
              <div><span className="section-icon amber"><Flame size={15} /></span><div><h2>每日纪律</h2><p>今天也要守住</p></div></div>
            </div>
            <div className="discipline-list">
              {disciplines.length ? disciplines.map((item) => (
                <div className={item.completed ? "discipline-item completed" : "discipline-item"} key={item.id}>
                  <CheckButton checked={item.completed} onClick={() => toggle(item)} />
                  <span>{item.title}</span>
                  <button className="delete-button" onClick={() => remove(item.id)}><Trash2 size={13} /></button>
                </div>
              )) : <p className="empty-mini">添加一条想长期坚持的纪律。</p>}
            </div>
          </section>
        </div>

        <section className="notes-card">
          <div className="section-heading compact-heading">
            <div><span className="section-icon green"><StickyNote size={15} /></span><div><h2>备忘</h2><p>先记下来，稍后处理</p></div></div>
            <button className="plain-add" onClick={() => setAddOpen(true)}><Plus size={15} /></button>
          </div>
          <div className="notes-grid">
            {notes.length ? notes.map((item) => <article className="note" key={item.id}><p>{item.title}</p><button onClick={() => remove(item.id)}><Trash2 size={13} /></button></article>) : <button className="note empty-note" onClick={() => setAddOpen(true)}>＋ 添加备忘</button>}
          </div>
        </section>
      </main>

      <button className="floating-add" onClick={() => setAddOpen(true)}><Plus size={20} /><span>添加</span></button>
      <AddItemDialog open={addOpen} date={today} onClose={() => setAddOpen(false)} onSubmit={add} />
      <SettingsPanel open={settingsOpen} settings={settings} monitors={monitors} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
