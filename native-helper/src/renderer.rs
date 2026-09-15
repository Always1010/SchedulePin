use crate::model::{DesktopLayout, DesktopSnapshot, MonitorInfo, PlanItem};
use base64::{engine::general_purpose::STANDARD, Engine};
use resvg::{tiny_skia, usvg};
use std::{fs, path::Path};

#[derive(Clone, Copy)]
struct ThemePalette {
    panel: &'static str,
    title: &'static str,
    accent: &'static str,
    text: &'static str,
    muted: &'static str,
    control: &'static str,
    completed: &'static str,
}

fn theme_palette(theme: &str) -> ThemePalette {
    match theme {
        "light" => ThemePalette {
            panel: "#f2f8f5", title: "#20352c", accent: "#4f806c", text: "#2d3c35",
            muted: "#77857e", control: "#9bada4", completed: "#729381",
        },
        "dark" => ThemePalette {
            panel: "#252e2a", title: "#f0f4f1", accent: "#e39a82", text: "#e3eae6",
            muted: "#9da8a2", control: "#65736c", completed: "#789889",
        },
        _ => ThemePalette {
            panel: "#f7f5ef", title: "#27332e", accent: "#bd6956", text: "#343c38",
            muted: "#879089", control: "#aeb7b2", completed: "#789889",
        },
    }
}

fn xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn shorten(value: &str, max: usize) -> String {
    let mut chars = value.chars();
    let text: String = chars.by_ref().take(max).collect();
    if chars.next().is_some() { format!("{text}…") } else { text }
}

fn wrap_text(value: &str, max_chars: usize, max_lines: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in value.lines() {
        let characters: Vec<char> = paragraph.trim().chars().collect();
        if characters.is_empty() { continue; }
        for chunk in characters.chunks(max_chars.max(1)) {
            if lines.len() == max_lines { break; }
            lines.push(chunk.iter().collect());
        }
        if lines.len() == max_lines { break; }
    }
    if lines.is_empty() { lines.push("写下希望长期遵循的做事原则。".into()); }
    lines
}

fn image_data(path: Option<&Path>) -> Option<String> {
    let path = path.filter(|value| value.is_file())?;
    let mime = match path.extension()?.to_string_lossy().to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => return None,
    };
    let content = fs::read(path).ok()?;
    Some(format!("data:{mime};base64,{}", STANDARD.encode(content)))
}

fn visible_items<'a>(snapshot: &'a DesktopSnapshot, kind: &str) -> Vec<&'a PlanItem> {
    let mut items: Vec<_> = snapshot.items.iter().filter(|item| {
        item.archived_at.is_none() && item.kind == kind && (
            kind == "task" || item.scheduled_date == snapshot.date || item.recurring_daily
        )
    }).collect();
    items.sort_by_key(|item| item.sort_order);
    items
}

fn is_completed(item: &PlanItem, date: &str) -> bool {
    item.completed && (!item.recurring_daily || item.completed_date.as_deref() == Some(date))
}

fn font_family(value: &str) -> &'static str {
    match value {
        "reading" => "Noto Serif SC, SimSun, serif",
        "rounded" => "Microsoft YaHei UI, Noto Sans SC, sans-serif",
        "system" => "Segoe UI, Microsoft YaHei UI, sans-serif",
        _ => "Segoe UI, Noto Sans SC, Microsoft YaHei, sans-serif",
    }
}

