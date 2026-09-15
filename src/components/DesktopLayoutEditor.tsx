import { useRef } from "react";
import type { AppSettings, DesktopLayout, MonitorInfo } from "../types";
import { visualDesignStyle } from "../visualDesign";

interface Props {
  monitor: MonitorInfo;
  layout: DesktopLayout;
  settings: AppSettings;
  onChange: (layout: DesktopLayout) => void;
}

type Gesture = {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  layout: DesktopLayout;
} | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const desktopFontScale = (value: number) => value >= 1 ? 1 + (value - 1) * .55 : 1 - (1 - value) * .8;

export const defaultDesktopLayout: DesktopLayout = { x: 0.68, y: 0.06, width: 0.28, height: 0.82 };

export function DesktopLayoutEditor({ monitor, layout, settings, onChange }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(null);

  const begin = (event: React.PointerEvent<HTMLElement>, mode: "move" | "resize") => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { mode, startX: event.clientX, startY: event.clientY, layout };
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    const bounds = surface.current?.getBoundingClientRect();
    if (!current || !bounds) return;
    const dx = (event.clientX - current.startX) / bounds.width;
    const dy = (event.clientY - current.startY) / bounds.height;

    if (current.mode === "move") {
      onChange({
        ...current.layout,
        x: clamp(current.layout.x + dx, 0, 1 - current.layout.width),
        y: clamp(current.layout.y + dy, 0, 1 - current.layout.height),
      });
    } else {
      onChange({
        ...current.layout,
        width: clamp(current.layout.width + dx, 0.18, 1 - current.layout.x),
        height: clamp(current.layout.height + dy, 0.28, 1 - current.layout.y),
      });
    }
  };

  return (
    <div className="desktop-designer">
      <div className="designer-label"><span>{monitor.name}</span><small>{monitor.width} × {monitor.height}</small></div>
      <div
        ref={surface}
        className="monitor-preview"
        style={{ aspectRatio: `${monitor.width} / ${monitor.height}` }}
        onPointerMove={move}
        onPointerUp={() => { gesture.current = null; }}
        onPointerCancel={() => { gesture.current = null; }}
      >
        <div className="preview-wallpaper-glow" />
        <div
          className={`preview-plan-card theme-${settings.theme} font-${settings.fontFamily} principle-theme-${settings.principleTheme} principle-font-${settings.principleFontFamily} principle-style-${settings.principleTextStyle}`}
          style={{
            ...visualDesignStyle(settings),
            left: `${layout.x * 100}%`, top: `${layout.y * 100}%`,
            width: `${layout.width * 100}%`, height: `${layout.height * 100}%`,
            opacity: settings.opacity,
            "--font-scale": desktopFontScale(settings.fontScale),
            "--principle-font-scale": desktopFontScale(settings.principleFontScale),
            "--card-radius": `${settings.cardRadius}px`,
          } as React.CSSProperties}
          onPointerDown={(event) => begin(event, "move")}
        >
          <div className="preview-desktop-brand"><b>✓</b><strong>SchedulePin</strong></div>
          <div className="preview-desktop-day"><span>今天</span><strong>9月15日</strong><i>33%</i></div>
          <div className="preview-desktop-principle"><small>HOW I WORK</small><strong>Principle</strong><span>{settings.principle || "写下希望长期遵循的做事原则。"}</span></div>
          <div className="preview-desktop-todos"><strong>To-Do List</strong><i /><i /><i /></div>
          <b className="preview-resize" onPointerDown={(event) => begin(event, "resize")} />
        </div>
      </div>
      <p>拖动计划卡片移动位置，拖动右下角调整大小。这里的变化会按比例应用到真实显示器。</p>
    </div>
  );
}
