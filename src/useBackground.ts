import { useEffect, useRef, useState } from "react";
import { backgroundDay, defaultBackground, shouldRotate, type Wallpaper } from "./backgroundModel";
import { readBackground, saveBackground, subscribeBackground, trimBackgroundCache } from "./backgroundStore";
import { discoverWallpapers, downloadWallpaper } from "./backgroundSource";

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
  const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const attempted = useRef(false);
  useEffect(() => {
    let active = true, version = 0;
    const refresh = async () => { const request = ++version; try { const next = await readBackground(); if (active && request === version) { setState(next); setReady(true); } } catch { if (active) setError("无法读取本地壁纸库，请重试。"); } };
    void refresh(); const stop = subscribeBackground(refresh); return () => { active = false; stop(); };
  }, []);
  useEffect(() => {
    if (!ready || !enabled || attempted.current) return;
    attempted.current = true;
    if (!shouldRotate(state.preferences)) return;
    let active = true;
    void (async () => {
      try {
        const next = await nextWallpaper(state.preferences, state.wallpapers);
        while (active && (document.visibilityState !== "visible" || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open], [role="dialog"]'))) await new Promise(resolve => setTimeout(resolve, 500));
        if (active) { await saveBackground({ currentId: next.id, lastDay: backgroundDay() }, [next], state.preferences.revision); await trimBackgroundCache(); }
      } catch { if (active) setError("自动换图未成功，已保留当前背景。可打开壁纸库重试。"); }
    })();
    return () => { active = false; };
  }, [ready, enabled]); // Preferences are intentionally captured once per page opening.
  return { ...state, ready, error, setError, current: state.wallpapers.find(w => w.id === state.preferences.currentId) };
}
