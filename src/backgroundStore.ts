import { backgroundDay, cleanBackground, defaultBackground, isSavedWallpaper, resetBackgroundPreferences, type BackgroundPreferences, type Wallpaper } from "./backgroundModel";

const DB_NAME = "schedulepin.background.v1";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DB_NAME) : null;
type BackgroundChange = "preferences" | "library" | "cache";
const listeners = new Set<(change: BackgroundChange) => void>();
channel?.addEventListener("message", event => {
  const change: BackgroundChange = ["preferences", "library", "cache"].includes(event.data) ? event.data : "preferences";
  listeners.forEach(fn => fn(change));
});
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("preferences"); open.result.createObjectStore("wallpapers", { keyPath: "id" }); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => { database = undefined; reject(open.error); };
  });
}
function result<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function complete(transaction: IDBTransaction) { return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error ?? new Error("壁纸保存失败")); transaction.onerror = () => reject(transaction.error); }); }
function changed(change: BackgroundChange) { listeners.forEach(fn => fn(change)); channel?.postMessage(change); }
export function subscribeBackground(fn: (change: BackgroundChange) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function lockBackground<T>(run: () => Promise<T>): Promise<T> { return navigator.locks ? navigator.locks.request(DB_NAME, run) : run(); }
export async function readBackground() {
  const connection = await db(); const tx = connection.transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
  const [prefs, wallpapers] = await Promise.all([result(tx.objectStore("preferences").get("current")), result(tx.objectStore("wallpapers").getAll())]);
  const preferences = cleanBackground(prefs ?? defaultBackground);
  const migrated = (wallpapers as Wallpaper[]).map(item => preferences.mode === "fixed" && preferences.currentId === item.id && !item.retained
    ? { ...item, retained: true }
    : item);
  migrated.filter((item,index) => item !== wallpapers[index]).forEach(item => tx.objectStore("wallpapers").put(item));
  await done;
  return {
    preferences,
    wallpapers: migrated,
  };
}
function mergeWallpaper(item: Wallpaper, previous?: Wallpaper): Wallpaper {
  return {
    ...item,
    favorite: item.favorite || previous?.favorite || false,
    retained: item.retained || previous?.retained || item.source === "local" || undefined,
  };
}
export async function saveBackground(patch: Partial<BackgroundPreferences>, additions: Wallpaper[] = [], expectedRevision?: number) {
  return lockBackground(async () => {
    const connection = await db(); const tx = connection.transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const current = cleanBackground(await result(tx.objectStore("preferences").get("current")) ?? {});
    if (expectedRevision !== undefined && current.revision !== expectedRevision) { await done; return false; }
    const previous = await Promise.all(additions.map(item => result(tx.objectStore("wallpapers").get(item.id))));
    const rotationPatch = patch.mode === "daily" || patch.mode === "open" ? { rotationMode: patch.mode } : {};
    tx.objectStore("preferences").put(cleanBackground({ ...current, ...patch, ...rotationPatch, revision: current.revision + 1 }), "current");
    additions.forEach((item,index) => tx.objectStore("wallpapers").put(mergeWallpaper(item, previous[index])));
    await done; changed("preferences"); return true;
  });
}
export async function cacheWallpapers(additions: Wallpaper[]) {
  if (!additions.length) return;
  return lockBackground(async () => {
    const tx = (await db()).transaction("wallpapers", "readwrite"); const done = complete(tx); const store = tx.objectStore("wallpapers");
    const previous = await Promise.all(additions.map(item => result(store.get(item.id))));
    additions.forEach((item,index) => store.put(mergeWallpaper(item, previous[index])));
    await done; changed("cache");
  });
}
export async function retainWallpapers(additions: Wallpaper[]) {
  if (!additions.length) return;
  return lockBackground(async () => {
    const tx = (await db()).transaction("wallpapers", "readwrite"); const done = complete(tx); const store = tx.objectStore("wallpapers");
    const previous = await Promise.all(additions.map(item => result(store.get(item.id))));
    additions.forEach((item,index) => store.put(mergeWallpaper({ ...item, retained: true }, previous[index])));
    await done; changed("library");
  });
}
export async function favoriteWallpaper(wallpaper: string | Wallpaper, favorite: boolean) {
  return lockBackground(async () => {
    const tx = (await db()).transaction("wallpapers", "readwrite"); const done = complete(tx); const store = tx.objectStore("wallpapers");
    const id = typeof wallpaper === "string" ? wallpaper : wallpaper.id;
    const existing = await result(store.get(id)) as Wallpaper | undefined;
    const item = existing ?? (typeof wallpaper === "string" ? undefined : wallpaper);
    if (item) store.put({ ...item, favorite, retained: item.retained || item.source === "local" || undefined });
    await done; changed("library");
  });
}
export async function pinWallpaper(item: Wallpaper, expectedRevision?: number) {
  return saveBackground({ style: "photo", mode: "fixed", currentId: item.id, lastDay: backgroundDay() }, [{ ...item, retained: true }], expectedRevision);
}
export async function resumeWallpaperRotation(expectedRevision?: number) {
  return lockBackground(async () => {
    const connection = await db(); const tx = connection.transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const store = tx.objectStore("preferences"); const current = cleanBackground(await result(store.get("current")) ?? {});
    if (expectedRevision !== undefined && current.revision !== expectedRevision) { await done; return false; }
    if (current.currentId) {
      const wallpaperStore = tx.objectStore("wallpapers"); const item = await result(wallpaperStore.get(current.currentId)) as Wallpaper | undefined;
      if (item) wallpaperStore.put({ ...item, retained: true });
    }
    store.put(cleanBackground({ ...current, mode: current.rotationMode, lastDay: backgroundDay(), revision: current.revision + 1 }), "current");
    await done; changed("preferences"); return true;
  });
}
export async function resetBackground(expectedRevision?: number) {
  return lockBackground(async () => {
    const connection = await db(); const tx = connection.transaction("preferences", "readwrite"); const done = complete(tx);
    const store = tx.objectStore("preferences"); const current = cleanBackground(await result(store.get("current")) ?? {});
    if (expectedRevision !== undefined && current.revision !== expectedRevision) { await done; return false; }
    store.put(resetBackgroundPreferences(current), "current"); await done; changed("preferences"); return true;
  });
}
export async function deleteWallpaper(id: string) {
  return lockBackground(async () => {
    const tx = (await db()).transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const prefs = cleanBackground(await result(tx.objectStore("preferences").get("current")) ?? {});
    if (prefs.currentId === id) { tx.abort(); await done.catch(() => {}); throw new Error("请先切换背景，再删除正在使用的壁纸。"); }
    delete prefs.positions[id]; tx.objectStore("preferences").put(prefs, "current"); tx.objectStore("wallpapers").delete(id); await done; changed("library");
  });
}
export async function trimBackgroundCache() {
  return lockBackground(async () => {
    const tx = (await db()).transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const preferences = cleanBackground(await result(tx.objectStore("preferences").get("current")) ?? {});
    const wallpapers = await result(tx.objectStore("wallpapers").getAll()) as Wallpaper[];
    const old = wallpapers.filter(w => !isSavedWallpaper(w) && w.id !== preferences.currentId).sort((a,b) => b.createdAt - a.createdAt).slice(6);
    old.forEach(item => tx.objectStore("wallpapers").delete(item.id)); await done;
    if (old.length) changed("cache");
  });
}
