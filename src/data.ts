import type { AppSettings, NewPlanItem, PlanItem } from "./types";

export const ITEMS_KEY = "schedulepin.items.v2";
export const SETTINGS_KEY = "schedulepin.settings.v2";

const hasExtensionStorage = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

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
      completedDate: null, archivedAt: null,
    },
    {
      id: "starter-discipline", kind: "discipline", title: "开始新任务前，先完成当前任务",
      scheduledDate: today, startTime: null, endTime: null, priority: 1,
      recurringDaily: true, sortOrder: 1, completed: false, createdAt,
      completedDate: null, archivedAt: null,
    },
  ];
};

async function readValue<T>(key: string): Promise<T | null> {
  if (hasExtensionStorage()) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? null;
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : null;
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("schedulepin-storage"));
  }
}

async function allItems(): Promise<PlanItem[]> {
  const stored = await readValue<PlanItem[]>(ITEMS_KEY);
  if (stored) return stored;
  const initial = starterItems();
  await writeValue(ITEMS_KEY, initial);
  return initial;
}

async function preparedItems(date: string): Promise<PlanItem[]> {
  const stored = await allItems();
  let changed = false;
  const prepared = stored.map((item) => {
    const completedDate = item.completed ? item.completedDate ?? date : null;
    let archivedAt = item.archivedAt ?? null;
    if (item.kind === "task" && item.completed && completedDate && completedDate < date && !archivedAt) {
      archivedAt = completedDate;
    }
    if (completedDate !== item.completedDate || archivedAt !== item.archivedAt) changed = true;
    return { ...item, completedDate, archivedAt };
  });
  if (changed) await writeValue(ITEMS_KEY, prepared);
  return prepared;
}

export async function loadItems(date = todayKey()): Promise<PlanItem[]> {
  return (await preparedItems(date))
    .filter((item) => !item.archivedAt && (
      item.kind === "task" || (item.kind === "discipline" && (item.recurringDaily || item.scheduledDate === date))
    ))
    .map((item) => item.recurringDaily ? { ...item, completed: item.completedDate === date } : item);
}

export async function loadArchivedItems(): Promise<PlanItem[]> {
  return (await preparedItems(todayKey()))
    .filter((item) => item.kind === "task" && Boolean(item.archivedAt))
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
}

export async function createItem(input: NewPlanItem): Promise<PlanItem> {
  const items = await allItems();
  const item: PlanItem = {
    id: crypto.randomUUID(), kind: input.kind, title: input.title.trim(),
    scheduledDate: input.scheduledDate, startTime: input.startTime || null,
    endTime: input.endTime || null, priority: input.priority ?? 0,
    recurringDaily: input.recurringDaily ?? input.kind === "discipline",
    sortOrder: items.length, completed: false, completedDate: null, archivedAt: null, createdAt: new Date().toISOString(),
  };
  await writeValue(ITEMS_KEY, [...items, item]);
  return item;
}

export async function setCompleted(id: string, day: string, completed: boolean) {
  const items = await allItems();
  await writeValue(ITEMS_KEY, items.map((item) => item.id === id ? {
    ...item,
    completed,
    completedDate: completed ? day : null,
  } : item));
}

export async function saveTaskOrder(ids: string[]) {
  const order = new Map(ids.map((id, index) => [id, index]));
  await writeValue(ITEMS_KEY, (await allItems()).map((item) => (
    order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item
  )));
}

export async function archiveItem(id: string) {
  await writeValue(ITEMS_KEY, (await allItems()).map((item) => (
    item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item
  )));
}

export async function restoreItem(id: string) {
  await writeValue(ITEMS_KEY, (await allItems()).map((item) => (
    item.id === id ? { ...item, archivedAt: null, completed: false, completedDate: null } : item
  )));
}

export async function removeItem(id: string) {
  await writeValue(ITEMS_KEY, (await allItems()).filter((item) => item.id !== id));
}

export const defaultSettings: AppSettings = {
  opacity: 0.86,
  displayMode: "single",
  selectedMonitorId: null,
  desktopEnabled: false,
  layouts: {},
};

export async function loadSettings(): Promise<AppSettings> {
  const stored = await readValue<Partial<AppSettings>>(SETTINGS_KEY);
  return { ...defaultSettings, ...(stored ?? {}), layouts: stored?.layouts ?? {} };
}

export async function saveSettings(settings: AppSettings) {
  await writeValue(SETTINGS_KEY, settings);
}

export function subscribeStorage(listener: () => void): () => void {
  if (hasExtensionStorage()) {
    const callback = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[ITEMS_KEY] || changes[SETTINGS_KEY]) listener();
    };
    chrome.storage.onChanged.addListener(callback);
    return () => chrome.storage.onChanged.removeListener(callback);
  }
  window.addEventListener("schedulepin-storage", listener);
  return () => window.removeEventListener("schedulepin-storage", listener);
}
