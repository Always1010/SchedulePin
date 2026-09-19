import type { BackgroundCategory, Wallpaper } from "./backgroundModel";
export interface OnlineWallpaper { id: string; title: string; author: string; sourceUrl: string; license: string; licenseUrl: string; imageUrl: string }
const terms = { nature: "landscape mountains lake", city: "city skyline night", abstract: "abstract background texture" };
const plain = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
function safeUrl(value: string, hosts: string[]) { try { const url = new URL(value); return url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password ? url.href : ""; } catch { return ""; } }
export async function discoverWallpapers(category: BackgroundCategory, offset = 0): Promise<OnlineWallpaper[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${terms[category]} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "12", gsroffset: String(offset), prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "2560", iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|UsageTerms" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("在线图库暂时不可用，请稍后重试或上传本地图片。");
  const data = await response.json();
  const items: OnlineWallpaper[] = [];
  for (const page of Object.values(data.query?.pages ?? {}) as any[]) {
    const info = page.imageinfo?.[0]; const meta = info?.extmetadata;
    if (!info || !meta || !["image/jpeg", "image/png", "image/webp"].includes(info.mime) || info.width < 1000) continue;
    const license = plain(meta.LicenseShortName?.value ?? "");
    if (!/^(CC BY(?:-SA)? [\d.]+|CC0(?: [\d.]+)?|Public domain)$/i.test(license)) continue;
    const imageUrl = safeUrl(info.thumburl || info.url, ["upload.wikimedia.org", "thumb.wikimedia.org"]);
    const sourceUrl = safeUrl(info.descriptionurl, ["commons.wikimedia.org"]);
    if (!imageUrl || !sourceUrl) continue;
    items.push({ id: `commons-${page.pageid}`, title: String(page.title).replace(/^File:/, ""), author: plain(meta.Artist?.value ?? "作者信息见来源页"), sourceUrl, license, licenseUrl: safeUrl(meta.LicenseUrl?.value ?? "", ["creativecommons.org"]), imageUrl });
  }
  if (!items.length) throw new Error("这批图片没有合适的壁纸，请换一批或选择其他分类。");
  return items;
}
function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> { return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片处理失败")), "image/jpeg", quality)); }
export async function prepareWallpaper(blob: Blob, metadata: Omit<Wallpaper, "blob" | "thumbnail" | "accent" | "createdAt">): Promise<Wallpaper> {
  if (!blob.size || blob.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。");
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 80000000) throw new Error("图片尺寸过大，请先缩小后再上传。");
    const draw = (max: number) => { const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio)); const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); return canvas; };
    const thumb = draw(400); const sample = draw(24).getContext("2d")!; const pixels = sample.getImageData(0,0,sample.canvas.width,sample.canvas.height).data;
    let best = [90,130,110], score = -1;
    for (let i=0;i<pixels.length;i+=4) { const rgb = [pixels[i],pixels[i+1],pixels[i+2]]; const max = Math.max(...rgb), min = Math.min(...rgb); const s = max-min; if (s>score && max<235 && max>70) { best=rgb; score=s; } }
    return { ...metadata, blob: await canvasBlob(draw(3840), .9), thumbnail: await canvasBlob(thumb, .8), accent: `#${best.map(v=>v.toString(16).padStart(2,"0")).join("")}`, createdAt: Date.now() };
  } finally { bitmap.close(); }
}
export async function downloadWallpaper(item: OnlineWallpaper): Promise<Wallpaper> {
  if (!safeUrl(item.imageUrl, ["upload.wikimedia.org", "thumb.wikimedia.org"])) throw new Error("图片来源无效。");
  const response = await fetch(item.imageUrl, { signal: AbortSignal.timeout(20000), credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("图片下载失败，当前背景已保留。");
  if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024) throw new Error("这张图片超过 20 MB，请换一张。");
  const { imageUrl: _, ...meta } = item;
  return prepareWallpaper(await response.blob(), { ...meta, source: "commons", favorite: false });
}
