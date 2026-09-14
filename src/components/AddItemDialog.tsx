import { useEffect, useState } from "react";
import { Clock3, Target, X } from "lucide-react";
import type { NewPlanItem } from "../types";

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onSubmit: (item: NewPlanItem) => Promise<void>;
}

export function AddItemDialog({ open, date, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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
      kind: "task", title, scheduledDate: date,
      startTime: startTime || null,
      endTime: endTime || null,
      priority: 0,
      recurringDaily: false,
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
            <span className="eyebrow">To-Do List</span>
            <h2>添加任务</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>

        <div className="task-dialog-mark"><Target size={16} />带时间的任务可以在这里完整添加</div>

        <label className="field-label" htmlFor="item-title">内容</label>
        <input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="要完成什么？" />

        <div className="form-row">
          <label><span><Clock3 size={14} />开始</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label><span><Clock3 size={14} />结束</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>

        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button type="submit" className="button primary" disabled={!title.trim() || saving}>{saving ? "保存中…" : "添加"}</button>
        </div>
      </form>
    </div>
  );
}
