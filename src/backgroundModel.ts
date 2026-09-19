export type BackgroundCategory = "nature" | "city" | "abstract";
export type Accent = "original" | "auto" | "green" | "blue" | "violet" | "orange";
export interface Position { x: number; y: number }
export interface BackgroundPreferences {
  revision: number;
  style: "paper" | "gradient" | "photo";
  appearance: "inherit" | "light" | "dark" | "system";
  accent: Accent;
  mode: "fixed" | "daily" | "open";
  /** The rotation rule to restore after a temporarily pinned wallpaper is released. */
  rotationMode: "daily" | "open";
  pool: "online" | "favorites";
  category: BackgroundCategory;
  currentId: string | null;
  lastDay: string;
  overlay: number;
  blur: number;
  panelOpacity: number;
  principleFollow: boolean;
  positions: Record<string, { landscape: Position; portrait: Position }>;
}
export interface Wallpaper {
  id: string; title: string; author: string; sourceUrl: string; license: string; licenseUrl: string;
  source: "local" | "commons";
  favorite: boolean; retained?: boolean; createdAt: number; blob: Blob; thumbnail: Blob;
  accent: string;
}
export const defaultBackground: BackgroundPreferences = {
  revision: 0,
  style: "paper", appearance: "inherit", accent: "original", mode: "daily", rotationMode: "daily", pool: "online", category: "nature",
  currentId: null, lastDay: "", overlay: 28, blur: 0, panelOpacity: 88, principleFollow: false, positions: {},
};
export function backgroundDay(date = new Date()) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
export function shouldRotate(prefs: BackgroundPreferences, date = new Date()): boolean {
  return prefs.style === "photo" && prefs.mode !== "fixed" && (!prefs.currentId || prefs.mode === "open" || prefs.lastDay !== backgroundDay(date));
}
export function isSavedWallpaper(item: Wallpaper): boolean {
  return item.favorite || item.retained === true || item.source === "local";
}
export function resetBackgroundPreferences(current: BackgroundPreferences): BackgroundPreferences {
  return cleanBackground({
    ...current,
    style: defaultBackground.style, mode: defaultBackground.mode, rotationMode: defaultBackground.rotationMode,
    pool: defaultBackground.pool, category: defaultBackground.category, currentId: defaultBackground.currentId,
    lastDay: defaultBackground.lastDay, overlay: defaultBackground.overlay, blur: defaultBackground.blur,
    positions: defaultBackground.positions, revision: current.revision + 1,
  });
}
export function cleanBackground(value: Partial<BackgroundPreferences>): BackgroundPreferences {
  const p = { ...defaultBackground, ...value };
  const clamp = (v: number, min: number, max: number, fallback: number) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  if (!["paper", "gradient", "photo"].includes(p.style)) p.style = "paper";
  if (!["inherit", "light", "dark", "system"].includes(p.appearance)) p.appearance = "inherit";
  if (!["original", "auto", "green", "blue", "violet", "orange"].includes(p.accent)) p.accent = "original";
  if (!["fixed", "daily", "open"].includes(p.mode)) p.mode = "fixed";
  const legacyRotation = value.mode === "open" ? "open" : "daily";
  p.rotationMode = ["daily", "open"].includes(value.rotationMode ?? "") ? value.rotationMode! : legacyRotation;
  if (!["online", "favorites"].includes(p.pool)) p.pool = "favorites";
  if (!["nature", "city", "abstract"].includes(p.category)) p.category = "nature";
  p.overlay = clamp(p.overlay, 0, 80, 28); p.blur = clamp(p.blur, 0, 20, 0); p.panelOpacity = clamp(p.panelOpacity, 60, 100, 88);
  const position = (pos?: Position) => ({ x: clamp(pos?.x ?? 50, 0, 100, 50), y: clamp(pos?.y ?? 50, 0, 100, 50) });
  p.positions = Object.fromEntries(Object.entries(p.positions ?? {}).map(([id, crop]) => [id, { landscape: position(crop?.landscape), portrait: position(crop?.portrait) }]));
  return p;
}
