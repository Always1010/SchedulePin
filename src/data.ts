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
      completedDate: null,
    },
    {
      id: "starter-discipline", kind: "discipline", title: "开始新任务前，先完成当前任务",
      scheduledDate: today, startTime: null, endTime: null, priority: 1,
      recurringDaily: true, sortOrder: 1, completed: false, createdAt,
      completedDate: null,
    },
    {
      id: `starter-note-${today}`, kind: "note", title: "想到其他事情时先记在这里，不急着切换。",
      scheduledDate: today, startTime: null, endTime: null, priority: 0,
      recurringDaily: false, sortOrder: 2, completed: false, createdAt,
      completedDate: null,
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

export async function loadItems(date = todayKey()): Promise<PlanItem[]> {
  return (await allItems())
    .filter((item) => item.scheduledDate === date || item.recurringDaily)
    .map((item) => item.recurringDaily ? { ...item, completed: item.completedDate === date } : item);
}

export async function loadAllItems(): Promise<PlanItem[]> {
  return allItems();
}

export async function createItem(input: NewPlanItem): Promise<PlanItem> {
  const items = await allItems();
  const item: PlanItem = {
    id: crypto.randomUUID(), kind: input.kind, title: input.title.trim(),
    scheduledDate: input.scheduledDate, startTime: input.startTime || null,
    endTime: input.endTime || null, priority: input.priority ?? (input.kind === "task" ? 2 : 0),
    recurringDaily: input.recurringDaily ?? input.kind === "discipline",
    sortOrder: items.length, completed: false, completedDate: null, createdAt: new Date().toISOString(),
  };
  await writeValue(ITEMS_KEY, [...items, item]);
  return item;
}

export async function setCompleted(id: string, day: string, completed: boolean) {
  const items = await allItems();
  await writeValue(ITEMS_KEY, items.map((item) => item.id === id ? {
    ...item,
    completed,
    completedDate: item.recurringDaily && completed ? day : null,
  } : item));
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