fn plan_content(snapshot: &DesktopSnapshot, x: f64, y: f64, width: f64, height: f64) -> String {
    let tasks = visible_items(snapshot, "task");
    let palette = theme_palette(&snapshot.settings.theme);
    let font_scale = snapshot.settings.font_scale.clamp(0.85, 1.25);
    let padding = (width * 0.055).clamp(18.0, 42.0);
    let title_size = (width * 0.055).clamp(22.0, 42.0) * font_scale;
    let body_size = (width * 0.029).clamp(14.0, 24.0) * font_scale;
    let small_size = (body_size * 0.72).max(11.0);
    let mut cursor = y + padding + title_size;
    let max_chars = ((width - padding * 2.0) / (body_size * 0.62)).max(8.0) as usize;
    let mut output = format!(
        r##"<text x="{}" y="{}" font-size="{}" font-weight="700" fill="{}">SchedulePin</text>
        <text x="{}" y="{}" font-size="{}" font-weight="600" fill="{}">今天 · {}</text>"##,
        x + padding, cursor, title_size, palette.title,
        x + padding, cursor + small_size * 1.9, small_size, palette.accent, xml(&snapshot.date)
    );
    cursor += small_size * 4.0;

    let principle = if snapshot.settings.principle.trim().is_empty() {
        "写下希望长期遵循的做事原则。"
    } else {
        snapshot.settings.principle.trim()
    };
    let principle_size = body_size * 0.78 * snapshot.settings.principle_font_scale.clamp(0.75, 1.6);
    let principle_max_chars = ((width - padding * 2.6) / (principle_size * 0.62)).max(8.0) as usize;
    let principle_lines = wrap_text(principle, principle_max_chars, 5);
    let principle_height = principle_size * (3.2 + principle_lines.len() as f64 * 1.35);
    let (principle_background, principle_accent, principle_foreground) = match snapshot.settings.principle_theme.as_str() {
        "ink" => ("#303648", "#c1b7e8", "#f5f4fa"),
        "paper" => ("#eee2cf", "#a45d49", "#49423b"),
        "sunset" => ("#8d4e40", "#ffd0ae", "#fff8f4"),
        _ => ("#30463d", "#f2b39b", "#f5f4ef"),
    };
    let principle_weight = match snapshot.settings.principle_text_style.as_str() {
        "medium" => "500",
        "bold" => "700",
        _ => "400",
    };
    let principle_font_family = font_family(&snapshot.settings.principle_font_family);
    output.push_str(&format!(r##"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}"/>
      <g font-family="{}"><text x="{}" y="{}" font-size="{}" font-weight="700" fill="{}">PRINCIPLE</text>"##,
      x + padding * 0.72, cursor - body_size, width - padding * 1.44, principle_height,
      body_size * 0.7, principle_background, principle_font_family,
      x + padding * 1.3, cursor, principle_size, principle_accent));
    cursor += principle_size * 1.65;
    for line in principle_lines {
        output.push_str(&format!(r##"<text x="{}" y="{}" font-size="{}" font-weight="{}" fill="{}">{}</text>"##,
          x + padding * 1.3, cursor, principle_size, principle_weight, principle_foreground, xml(&line)));
        cursor += principle_size * 1.35;
    }
    output.push_str("</g>");
    cursor += principle_size * 1.4;

    output.push_str(&format!(r##"<text x="{}" y="{}" font-size="{}" font-weight="700" fill="{}">To-Do List</text>"##, x + padding, cursor, body_size, palette.title));
    cursor += body_size * 1.75;
    for task in tasks.iter().take(8) {
        if cursor > y + height - padding { break; }
        let completed = is_completed(task, &snapshot.date);
        let color = if completed { palette.muted } else { palette.text };
        output.push_str(&format!(
            r##"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}" stroke="{}" stroke-width="2"/>
            <text x="{}" y="{}" font-size="{}" fill="{}"{}>{}</text>"##,
            x + padding, cursor - body_size * 0.7, body_size * 0.78, body_size * 0.78,
            body_size * 0.2, if completed { palette.completed } else { "none" }, palette.control,
            x + padding + body_size * 1.25, cursor, body_size, color,
            if completed { " text-decoration=\"line-through\"" } else { "" },
            xml(&shorten(&task.title, max_chars))
        ));
        if let Some(time) = &task.start_time {
            output.push_str(&format!(r##"<text x="{}" y="{}" font-size="{}" text-anchor="end" fill="{}">{}</text>"##, x + width - padding * 1.1, cursor, small_size, palette.muted, xml(time)));
        }
        cursor += body_size * 1.65;
    }
    output
}

pub fn render_wallpaper(
    monitor: &MonitorInfo,
    background: Option<&Path>,
    snapshot: &DesktopSnapshot,
    layout: &DesktopLayout,
    destination: &Path,
) -> Result<(), String> {
    let screen_width = monitor.width.max(640) as f64;
    let screen_height = monitor.height.max(480) as f64;
    let width = (layout.width.clamp(0.18, 1.0) * screen_width).max(320.0);
    let height = (layout.height.clamp(0.28, 1.0) * screen_height).max(360.0);
    let x = (layout.x.clamp(0.0, 1.0) * screen_width).min(screen_width - width);
    let y = (layout.y.clamp(0.0, 1.0) * screen_height).min(screen_height - height);
    let background_svg = image_data(background).map(|data| format!(r##"<image href="{data}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>"##)).unwrap_or_else(|| r##"<rect width="100%" height="100%" fill="url(#background)"/>"##.into());
    let opacity = snapshot.settings.opacity.clamp(0.35, 1.0);
    let radius = snapshot.settings.card_radius.clamp(8.0, 30.0);
    let palette = theme_palette(&snapshot.settings.theme);
    let font_family = font_family(&snapshot.settings.font_family);
    let content = plan_content(snapshot, x, y, width, height);
    let svg = format!(r##"<svg xmlns="http://www.w3.org/2000/svg" width="{screen_width}" height="{screen_height}" viewBox="0 0 {screen_width} {screen_height}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#879c95"/><stop offset="0.5" stop-color="#d7cabe"/><stop offset="1" stop-color="#738b81"/></linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#25332d" flood-opacity="0.24"/></filter>
      </defs>
      {background_svg}
      <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{}" fill-opacity="{opacity}" filter="url(#shadow)"/>
      <g font-family="{font_family}">{content}</g>
    </svg>"##, palette.panel);

    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();
    let tree = usvg::Tree::from_data(svg.as_bytes(), &options).map_err(|error| format!("无法解析壁纸模板：{error}"))?;
    let mut pixmap = tiny_skia::Pixmap::new(monitor.width, monitor.height).ok_or_else(|| "无法分配壁纸画布".to_string())?;
    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());
    pixmap.save_png(destination).map_err(|error| format!("无法保存计划壁纸：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AppSettings, DesktopSnapshot};
    use std::collections::HashMap;

    fn test_snapshot() -> DesktopSnapshot {
        DesktopSnapshot {
            protocol_version: 1, date: "2026-09-14".into(), generated_at: "now".into(), items: vec![],
            settings: AppSettings {
                principle: "完成当前任务再开始下一项。".into(), theme: "warm".into(), font_family: "modern".into(),
                principle_theme: "forest".into(), principle_font_family: "modern".into(),
                principle_font_scale: 1.0, principle_text_style: "regular".into(),
                font_scale: 1.0, density: "comfortable".into(), card_radius: 20.0, opacity: 0.86,
                display_mode: "single".into(), selected_monitor_id: None, desktop_enabled: true, layouts: HashMap::new(),
            },
        }
    }

    #[test]
    fn renders_a_png_without_original_wallpaper() {
        let monitor = MonitorInfo { id: "test".into(), index: 0, name: "测试".into(), x: 0, y: 0, width: 800, height: 450, primary: true };
        let snapshot = test_snapshot();
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("wallpaper.png");
        render_wallpaper(&monitor, None, &snapshot, &DesktopLayout::default(), &target).unwrap();
        assert!(fs::metadata(target).unwrap().len() > 1_000);
    }

    #[test]
    fn appearance_changes_produce_a_different_wallpaper() {
        let monitor = MonitorInfo { id: "test".into(), index: 0, name: "测试".into(), x: 0, y: 0, width: 800, height: 450, primary: true };
        let mut snapshot = test_snapshot();
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("warm-forest.png");
        let customized = directory.path().join("dark-paper.png");

        render_wallpaper(&monitor, None, &snapshot, &DesktopLayout::default(), &original).unwrap();
        snapshot.settings.theme = "dark".into();
        snapshot.settings.principle_theme = "paper".into();
        snapshot.settings.principle_font_family = "reading".into();
        snapshot.settings.principle_font_scale = 1.45;
        snapshot.settings.principle_text_style = "bold".into();
        render_wallpaper(&monitor, None, &snapshot, &DesktopLayout::default(), &customized).unwrap();

        assert_ne!(fs::read(original).unwrap(), fs::read(customized).unwrap());
    }
}
