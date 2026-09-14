import { ArrowLeft, CalendarDays, Clock3, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlanItem } from "../types";

interface Props {
  items: PlanItem[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

const dayLabel = (date: string) => {
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(value);
};

const timeLabel = (item: PlanItem) => {
  if (!item.completedAt) return "未记录完成时间";
  const value = new Date(item.completedAt);
  if (Number.isNaN(value.getTime())) return "未记录完成时间";
  return `${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value)} 完成`;
};

export function ArchivePage({ items, onBack, onRestore, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const matched = items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    return matched.reduce<Array<{ date: string; items: PlanItem[] }>>((result, item) => {
      const date = item.completedDate ?? item.archivedAt?.slice(0, 10) ?? "更早";
      const group = result.find((entry) => entry.date === date);
      if (group) group.items.push(item);
      else result.push({ date, items: [item] });
      return result;
    }, []).sort((a, b) => b.date.localeCompare(a.date));
  }, [items, query]);

  const confirmDelete = (item: PlanItem) => {
    if (window.confirm(`永久删除“${item.title}”的归档记录？此操作无法恢复。`)) onDelete(item.id);
  };

  return (
    <main className="archive-page page-shell">
      <div className="page-title-row">
        <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={17} />返回</button>
        <div><span className="eyebrow">History</span><h1>归档</h1><p>查看已经完成的计划，也可以恢复到 To-Do List。</p></div>
        <strong className="record-count">{items.length} 条记录</strong>
      </div>

      <label className="archive-search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索归档任务……" />
      </label>

      <div className="archive-groups">
        {groups.length ? groups.map((group) => (
          <section className="archive-group" key={group.date}>
            <h2><CalendarDays size={16} />{group.date === "更早" ? group.date : dayLabel(group.date)}<span>{group.items.length}</span></h2>
            <div>
              {group.items
                .sort((a, b) => (b.completedAt ?? b.archivedAt ?? "").localeCompare(a.completedAt ?? a.archivedAt ?? ""))
                .map((item) => (
                  <article className="archive-page-row" key={item.id}>
                    <span className="archive-check">✓</span>
                    <div><strong>{item.title}</strong><small><Clock3 size={12} />{timeLabel(item)}{item.startTime ? ` · 原计划 ${item.startTime}${item.endTime ? `–${item.endTime}` : ""}` : ""}</small></div>
                    <button type="button" onClick={() => onRestore(item.id)}><RotateCcw size={15} />恢复</button>
                    <button type="button" className="danger" onClick={() => confirmDelete(item)}><Trash2 size={15} />删除</button>
                  </article>
                ))}
            </div>
          </section>
        )) : <div className="archive-page-empty">{query ? "没有找到匹配的归档任务。" : "暂时没有归档任务。"}</div>}
      </div>
    </main>
  );
}
