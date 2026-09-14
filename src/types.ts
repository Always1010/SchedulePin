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
  completedDate: string | null;
  archivedAt: string | null;
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
  id: string;
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export interface DesktopLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  principle: string;
  opacity: number;
  displayMode: "single" | "all";
  selectedMonitorId: string | null;
  desktopEnabled: boolean;
  layouts: Record<string, DesktopLayout>;
}

export interface HelperStatus {
  connected: boolean;
  version?: string;
  desktopEnabled?: boolean;
  lastSync?: string | null;
  monitors: MonitorInfo[];
  error?: string;
}

export interface DesktopSnapshot {
  protocolVersion: 1;
  date: string;
  generatedAt: string;
  items: PlanItem[];
  settings: AppSettings;
}
