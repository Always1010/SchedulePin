import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, PanelRight, Settings } from "lucide-react";
import type { AppSettings, PlanItem } from "../types";
import type { NavigationData, NewTabPreferences } from "../navigation";
import { visualDesignStyle } from "../visualDesign";
import { NewTabLayout } from "./NewTabLayout";
import { PlanView, PrincipleCard } from "./PlanView";
import type { BackgroundPreferences, Wallpaper } from "../backgroundModel";
import { BackgroundLayer, backgroundClass, backgroundSettings, backgroundStyle } from "./BackgroundLayer";
import "./appearance-preview.css";

export type PreviewMode = "newtab" | "portrait" | "sidepanel";
const sizes = { newtab: { width: 1280, height: 900 }, portrait: { width: 900, height: 1400 }, sidepanel: { width: 360, height: 850 } };
const labels = { newtab: "新标签页横屏", portrait: "新标签页大竖屏", sidepanel: "浏览器侧边栏" };
const frameMarkup = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>';

export function AppearancePreview({ settings: originalSettings, tasks, navigation, preferences, mode, background, wallpaper }: {
  settings: AppSettings; tasks: PlanItem[]; navigation: NavigationData; preferences: NewTabPreferences; mode: PreviewMode; background?: BackgroundPreferences; wallpaper?: Wallpaper;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(600);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const size = sizes[mode];
  const scale = Math.min(1, available / size.width);
  const sidePanel = mode === "sidepanel";
  const bg = sidePanel ? undefined : background;
  const settings = backgroundSettings(originalSettings, bg);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setAvailable(Math.max(1, node.clientWidth)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const appearance = `theme-${settings.theme} font-${settings.fontFamily} principle-theme-${settings.principleTheme} principle-font-${settings.principleFontFamily} principle-style-${settings.principleTextStyle}`;
  const plan = <PlanView settings={settings} tasks={tasks} sidePanel={sidePanel} principleExpanded={sidePanel || preferences.principleExpanded}
    onTogglePrinciple={sidePanel ? undefined : () => {}} onEditPrinciple={() => {}} onAddDetailed={() => {}} />;
  return <div ref={host} className="appearance-preview-host">
    <div className="appearance-preview-viewport" style={{ width: size.width * scale, height: size.height * scale }}>
      <iframe className="appearance-preview-frame" title={`${labels[mode]}只读预览`} srcDoc={frameMarkup}
        style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
        onLoad={event => {
          const doc = event.currentTarget.contentDocument;
          if (!doc) return;
          // A separate document gives the preview its own viewport and prevents the editor's theme leaking into it.
          document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
            const copy = node.cloneNode(true) as HTMLElement;
            if (node instanceof HTMLLinkElement) copy.setAttribute("href", node.href);
            doc.head.append(copy);
          });
          setPortalRoot(doc.getElementById("root"));
        }} />
    </div>
    <p className="appearance-preview-caption">{labels[mode]} · {size.width} × {size.height} · 只读预览</p>
    {portalRoot && createPortal(<div inert className={`app extension-app ${appearance} ${backgroundClass(bg)}${sidePanel ? " compact" : ""}`}
      style={{ ...visualDesignStyle(settings), ...backgroundStyle(bg,wallpaper), "--font-scale": settings.fontScale, "--principle-font-scale": settings.principleFontScale, "--card-radius": `${settings.cardRadius}px` } as React.CSSProperties}>
      {bg && <BackgroundLayer preferences={bg} current={wallpaper}/>}
      <header className="topbar"><div className="brand"><span className="brand-mark"><CalendarCheck size={19} /></span><span className="brand-copy"><strong>SchedulePin</strong><small className="desktop-status ready">{sidePanel ? "浏览器侧边栏" : "快捷访问 · 计划"}</small></span></div>
        <div className="topbar-actions">{!sidePanel && <button className="open-full-page-button todo-visibility"><PanelRight size={15} />{preferences.tasksVisible ? "收起待办" : "展开全部待办"}</button>}<button className="icon-button" aria-label="设置"><Settings size={18} /></button></div>
      </header>
      {sidePanel ? <main className="todo-main">{plan}</main> : <NewTabLayout data={navigation} preferences={preferences}>
        {preferences.tasksVisible ? plan : <div className="newtab-quiet"><PrincipleCard settings={settings} expanded={preferences.principleExpanded} onToggle={() => {}} onEdit={() => {}} /><p>计划已收起，需要时可以展开完整待办。</p><button><PanelRight size={16} />展开全部待办</button></div>}
      </NewTabLayout>}
    </div>, portalRoot)}
  </div>;
}
