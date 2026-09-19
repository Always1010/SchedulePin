import type { ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function ShortcutSortArea({ ids, disabled, onMove, children }: { ids: string[]; disabled: boolean; onMove: (id: string, overId: string) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
    if (!disabled && over && active.id !== over.id) onMove(String(active.id), String(over.id));
  }}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}

export function SortableShortcut({ id, title, disabled, editable, children }: { id: string; title: string; disabled: boolean; editable: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <div ref={setNodeRef} className={`shortcut-row${isDragging ? " shortcut-dragging" : ""}`} data-link-id={id}
    style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}>
    {children}
    {editable && <button className="shortcut-drag-handle" type="button" disabled={disabled} {...attributes} {...listeners} aria-label={`拖动 ${title} 调整入口顺序`}><GripVertical size={15} /></button>}
  </div>;
}
