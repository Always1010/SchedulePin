import type { CSSProperties } from "react";
import type { AppSettings } from "../types";
import type { BackgroundPreferences, Wallpaper } from "../backgroundModel";
import { useBlobUrl } from "../useBackground";
import "./background.css";

export function backgroundSettings(settings: AppSettings, prefs?: BackgroundPreferences): AppSettings {
  return prefs && prefs.appearance !== "inherit" ? { ...settings, theme: prefs.appearance } : settings;
}
export function backgroundClass(prefs?: BackgroundPreferences) { return prefs ? `background-enabled background-${prefs.style}${prefs.principleFollow ? " background-follow-principle" : ""}` : ""; }
export function backgroundStyle(prefs?: BackgroundPreferences, current?: Wallpaper): CSSProperties {
  if (!prefs) return {};
  const accents = { green: "#518d78", blue: "#528cca", violet: "#9b75c8", orange: "#ce8155" };
  const accent = prefs.accent === "auto" ? current?.accent : prefs.accent === "original" ? undefined : accents[prefs.accent];
  return { ...(accent ? { "--design-accent": accent } : {}), "--background-overlay": prefs.overlay / 100, "--background-blur": `${prefs.blur}px`, "--background-panel": `${prefs.panelOpacity}%` } as CSSProperties;
}
export function BackgroundLayer({ preferences, current }: { preferences: BackgroundPreferences; current?: Wallpaper }) {
  const url = useBlobUrl(current?.blob);
  const crop = current ? preferences.positions[current.id] : undefined;
  return <div className="background-layer" data-wallpaper-id={current?.id} aria-hidden="true" style={{ "--background-landscape": `${crop?.landscape.x ?? 50}% ${crop?.landscape.y ?? 50}%`, "--background-portrait": `${crop?.portrait.x ?? 50}% ${crop?.portrait.y ?? 50}%` } as CSSProperties}>
    {preferences.style === "photo" && url && <img src={url} alt="" />}
    <div className="background-shade" />
  </div>;
}
