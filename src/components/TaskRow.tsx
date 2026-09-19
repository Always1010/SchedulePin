import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Check, Clock3, GripVertical, Trash2 } from "lucide-react";
import type { PlanItem } from "../types";

function CheckButton({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return <button type="button" className={checked ? "check-button checked" : "check-button"} onClick={onClick} aria-label={checked ? "标记为未完成" : "标记为完成"}>{checked && <Check size={14} strokeWidth={3} />}</button>;
}

interface TaskRowProps {
  item: PlanItem;
  onToggle: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
  onArchive: () => void;
}

export function TaskRow({ item, onToggle, onRename, onDelete, onArchive }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  useEffect(() => {
    if (!editing) setTitle(item.title);
  }, [editing, item.title]);

  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editing]);

  const finishEditing = async () => {
    const nextTitle = title.trim();
    setEditing(false);
    if (!nextTitle) {
      setTitle(item.title);
      return;
    }
    if (nextTitle !== item.title) await onRename(nextTitle);
  };

  const cancelEditing = () => {
    setTitle(item.title);
    setEditing(false);
  };

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
        {editing ? (
          <input
            ref={titleInputRef}
            className="task-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={finishEditing}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
            }}
            aria-label={`编辑任务：${item.title}`}
          />
        ) : (
          <button type="button" className="task-title-button" onClick={() => setEditing(true)} title="单击编辑任务">
            {item.title}
          </button>
        )}
        {(item.startTime || item.endTime) && <span><Clock3 size={13} />{item.startTime || "--:--"}{item.endTime ? ` — ${item.endTime}` : ""}</span>}
      </div>
      {item.completed && <button type="button" className="archive-task-button" onClick={onArchive} aria-label={`归档 ${item.title}`} title="立即归档"><Archive size={14} /></button>}
      <button type="button" className="delete-button" onClick={onDelete} aria-label={`删除 ${item.title}`}><Trash2 size={14} /></button>
    </article>
  );
}

