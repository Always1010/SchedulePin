import { RotateCcw, Trash2, X } from "lucide-react";
import type { PlanItem } from "../types";

interface Props {
  open: boolean;
  items: PlanItem[];
  onClose: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArchiveDialog({ open, items, onClose, onRestore, onDelete }: Props) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog archive-dialog" aria-label="归档任务">
        <div className="dialog-heading">
          <div><span className="eyebrow">历史记录</span><h2>已归档</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <p className="archive-explanation">当天完成的任务会保留删除线，第二天自动移到这里。</p>
        <div className="archive-list">
          {items.length ? items.map((item) => (
            <article key={item.id} className="archive-row">
              <div><strong>{item.title}</strong><small>{item.completedDate ? `${item.completedDate} 完成` : "手动归档"}</small></div>
              <button type="button" onClick={() => onRestore(item.id)} aria-label={`恢复 ${item.title}`} title="恢复到 To-Do List"><RotateCcw size={15} /></button>
              <button type="button" className="danger" onClick={() => onDelete(item.id)} aria-label={`删除 ${item.title}`} title="永久删除"><Trash2 size={15} /></button>
            </article>
          )) : <div className="archive-empty">暂时没有归档任务。</div>}
        </div>
      </section>
    </div>
  );
}
