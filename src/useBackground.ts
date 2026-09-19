import { useEffect, useRef, useState } from "react";
import { backgroundDay, defaultBackground, shouldRotate, type Wallpaper } from "./backgroundModel";
import { cacheWallpapers, readBackground, saveBackground, subscribeBackground, trimBackgroundCache } from "./backgroundStore";
import { discoverWallpapers, downloadWallpaper } from "./backgroundSource";

const SESSION_WALLPAPER_KEY = "schedulepin.background.window-current.v1";

export function useBlobUrl(blob?: Blob) {
  const [value, setValue] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => { if (!blob) { setValue(null); return; } const url = URL.createObjectURL(blob); setValue({ blob, url }); return () => URL.revokeObjectURL(url); }, [blob]);
  return value?.blob === blob ? value?.url : undefined;
}
export async function nextWallpaper(preferences: typeof defaultBackground, wallpapers: Wallpaper[]) {
  const available = wallpapers.filter(w => w.favorite && w.id !== preferences.currentId);
  if (preferences.pool === "favorites") {
    if (!available.length) throw new Error("收藏中没有其他壁纸，请先添加图片。");
    return available[Math.floor(Math.random() * available.length)];
  }
  const candidates = (await discoverWallpapers(preferences.category, Math.floor(Math.random() * 4) * 12)).filter(w => w.id !== preferences.currentId);
  if (!candidates.length) throw new Error("暂时没有其他图片，请稍后再试。");
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  return wallpapers.find(w => w.id === next.id) ?? downloadWallpaper(next);
}
export function useBackground(enabled: boolean) {
  const [state, setState] = useState<{ preferences: typeof defaultBackground; wallpapers: Wallpaper[] }>({ preferences: defaultBackground, wallpapers: [] });
  const [windowCurrent, setWindowCurrent] = useState<Wallpaper>();
  const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const attempted = useRef(false);
  const selectForWindow = (item?: Wallpaper) => {
    setWindowCurrent(item);
    if (item) {
      setState(previous => ({ ...previous, wallpapers: previous.wallpapers.some(wallpaper => wallpaper.id === item.id) ? previous.wallpapers : [...previous.wallpapers, item] }));
      try { sessionStorage.setItem(SESSION_WALLPAPER_KEY, item.id); } catch { /* Session storage may be unavailable in restricted contexts. */ }
    }
  };
  useEffect(() => {
    let active = true, version = 0;
    const refresh = async () => { const request = ++version; try { const next = await readBackground(); if (active && request === version) { setState(next); setReady(true); } } catch { if (active) setError("无法读取本地壁纸库，请重试。"); } };
    void refresh(); const stop = subscribeBackground(change => { if (change !== "cache") void refresh(); }); return () => { active = false; stop(); };
  }, []);
  useEffect(() => { if (state.preferences.mode !== "open") setWindowCurrent(undefined); }, [state.preferences.mode]);
  useEffect(() => {
    if (!ready || !enabled || attempted.current) return;
    attempted.current = true;
    if (!shouldRotate(state.preferences)) return;
    let active = true;
    void (async () => {
      try {
        let previousId = state.preferences.currentId;
        try { previousId = sessionStorage.getItem(SESSION_WALLPAPER_KEY) ?? previousId; } catch { /* Use the persisted fallback. */ }
        const next = await nextWallpaper({ ...state.preferences, currentId: previousId }, state.wallpapers);
        while (active && (document.visibilityState !== "visible" || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open], [role="dialog"]'))) await new Promise(resolve => setTimeout(resolve, 500));
        if (active && state.preferences.mode === "open") {
          await cacheWallpapers([next]); selectForWindow(next); await trimBackgroundCache();
        } else if (active) {
          await saveBackground({ currentId: next.id, lastDay: backgroundDay() }, [next], state.preferences.revision); await trimBackgroundCache();
        }
      } catch { if (active) setError("自动换图未成功，已保留当前背景。可打开壁纸库重试。"); }
    })();
    return () => { active = false; };
  }, [ready, enabled]); // Preferences are intentionally captured once per page opening.
  const current = windowCurrent ? state.wallpapers.find(w => w.id === windowCurrent.id) ?? windowCurrent : state.wallpapers.find(w => w.id === state.preferences.currentId);
  return { ...state, ready, error, setError, current, selectForWindow };
}
