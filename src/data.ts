import type { AppSettings, NewPlanItem, PlanItem } from "./types";

const ITEMS_KEY = "schedulepin.items.v1";
const SETTINGS_KEY = "schedulepin.settings.v1";

const isTauri = () => "__TAURI_INTERNALS__" in window;

const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayKey = () => toDateKey();

const starterItems = (): PlanItem[] => {
  const today = todayKey();
  const createdAt = new Date().toISOString();
  return [
    {
      id: `starter-task-${today}`, kind: "task", title: "写下今天最重要的一件事",
      scheduledDate: today, startTime: "09:00", endTime: "10:00", priority: 3,
      recurringDaily: false, sortOrder: 0, completed: false, createdAt,
    },
    {
      id: "starter-discipline", kind: "discipline", title: "开始新任务前，先完成当前任务",
      scheduledDate: today, startTime: null, endTime: null, priority: 1,
      recurringDaily: true, sortOrder: 1, completed: false, createdAt,
    },
    {
      id: `starter-note-${today}`, kind: "note", title: "想到其他事情时先记在这里，不急着切换。",
      scheduledDate: today, startTime: null, endTime: null, priority: 0,
      recurringDaily: false, sortOrder: 2, completed: false, createdAt,
    },
  ];
};

const readLocal = (): PlanItem[] => {
  const raw = localStorage.getItem(ITEMS_KEY);
  if (raw) return JSON.parse(raw) as PlanItem[];
  const initial = starterItems();
  localStorage.setItem(ITEMS_KEY, JSON.stringify(initial));
  return initial;
};

const writeLocal = (items: PlanItem[]) => {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
};

async function database() {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  return Database.load("sqlite:schedulepin.db");
}

export async function loadItems(date = todayKey()): Promise<PlanItem[]> {
  if (!isTauri()) {
    return readLocal().filter(
      (item) => item.scheduledDate === date || item.recurringDaily,
    );
  }

  const db = await database();
  const rows = await db.select<Array<Record<string, unknown>>>(
    `SELECT i.*, COALESCE(c.completed, 0) AS completed
     FROM plan_items i
     LEFT JOIN item_completions c ON c.item_id = i.id AND c.day = $1
     WHERE i.scheduled_date = $1 OR i.recurring_daily = 1
     ORDER BY i.sort_order, i.created_at`,
    [date],
  );

  if (rows.length === 0) {
    for (const item of starterItems()) await insertItem(item);
    return loadItems(date);
  }

  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as PlanItem["kind"],
    title: String(row.title),
    scheduledDate: String(row.scheduled_date),
    startTime: row.start_time ? String(row.start_time) : null,
    endTime: row.end_time ? String(row.end_time) : null,
    priority: Number(row.priority),
    recurringDaily: Boolean(row.recurring_daily),
    sortOrder: Number(row.sort_order),
    completed: Boolean(row.completed),
    createdAt: String(row.created_at),
  }));
}

async function insertItem(item: PlanItem) {
  if (!isTauri()) {
    const items = readLocal();
    writeLocal([...items, item]);
    return;
  }
  const db = await database();
  await db.execute(
    `INSERT OR IGNORE INTO plan_items
      (id, kind, title, scheduled_date, start_time, end_time, priority, recurring_daily, sort_order, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [item.id, item.kind, item.title, item.scheduledDate, item.startTime, item.endTime,
      item.priority, item.recurringDaily ? 1 : 0, item.sortOrder, item.createdAt],
  );
}

export async function createItem(input: NewPlanItem): Promise<PlanItem> {
  const existing = await loadItems(input.scheduledDate);
  const item: PlanItem = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title.trim(),
    scheduledDate: input.scheduledDate,
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    priority: input.priority ?? (input.kind === "task" ? 2 : 0),
    recurringDaily: input.recurringDaily ?? input.kind === "discipline",
    sortOrder: existing.length,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  await insertItem(item);
  return item;
}

export async function setCompleted(id: string, day: string, completed: boolean) {
  if (!isTauri()) {
    writeLocal(readLocal().map((item) => item.id === id ? { ...item, completed } : item));
    return;
  }
  const db = await database();
  await db.execute(
    `INSERT INTO item_completions (item_id, day, completed) VALUES ($1,$2,$3)
     ON CONFLICT(item_id, day) DO UPDATE SET completed = excluded.completed`,
    [id, day, completed ? 1 : 0],
  );
}

export async function removeItem(id: string) {
  if (!isTauri()) {
    writeLocal(readLocal().filter((item) => item.id !== id));
    return;
  }
  const db = await database();
  await db.execute("DELETE FROM plan_items WHERE id = $1", [id]);
}

export const defaultSettings: AppSettings = {
  alwaysOnTop: false,
  launchAtStartup: false,
  opacity: 0.94,
  displayMode: "single",
  monitorIndex: 0,
};

export function loadSettings(): AppSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("schedulepin-settings"));
}
