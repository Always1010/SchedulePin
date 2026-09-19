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
      completedDate: null, completedAt: null, archivedAt: null,
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
    const completedAt = item.completed ? item.completedAt ?? (completedDate ? `${completedDate}T23:59:59` : null) : null;
    let archivedAt = item.archivedAt ?? null;
    if (item.kind === "task" && item.completed && completedDate && completedDate < date && !archivedAt) {
      archivedAt = completedDate;
    }
    if (completedDate !== item.completedDate || completedAt !== item.completedAt || archivedAt !== item.archivedAt) changed = true;
    return { ...item, completedDate, completedAt, archivedAt };
  });
  if (changed) await writeValue(ITEMS_KEY, prepared);
  return prepared;
}

export async function loadItems(date = todayKey()): Promise<PlanItem[]> {
  return (await preparedItems(date))
    .filter((item) => !item.archivedAt && item.kind === "task");
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
    sortOrder: items.length, completed: false, completedDate: null, completedAt: null, archivedAt: null, createdAt: new Date().toISOString(),
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
    completedAt: completed ? new Date().toISOString() : null,
  } : item));
}

export async function updateItemTitle(id: string, title: string) {
  const nextTitle = title.trim();
  if (!nextTitle) return;
  await writeValue(ITEMS_KEY, (await allItems()).map((item) => (
    item.id === id ? { ...item, title: nextTitle } : item
  )));
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
    item.id === id ? { ...item, archivedAt: null, completed: false, completedDate: null, completedAt: null } : item
  )));
}

export async function removeItem(id: string) {
  await writeValue(ITEMS_KEY, (await allItems()).filter((item) => item.id !== id));
}

export const defaultSettings: AppSettings = {
  principle: "做完当前任务再开始下一项。临时想到的事情先记下来，不频繁切换。每天结束前回顾当天完成的内容。",
  principleTheme: "forest",
  principleFontFamily: "modern",
  principleFontScale: 1,
  principleTextStyle: "regular",
  theme: "warm",
  fontFamily: "modern",
  fontScale: 1,
  density: "comfortable",
  densityLevel: 50,
  cardRadius: 20,
  opacity: 0.86,
  displayMode: "single",
  selectedMonitorId: null,
  desktopEnabled: false,
  layouts: {},
};

export async function loadSettings(): Promise<AppSettings> {
  const stored = await readValue<Partial<AppSettings>>(SETTINGS_KEY);
  const storedDensity = (stored as { density?: unknown } | null)?.density;
  const storedDensityLevel = (stored as { densityLevel?: unknown } | null)?.densityLevel;
  const densityLevel = typeof storedDensityLevel === "number"
    ? Math.min(100, Math.max(0, storedDensityLevel))
    : ({ compact: 0, comfortable: 50, spacious: 100 } as Record<string, number>)[String(storedDensity)] ?? defaultSettings.densityLevel;
  const density: AppSettings["density"] = densityLevel < 34 ? "compact" : densityLevel > 66 ? "spacious" : "comfortable";
  const legacyPrinciple = (await allItems())
    .filter((item) => item.kind === "discipline")
    .map((item) => item.title.trim())
    .filter(Boolean)
    .join("。")
    .replace(/。+/g, "。")
    .replace(/([^。])$/, "$1。");
  const settings = {
    ...defaultSettings,
    ...(stored ?? {}),
    principle: typeof stored?.principle === "string" ? stored.principle : legacyPrinciple || defaultSettings.principle,
    density,
    densityLevel,
    layouts: stored?.layouts ?? {},
  };
  if (typeof stored?.principle !== "string" || storedDensity !== density || storedDensityLevel !== densityLevel) await writeValue(SETTINGS_KEY, settings);
  return settings;
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
