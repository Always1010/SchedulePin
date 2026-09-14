import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Flag, StickyNote, Target, X } from "lucide-react";
import type { ItemKind, NewPlanItem } from "../types";

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onSubmit: (item: NewPlanItem) => Promise<void>;
}

const types: Array<{ value: ItemKind; label: string; icon: typeof Target }> = [
  { value: "task", label: "任务", icon: Target },
  { value: "discipline", label: "纪律", icon: Flag },
  { value: "note", label: "备忘", icon: StickyNote },
];

export function AddItemDialog({ open, date, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<ItemKind>("task");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTimeout(() => document.querySelector<HTMLInputElement>("#item-title")?.focus(), 30);
  }, [open]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({
      kind, title, scheduledDate: date,
      startTime: kind === "task" ? startTime || null : null,
      endTime: kind === "task" ? endTime || null : null,
      priority: kind === "task" ? priority : 0,
      recurringDaily: kind === "discipline",
    });
    setTitle("");
    setStartTime("");
    setEndTime("");
    setSaving(false);
    onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">添加到今天</span>
            <h2>记下一件事</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>

        <div className="type-switcher">
          {types.map(({ value, label, icon: Icon }) => (
            <button type="button" key={value} className={kind === value ? "active" : ""} onClick={() => setKind(value)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="item-title">内容</label>
        {kind === "note" ? (
          <textarea id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="写下需要记住的内容……" rows={4} />
        ) : (
          <input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "task" ? "要完成什么？" : "想坚持什么原则？"} />
        )}

        {kind === "task" && (
          <>
            <div className="form-row">
              <label><span><Clock3 size={14} />开始</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
              <label><span><Clock3 size={14} />结束</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
            </div>
            <div className="priority-field">
              <span><CalendarDays size={14} />优先级</span>
              <div className="priority-buttons">
                {[1, 2, 3].map((value) => <button type="button" key={value} className={priority === value ? "active" : ""} onClick={() => setPriority(value)}>{["普通", "重要", "重点"][value - 1]}</button>)}
              </div>
            </div>
          </>
        )}

        {kind === "discipline" && <p className="form-hint">纪律会每天出现，但每天的完成状态单独记录。</p>}

        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button type="submit" className="button primary" disabled={!title.trim() || saving}>{saving ? "保存中…" : "添加"}</button>
        </div>
      </form>
    </div>
  );
}
