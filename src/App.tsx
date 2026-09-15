import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive, BookOpenText, CalendarCheck, Check, Clock3, GripVertical,
  ListTodo, Plus, Settings, Trash2,
} from "lucide-react";
import { AddItemDialog } from "./components/AddItemDialog";
import { AppearanceEditor } from "./components/AppearanceEditor";
import { ArchivePage } from "./components/ArchivePage";
import { SettingsPage } from "./components/SettingsPage";
import {
  archiveItem, createItem, defaultSettings, loadArchivedItems, loadItems, loadSettings,
  removeItem, restoreItem, saveSettings, saveTaskOrder, setCompleted, subscribeStorage, todayKey,
} from "./data";
import { queryHelper, restoreWallpaper } from "./native";
import type { AppSettings, HelperStatus, NewPlanItem, PlanItem } from "./types";

const sidePanel = new URLSearchParams(location.search).get("view") === "sidepanel";

const dateLabel = (date: Date) => new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long",
}).format(date);

function CheckButton({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return <button type="button" className={checked ? "check-button checked" : "check-button"} onClick={onClick} aria-label={checked ? "标记为未完成" : "标记为完成"}>{checked && <Check size={14} strokeWidth={3} />}</button>;
}

interface TaskRowProps {
  item: PlanItem;
  onToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function TaskRow({ item, onToggle, onDelete, onArchive }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <article
      ref={setNodeRef}
      className={`${item.completed ? "task-row completed" : "task-row"}${isDragging ? " dragging" : ""}`}
      data-task-id={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}
    >
      <button
        type="button"
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`拖动 ${item.title} 调整顺序`}
        title="拖动调整顺序"
      ><GripVertical size={16} /></button>
      <CheckButton checked={item.completed} onClick={onToggle} />
      <div className="task-copy">
        <strong>{item.title}</strong>
        {(item.startTime || item.endTime) && <span><Clock3 size={13} />{item.startTime || "--:--"}{item.endTime ? ` — ${item.endTime}` : ""}</span>}
      </div>
      {item.completed && <button type="button" className="archive-task-button" onClick={onArchive} aria-label={`归档 ${item.title}`} title="立即归档"><Archive size={14} /></button>}
      <button type="button" className="delete-button" onClick={onDelete} aria-label={`删除 ${item.title}`}><Trash2 size={14} /></button>
    </article>
  );
}

