import type { CSSProperties } from "react";
import design from "../shared/visual-design.json";
import type { AppSettings } from "./types";

type DesignVariables = CSSProperties & Record<`--design-${string}`, string | number>;

export function visualDesignStyle(settings: AppSettings): DesignVariables {
  const themeName = settings.theme === "system" ? "warm" : settings.theme;
  const theme = design.themes[themeName];
  const principle = design.principleThemes[settings.principleTheme];

  return {
    "--design-page": theme.page,
    "--design-surface": theme.surface,
    "--design-surface-opacity": `${theme.surfaceOpacity * 100}%`,
    "--design-title": theme.title,
    "--design-accent": theme.accent,
    "--design-text": theme.text,
    "--design-muted": theme.muted,
    "--design-divider": theme.divider,
    "--design-ring-track": theme.ringTrack,
    "--design-glow-primary": theme.glowPrimary,
    "--design-glow-secondary": theme.glowSecondary,
    "--design-principle-start": principle.start,
    "--design-principle-end": principle.end,
    "--design-principle-accent": principle.accent,
    "--design-principle-text": principle.text,
    "--design-principle-decoration": principle.decoration,
  };
}
