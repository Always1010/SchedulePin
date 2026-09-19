import { isSavedWallpaper, type Wallpaper } from "./backgroundModel";
import { prepareWallpaper } from "./backgroundSource";
export function downloadFile(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
const dataUrl = (blob: Blob) => new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
export async function exportWallpapers(items: Wallpaper[]) {
  const wallpapers = await Promise.all(items.filter(isSavedWallpaper).map(async ({ blob, thumbnail: _, ...meta }) => ({ ...meta, image: await dataUrl(blob) })));
  downloadFile(new Blob([JSON.stringify({ format: "schedulepin-wallpapers", version: 1, wallpapers })], { type: "application/json" }), "SchedulePin-壁纸收藏.json");
}
export async function importWallpapers(file: File): Promise<Wallpaper[]> {
  if (file.size > 200 * 1024 * 1024) throw new Error("备份文件请控制在 200 MB 以内。");
  const data = JSON.parse(await file.text());
  if (data.format !== "schedulepin-wallpapers" || data.version !== 1 || !Array.isArray(data.wallpapers) || data.wallpapers.length > 100) throw new Error("不是受支持的壁纸收藏备份。");
  const items: Wallpaper[] = [];
  for (const item of data.wallpapers) {
    if (typeof item.image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(item.image) || item.image.length > 28 * 1024 * 1024) throw new Error("备份中有无效图片。");
    const comma = item.image.indexOf(","); const raw = atob(item.image.slice(comma+1)); const blob = new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: item.image.slice(5,item.image.indexOf(";")) });
    const url = (value: unknown, host: string) => { try { const u = new URL(String(value)); return u.protocol === "https:" && u.hostname === host ? u.href : ""; } catch { return ""; } };
    items.push({ ...(await prepareWallpaper(blob, { id: crypto.randomUUID(), title: String(item.title ?? "导入壁纸").slice(0,200), author: String(item.author ?? "").slice(0,1000), source: item.source === "commons" ? "commons" : "local", sourceUrl: url(item.sourceUrl,"commons.wikimedia.org"), license: String(item.license ?? "").slice(0,200), licenseUrl: url(item.licenseUrl,"creativecommons.org"), favorite: Boolean(item.favorite) })), retained: true });
  }
  return items;
}