export default function App() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [archived, setArchived] = useState<PlanItem[]>([]);
  const [page, setPage] = useState<"main" | "archive" | "settings" | "principle" | "appearance">("main");
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [helper, setHelper] = useState<HelperStatus>({ connected: false, monitors: [] });
  const today = todayKey();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(async () => {
    const [nextItems, nextSettings] = await Promise.all([loadItems(today), loadSettings()]);
    setItems(nextItems);
    setSettings(nextSettings);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    refresh();
    return subscribeStorage(refresh);
  }, [refresh]);

  const refreshHelper = useCallback(async () => {
    const next = await queryHelper();
    setHelper(next);
    if (next.connected && next.monitors.length && !settings.selectedMonitorId) {
      const updated = { ...settings, selectedMonitorId: next.monitors.find((monitor) => monitor.primary)?.id ?? next.monitors[0].id };
      setSettings(updated);
      await saveSettings(updated);
    }
  }, [settings]);

  useEffect(() => {
    if (page === "settings" || page === "principle") refreshHelper();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = useMemo(() => items
    .filter((item) => item.kind === "task")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)), [items]);
  const completed = tasks.filter((item) => item.completed).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  const toggle = async (item: PlanItem) => {
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, completed: !row.completed, completedDate: !row.completed ? today : null } : row));
    await setCompleted(item.id, today, !item.completed);
  };

  const remove = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setArchived((current) => current.filter((item) => item.id !== id));
    await removeItem(id);
  };

  const add = async (input: NewPlanItem) => {
    await createItem(input);
    await refresh();
  };

  const quickAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle("");
    await add({ kind: "task", title, scheduledDate: today });
  };

  const moveTask = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const sourceIndex = tasks.findIndex((item) => item.id === active.id);
    const targetIndex = tasks.findIndex((item) => item.id === over.id);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = arrayMove(tasks, sourceIndex, targetIndex);
    const order = new Map(next.map((item, index) => [item.id, index]));
    setItems((current) => current.map((item) => order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item));
    await saveTaskOrder(next.map((item) => item.id));
  };

  const archiveTask = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    await archiveItem(id);
  };

  const openArchive = async () => {
    setArchived(await loadArchivedItems());
    setPage("archive");
  };

  const restoreArchived = async (id: string) => {
    await restoreItem(id);
    setArchived((current) => current.filter((item) => item.id !== id));
    await refresh();
  };

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const restoreDesktop = async () => {
    const result = await restoreWallpaper();
    setHelper(result);
    const next = { ...settings, desktopEnabled: false };
    setSettings(next);
    await saveSettings(next);
  };

  const appearanceClass = `theme-${settings.theme} font-${settings.fontFamily} density-${settings.density}`;

  return (
    <div
      className={`${sidePanel ? "app compact extension-app" : "app extension-app"} ${appearanceClass}`}
      style={{ "--font-scale": settings.fontScale, "--card-radius": `${settings.cardRadius}px` } as React.CSSProperties}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><CalendarCheck size={19} /></span>
          <span className="brand-copy"><strong>SchedulePin</strong><small className="desktop-status ready">{sidePanel ? "浏览器侧边栏" : "To-Do · 新标签页"}</small></span>
        </div>
        <div className="topbar-actions">
          {settings.desktopEnabled && <span className="wallpaper-live">桌面同步已开启</span>}
          <button className="icon-button" onClick={() => setPage("settings")} aria-label="设置"><Settings size={18} /></button>
        </div>
      </header>

      {page === "archive" ? (
        <ArchivePage items={archived} onBack={() => setPage("main")} onRestore={restoreArchived} onDelete={remove} />
      ) : page === "appearance" ? (
        <AppearanceEditor
          settings={settings}
          items={items}
          onSave={async (next) => { await updateSettings(next); setPage("settings"); }}
          onCancel={() => setPage("settings")}
        />
      ) : page === "settings" || page === "principle" ? (
        <SettingsPage settings={settings} helper={helper} initialSection={page === "principle" ? "principle" : "hub"} onChange={updateSettings} onRefreshHelper={refreshHelper} onRestoreWallpaper={restoreDesktop} onOpenAppearance={() => setPage("appearance")} onBack={() => setPage("main")} />
      ) : <main className="todo-main">
        <section className="day-hero todo-hero">
          <div><span className="eyebrow">今天</span><h1>{dateLabel(new Date())}</h1><p>完成的任务会保留到今天结束，明天自动归档。</p></div>
          <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{progress}%</strong><span>{completed}/{tasks.length}</span></div>
          </div>
        </section>

        <section className="principle-spotlight">
          <div className="principle-heading">
            <span className="principle-mark"><BookOpenText size={19} /></span>
            <div><span className="eyebrow">How I work</span><h2>Principle</h2></div>
            <button type="button" onClick={() => setPage("principle")}>编辑</button>
          </div>
          <p className="principle-copy">{settings.principle || "在设置中写下希望长期遵循的做事原则。"}</p>
        </section>

        <section className="todo-card">
          <div className="todo-heading">
            <div><span className="section-icon green"><ListTodo size={17} /></span><div><h2>To-Do List</h2><p>按添加顺序排列，拖动手柄可以调整</p></div></div>
            <button type="button" className="archive-link" onClick={openArchive}><Archive size={15} />归档</button>
          </div>
          <div className="task-list todo-list">
            {loading ? <div className="empty">正在打开任务列表…</div> : tasks.length ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={moveTask}>
                <SortableContext items={tasks.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  {tasks.map((item) => (
                    <TaskRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggle(item)}
                      onDelete={() => remove(item.id)}
                      onArchive={() => archiveTask(item.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : <div className="todo-empty"><Check size={18} /><span>现在没有待办事项</span></div>}
          </div>
          <form className="quick-add" onSubmit={quickAdd}>
            <Plus size={18} />
            <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="输入要做的事，按 Enter 添加…" aria-label="快速添加 To-Do" />
            <kbd>Enter</kbd>
          </form>
        </section>
      </main>}

      {page === "main" && <button className="floating-add" onClick={() => setAddOpen(true)}><Plus size={20} /><span>添加</span></button>}
      <AddItemDialog open={addOpen} date={today} onClose={() => setAddOpen(false)} onSubmit={add} />
    </div>
  );
}
