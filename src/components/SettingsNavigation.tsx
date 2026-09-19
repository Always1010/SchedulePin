import { CalendarDays, ExternalLink, Image, LayoutPanelTop, Monitor, Palette, PanelRight, Type } from "lucide-react";
import "./settings-navigation.css";

export type SettingsSection = "style" | "background" | "shortcuts" | "tasks" | "principle" | "assistant" | "monitor" | "layout";

const browserSections: Array<{ id: SettingsSection; label: string; icon: typeof Palette }> = [
  { id: "style", label: "整体样式", icon: Palette },
  { id: "background", label: "页面背景", icon: Image },
  { id: "shortcuts", label: "快捷导航", icon: ExternalLink },
  { id: "tasks", label: "待办区域", icon: LayoutPanelTop },
  { id: "principle", label: "原则卡片", icon: Type },
];
const desktopSections: Array<{ id: SettingsSection; label: string; icon: typeof Monitor }> = [
  { id: "assistant", label: "桌面助手", icon: Monitor },
  { id: "monitor", label: "显示器", icon: PanelRight },
  { id: "layout", label: "计划布局", icon: CalendarDays },
];

export function SettingsNavigation({ section, onSelect }: { section: SettingsSection; onSelect: (section: SettingsSection) => void }) {
  const renderGroup = (title: string, entries: typeof browserSections) => <section className="settings-nav-group">
    <h2>{title}</h2>
    {entries.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => onSelect(id)}>
      <Icon size={16} /><span>{label}</span>
    </button>)}
  </section>;
  return <nav className="settings-navigation" aria-label="设置分类">
    {renderGroup("浏览器页面", browserSections)}
    {renderGroup("桌面展示", desktopSections)}
  </nav>;
}
