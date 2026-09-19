import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Archive, BookOpenText, Check, ChevronDown, ListTodo, Plus } from "lucide-react";
import type { AppSettings, NewPlanItem, PlanItem } from "../types";
import { todayKey } from "../data";
import { TaskRow } from "./TaskRow";

export function PrincipleCard({ settings, expanded = true, onToggle, onEdit }: {
  settings: AppSettings; expanded?: boolean; onToggle?: () => void; onEdit?: () => void;
}) {
  return <section className={`principle-spotlight${expanded ? "" : " principle-collapsed"}`}>
    <div className="principle-heading">
      <span className="principle-mark"><BookOpenText size={19} /></span>
      <div><span className="eyebrow">How I work</span><h2>Principle</h2></div>
      {onEdit && <button type="button" onClick={onEdit}>编辑</button>}
      {onToggle && <button type="button" className="principle-collapse-button" aria-label={expanded ? "收起 Principle" : "展开 Principle"} aria-expanded={expanded} onClick={onToggle}><ChevronDown size={16} /></button>}
    </div>
    {expanded && <p className="principle-copy">{settings.principle || "在设置中写下希望长期遵循的做事原则。"}</p>}
  </section>;
}

export function TodoSummaryCard({ tasks, onExpand }: { tasks: PlanItem[]; onExpand?: () => void }) {
  const completed = tasks.filter(task => task.completed).length;
  return <section className="todo-summary-card" aria-label="待办摘要">
    <span className="section-icon green"><ListTodo size={17} /></span>
    <div className="todo-summary-copy"><span>今天的待办</span><h2>待办</h2></div>
    <strong className="todo-summary-progress">{tasks.length ? `${completed} / ${tasks.length} 已完成` : "今天没有待办"}</strong>
    {onExpand && <button type="button" className="todo-summary-expand" aria-label="展开完整待办" aria-expanded={false} onClick={onExpand}><span>展开完整待办</span><ChevronDown size={16} /></button>}
  </section>;
}

interface Props {
  settings: AppSettings;
  tasks: PlanItem[];
  loading?: boolean;
  sidePanel?: boolean;
  principleExpanded?: boolean;
  onTogglePrinciple?: () => void;
  onToggleTasks?: () => void;
  onEditPrinciple?: () => void;
  onOpenArchive?: () => void;
  onAddDetailed?: () => void;
  onCreate?: (input: NewPlanItem) => Promise<void>;
  onToggle?: (item: PlanItem) => Promise<void>;
  onRename?: (id: string, title: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onReorder?: (ids: string[]) => Promise<void>;
}

export function PlanView({ settings, tasks, loading, sidePanel, principleExpanded = true, onTogglePrinciple, onEditPrinciple,
  onToggleTasks, onOpenArchive, onAddDetailed, onCreate, onToggle, onRename, onDelete, onArchive, onReorder }: Props) {
  const [quickTitle, setQuickTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const completed = tasks.filter(task => task.completed).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const run = async (action: () => Promise<void> | undefined) => {
    setError("");
    try { await action(); } catch { setError("任务保存失败，请重试。"); }
  };
  const move = ({ active, over }: DragEndEvent) => {
    if (!over || over.id === active.id) return;
    const from = tasks.findIndex(task => task.id === active.id);
    const to = tasks.findIndex(task => task.id === over.id);
    if (from >= 0 && to >= 0) void run(() => onReorder?.(arrayMove(tasks, from, to).map(task => task.id)));
  };
  return <div className={`plan-view${sidePanel ? " sidepanel-plan" : ""}`}>
    <section className={`day-hero todo-hero${sidePanel ? "" : " overview-day"}`}>
      <div><span className="eyebrow">今天</span><h1>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</h1></div>
      {sidePanel ? <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>{completed}/{tasks.length}</span></div></div>
        : <span className="overview-progress"><span className="overview-progress-ring" aria-hidden="true" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties} />{completed} / {tasks.length} 已完成</span>}
    </section>
    <PrincipleCard settings={settings} expanded={principleExpanded} onToggle={onTogglePrinciple} onEdit={onEditPrinciple} />
    <section className="todo-card">
      <div className="todo-heading">
        <div><span className="section-icon green"><ListTodo size={17} /></span><div><h2>To-Do List</h2><p>按添加顺序排列，拖动手柄可以调整</p></div></div>
        <div className="plan-actions">
          {onAddDetailed && <button type="button" className="archive-link" onClick={onAddDetailed} aria-label="添加带时间的任务"><Plus size={15} /><span>添加</span></button>}
          <button type="button" className="archive-link" onClick={onOpenArchive}><Archive size={15} />归档</button>
          {onToggleTasks && <button type="button" className="archive-link" onClick={onToggleTasks} aria-label="收起待办" aria-expanded={true}><ChevronDown size={15} />收起</button>}
        </div>
      </div>
      {error && <p className="shortcut-error" role="alert">{error}</p>}
      <div className="task-list todo-list">
        {loading ? <div className="empty">正在打开任务列表…</div> : tasks.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={move}>
          <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => <TaskRow key={task.id} item={task} onToggle={() => void run(() => onToggle?.(task))}
              onRename={title => run(() => onRename?.(task.id, title))} onDelete={() => void run(() => onDelete?.(task.id))} onArchive={() => void run(() => onArchive?.(task.id))} />)}
          </SortableContext>
        </DndContext> : <div className="todo-empty"><Check size={18} /><span>现在没有待办事项</span></div>}
      </div>
      <form className="quick-add" onSubmit={async event => {
        event.preventDefault(); const title = quickTitle.trim(); if (!title || saving || !onCreate) return;
        setSaving(true); setError("");
        try { await onCreate({ kind: "task", title, scheduledDate: todayKey() }); setQuickTitle(""); }
        catch { setError("添加失败，内容已保留，请重试。"); }
        finally { setSaving(false); }
      }}><Plus size={18} /><input value={quickTitle} disabled={saving} onChange={event => setQuickTitle(event.target.value)} placeholder="输入要做的事，按 Enter 添加…" aria-label="快速添加 To-Do" /><kbd>{saving ? "保存中" : "Enter"}</kbd></form>
    </section>
  </div>;
}
