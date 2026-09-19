import type { ReactNode } from "react";
import type { NavigationAction, NavigationData, NewTabPreferences } from "../navigation";
import { ShortcutPanel } from "./ShortcutPanel";
import "./newtab.css";

export function NewTabLayout({ data, preferences, onAction, onPreferences, children }: {
  data: NavigationData;
  preferences: NewTabPreferences;
  onAction?: (action: NavigationAction) => Promise<void>;
  onPreferences?: (patch: Partial<NewTabPreferences>) => Promise<void>;
  children: ReactNode;
}) {
  return <div className="newtab-container">
    <div className={`newtab-workspace navigation-${preferences.side}`}>
      <div className="newtab-navigation"><ShortcutPanel data={data} preferences={preferences} onAction={onAction} onPreferences={onPreferences} /></div>
      <div className="newtab-plan-region" role="region" aria-label="计划区域">{children}</div>
    </div>
  </div>;
}
