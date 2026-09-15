import type { CSSProperties } from "react";
import design from "../shared/visual-design.json";
import type { AppSettings } from "./types";

type DesignVariables = CSSProperties & Record<`--${string}`, string | number>;

const mix = (minimum: number, maximum: number, ratio: number) => minimum + (maximum - minimum) * ratio;
const px = (minimum: number, maximum: number, ratio: number) => `${mix(minimum, maximum, ratio).toFixed(1)}px`;

export function visualDesignStyle(settings: AppSettings): DesignVariables {
  const themeName = settings.theme === "system" ? "warm" : settings.theme;
  const theme = design.themes[themeName];
  const principle = design.principleThemes[settings.principleTheme];
  const density = Math.min(100, Math.max(0, settings.densityLevel)) / 100;

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
    "--density-page-top": px(22, 46, density),
    "--density-page-bottom": px(72, 116, density),
    "--density-compact-page-top": px(16, 28, density),
    "--density-hero-bottom": px(17, 29, density),
    "--density-section-gap": px(12, 24, density),
    "--density-card-padding-y": px(16, 30, density),
    "--density-card-padding-bottom": px(14, 22, density),
    "--density-card-padding-x": px(17, 29, density),
    "--density-principle-padding-bottom": px(17, 31, density),
    "--density-principle-padding-x": px(19, 31, density),
    "--density-compact-card-padding-y": px(12, 22, density),
    "--density-principle-heading-gap": px(9, 19, density),
    "--density-principle-line-height": mix(1.65, 2.15, density).toFixed(2),
    "--density-todo-heading-gap": px(8, 16, density),
    "--density-row-height": px(46, 76, density),
    "--density-row-padding-y": px(4, 14, density),
    "--density-quick-add-gap": px(8, 16, density),
    "--density-quick-add-padding-y": px(9, 15, density),
    "--density-preview-page-top": px(18, 36, density),
    "--density-preview-page-bottom": px(27, 45, density),
    "--density-preview-day-gap": px(10, 22, density),
    "--density-preview-card-gap": px(9, 17, density),
    "--density-preview-card-padding-y": px(11, 21, density),
    "--density-preview-card-padding-x": px(14, 22, density),
    "--density-preview-todo-padding": px(12, 20, density),
    "--density-preview-row-height": px(31, 45, density),
    "--density-preview-input-gap": px(6, 12, density),
    "--density-preview-input-padding-y": px(6, 12, density),
    "--density-compact-preview-page-top": px(12, 24, density),
    "--density-compact-preview-card-padding-y": px(9, 17, density),
    "--density-compact-preview-todo-padding": px(9, 15, density),
  };
}
