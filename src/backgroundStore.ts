import { cleanBackground, defaultBackground, type BackgroundPreferences, type Wallpaper } from "./backgroundModel";

const DB_NAME = "schedulepin.background.v1";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DB_NAME) : null;
const listeners = new Set<() => void>();
channel?.addEventListener("message", () => listeners.forEach(fn => fn()));
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
function changed() { listeners.forEach(fn => fn()); channel?.postMessage("changed"); }
export function subscribeBackground(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function lockBackground<T>(run: () => Promise<T>): Promise<T> { return navigator.locks ? navigator.locks.request(DB_NAME, run) : run(); }
export async function readBackground() {
  const connection = await db(); const tx = connection.transaction(["preferences", "wallpapers"]);
  const [prefs, wallpapers] = await Promise.all([result(tx.objectStore("preferences").get("current")), result(tx.objectStore("wallpapers").getAll())]);
  return { preferences: cleanBackground(prefs ?? defaultBackground), wallpapers: wallpapers as Wallpaper[] };
}
export async function saveBackground(patch: Partial<BackgroundPreferences>, additions: Wallpaper[] = [], expectedRevision?: number) {
  return lockBackground(async () => {
    const connection = await db(); const tx = connection.transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const current = cleanBackground(await result(tx.objectStore("preferences").get("current")) ?? {});
    if (expectedRevision !== undefined && current.revision !== expectedRevision) { await done; return false; }
    const previous = await Promise.all(additions.map(item => result(tx.objectStore("wallpapers").get(item.id))));
    tx.objectStore("preferences").put(cleanBackground({ ...current, ...patch, revision: current.revision + 1 }), "current");
    additions.forEach((item,index) => tx.objectStore("wallpapers").put({ ...item, favorite: item.favorite || previous[index]?.favorite || false }));
    await done; changed(); return true;
  });
}
export async function favoriteWallpaper(id: string, favorite: boolean) {
  return lockBackground(async () => {
    const tx = (await db()).transaction("wallpapers", "readwrite"); const done = complete(tx); const store = tx.objectStore("wallpapers");
    const item = await result(store.get(id)); if (item) store.put({ ...item, favorite }); await done; changed();
  });
}
export async function deleteWallpaper(id: string) {
  return lockBackground(async () => {
    const tx = (await db()).transaction(["preferences", "wallpapers"], "readwrite"); const done = complete(tx);
    const prefs = cleanBackground(await result(tx.objectStore("preferences").get("current")) ?? {});
    if (prefs.currentId === id) { tx.abort(); await done.catch(() => {}); throw new Error("请先切换背景，再删除正在使用的壁纸。"); }
    delete prefs.positions[id]; tx.objectStore("preferences").put(prefs, "current"); tx.objectStore("wallpapers").delete(id); await done; changed();
  });
}
export async function trimBackgroundCache() {
  const { preferences, wallpapers } = await readBackground();
  const old = wallpapers.filter(w => !w.favorite && w.id !== preferences.currentId).sort((a,b) => b.createdAt - a.createdAt).slice(6);
  for (const item of old) await deleteWallpaper(item.id);
}
