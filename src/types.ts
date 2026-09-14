export type ItemKind = "task" | "discipline" | "note";

export interface PlanItem {
  id: string;
  kind: ItemKind;
  title: string;
  scheduledDate: string;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  recurringDaily: boolean;
  sortOrder: number;
  completed: boolean;
  createdAt: string;
}

export interface NewPlanItem {
  kind: ItemKind;
  title: string;
  scheduledDate: string;
  startTime?: string | null;
  endTime?: string | null;
  priority?: number;
  recurringDaily?: boolean;
}

export interface MonitorInfo {
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface DesktopConfiguration {
  attachedWindows: number;
  editMode: boolean;
}

export interface WindowLayout {
  monitorIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  launchAtStartup: boolean;
  opacity: number;
  displayMode: "single" | "all";
  monitorIndex: number;
  layouts: Record<string, WindowLayout>;
}
