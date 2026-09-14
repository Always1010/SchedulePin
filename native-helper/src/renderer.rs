use crate::model::{DesktopLayout, DesktopSnapshot, MonitorInfo, PlanItem};
use base64::{engine::general_purpose::STANDARD, Engine};
use resvg::{tiny_skia, usvg};
use std::{fs, path::Path};

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
    snapshot.items.iter().filter(|item| {
        item.kind == kind && (item.scheduled_date == snapshot.date || item.recurring_daily)
    }).collect()
}

fn plan_content(snapshot: &DesktopSnapshot, x: f64, y: f64, width: f64, height: f64) -> String {
    let tasks = visible_items(snapshot, "task");
    let disciplines = visible_items(snapshot, "discipline");
    let notes = visible_items(snapshot, "note");
    let padding = (width * 0.055).clamp(18.0, 42.0);
    let title_size = (width * 0.055).clamp(22.0, 42.0);
    let body_size = (width * 0.029).clamp(14.0, 24.0);
    let small_size = (body_size * 0.72).max(11.0);
    let mut cursor = y + padding + title_size;
    let max_chars = ((width - padding * 2.0) / (body_size * 0.62)).max(8.0) as usize;
    let mut output = format!(
        r##"<text x="{}" y="{}" font-size="{}" font-weight="700" fill="#27332e">SchedulePin</text>
        <text x="{}" y="{}" font-size="{}" font-weight="600" fill="#bd6956">今天 · {}</text>"##,
        x + padding, cursor, title_size, x + padding, cursor + small_size * 1.9, small_size, xml(&snapshot.date)
    );
    cursor += small_size * 4.0;

    output.push_str(&format!(r##"<text x="{}" y="{}" font-size="{}" font-weight="700" fill="#46534d">今日重点</text>"##, x + padding, cursor, body_size));
    cursor += body_size * 1.65;
    for task in tasks.iter().take(5) {
        if cursor > y + height * 0.62 { break; }
        let color = if task.completed { "#87918c" } else { "#343c38" };
        output.push_str(&format!(
            r##"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}" stroke="#aeb7b2" stroke-width="2"/>
            <text x="{}" y="{}" font-size="{}" fill="{}"{}>{}</text>"##,
            x + padding, cursor - body_size * 0.7, body_size * 0.78, body_size * 0.78,
            body_size * 0.2, if task.completed { "#789889" } else { "none" },
            x + padding + body_size * 1.25, cursor, body_size, color,
            if task.completed { " text-decoration=\"line-through\"" } else { "" },
            xml(&shorten(&task.title, max_chars))
        ));
        if let Some(time) = &task.start_time {
            output.push_str(&format!(r##"<text x="{}" y="{}" font-size="{}" fill="#879089">{}</text>"##, x + padding + body_size * 1.25, cursor + small_size * 1.45, small_size, xml(time)));
            cursor += small_size * 1.35;
        }
        cursor += body_size * 1.65;
    }

    if !disciplines.is_empty() && cursor < y + height * 0.78 {
        cursor += body_size * 0.5;
        output.push_str(&format!(r##"<line x1="{}" x2="{}" y1="{}" y2="{}" stroke="#d9ddd8"/><text x="{}" y="{}" font-size="{}" font-weight="700" fill="#6d765f">每日纪律</text>"##, x + padding, x + width - padding, cursor, cursor, x + padding, cursor + body_size * 1.8, body_size));
        cursor += body_size * 3.2;
        for item in disciplines.iter().take(3) {
            output.push_str(&format!(r##"<circle cx="{}" cy="{}" r="{}" fill="{}"/><text x="{}" y="{}" font-size="{}" fill="#4f5853">{}</text>"##, x + padding + body_size * 0.35, cursor - body_size * 0.28, body_size * 0.28, if item.completed { "#789889" } else { "#d7dcd7" }, x + padding + body_size * 1.2, cursor, body_size * 0.9, xml(&shorten(&item.title, max_chars))));
            cursor += body_size * 1.55;
        }
    }

    if let Some(note) = notes.first() {
        let note_y = (y + height - padding - body_size * 3.0).max(cursor + body_size);
        output.push_str(&format!(r##"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="#eef2e8"/><text x="{}" y="{}" font-size="{}" font-weight="700" fill="#627065">备忘</text><text x="{}" y="{}" font-size="{}" fill="#6e7771">{}</text>"##, x + padding, note_y, width - padding * 2.0, body_size * 2.5, body_size * 0.5, x + padding * 1.45, note_y + body_size, small_size, x + padding * 1.45, note_y + body_size * 1.9, small_size, xml(&shorten(&note.title, max_chars))));
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
    let content = plan_content(snapshot, x, y, width, height);
    let svg = format!(r##"<svg xmlns="http://www.w3.org/2000/svg" width="{screen_width}" height="{screen_height}" viewBox="0 0 {screen_width} {screen_height}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#879c95"/><stop offset="0.5" stop-color="#d7cabe"/><stop offset="1" stop-color="#738b81"/></linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#25332d" flood-opacity="0.24"/></filter>
      </defs>
      {background_svg}
      <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="28" fill="#f7f5ef" fill-opacity="{opacity}" filter="url(#shadow)"/>
      {content}
    </svg>"##);

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

    #[test]
    fn renders_a_png_without_original_wallpaper() {
        let monitor = MonitorInfo { id: "test".into(), index: 0, name: "测试".into(), x: 0, y: 0, width: 800, height: 450, primary: true };
        let snapshot = DesktopSnapshot {
            protocol_version: 1, date: "2026-09-14".into(), generated_at: "now".into(), items: vec![],
            settings: AppSettings { opacity: 0.86, display_mode: "single".into(), selected_monitor_id: None, desktop_enabled: true, layouts: HashMap::new() },
        };
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("wallpaper.png");
        render_wallpaper(&monitor, None, &snapshot, &DesktopLayout::default(), &target).unwrap();
        assert!(fs::metadata(target).unwrap().len() > 1_000);
    }
}
