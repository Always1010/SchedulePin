use crate::model::{DesktopLayout, DesktopSnapshot, MonitorInfo, PlanItem};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{Datelike, NaiveDate};
use resvg::{tiny_skia, usvg};
use serde::Deserialize;
use std::{collections::HashMap, fs, path::Path, sync::OnceLock};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThemePalette {
    page: String,
    surface: String,
    surface_opacity: f64,
    surface_stroke: String,
    title: String,
    accent: String,
    text: String,
    muted: String,
    divider: String,
    ring_track: String,
    glow_primary: String,
    glow_secondary: String,
}

#[derive(Deserialize)]
struct PrinciplePalette {
    start: String,
    end: String,
    accent: String,
    text: String,
    decoration: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VisualDesign {
    themes: HashMap<String, ThemePalette>,
    principle_themes: HashMap<String, PrinciplePalette>,
}

fn visual_design() -> &'static VisualDesign {
    static DESIGN: OnceLock<VisualDesign> = OnceLock::new();
    DESIGN.get_or_init(|| serde_json::from_str(include_str!("../../shared/visual-design.json"))
        .expect("共享视觉配置必须是有效 JSON"))
}

fn theme_palette(theme: &str) -> &'static ThemePalette {
    let design = visual_design();
    let name = if theme == "system" { "warm" } else { theme };
    design.themes.get(name).unwrap_or_else(|| design.themes.get("warm").expect("缺少 warm 主题"))
}

fn principle_palette(theme: &str) -> &'static PrinciplePalette {
    let design = visual_design();
    design.principle_themes.get(theme)
        .unwrap_or_else(|| design.principle_themes.get("forest").expect("缺少 forest 原则主题"))
}

fn xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn glyph_units(value: char) -> f64 {
    if value.is_ascii_whitespace() { 0.34 }
    else if value.is_ascii_punctuation() { 0.48 }
    else if value.is_ascii_uppercase() { 0.68 }
    else if value.is_ascii() { 0.56 }
    else { 1.0 }
}

fn wrap_text(value: &str, max_units: f64) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in value.lines() {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            if !lines.is_empty() { lines.push(String::new()); }
            continue;
        }
        let mut line = String::new();
        let mut units = 0.0;
        for character in paragraph.chars() {
            let next = glyph_units(character);
            if !line.is_empty() && units + next > max_units.max(1.0) {
                lines.push(line);
                line = String::new();
                units = 0.0;
            }
            line.push(character);
            units += next;
        }
        if !line.is_empty() { lines.push(line); }
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

fn desktop_font_scale(value: f64) -> f64 {
    let value = value.clamp(0.75, 1.6);
    if value >= 1.0 { 1.0 + (value - 1.0) * 0.55 } else { 1.0 - (1.0 - value) * 0.8 }
}

fn date_label(value: &str) -> String {
    let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") else { return value.to_string(); };
    let weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
    format!("{}月{}日 · {}", date.month(), date.day(), weekdays[date.weekday().num_days_from_monday() as usize])
}

fn plan_content(snapshot: &DesktopSnapshot, x: f64, y: f64, width: f64, height: f64) -> String {
    let tasks = visible_items(snapshot, "task");
    let palette = theme_palette(&snapshot.settings.theme);
    let principle_palette = principle_palette(&snapshot.settings.principle_theme);
    let font_scale = desktop_font_scale(snapshot.settings.font_scale.clamp(0.85, 1.25));
    let padding = (width * 0.055).clamp(18.0, 42.0);
    let content_x = x + padding;
    let content_width = width - padding * 2.0;
    let body_size = (width * 0.022).clamp(13.0, 18.0) * font_scale;
    let small_size = (body_size * 0.72).max(9.0);
    let card_radius = snapshot.settings.card_radius.clamp(8.0, 30.0);
    let section_gap = match snapshot.settings.density.as_str() {
        "compact" => body_size * 0.8,
        "spacious" => body_size * 1.35,
        _ => body_size,
    };

    let brand_mark = body_size * 1.8;
    let brand_top = y + padding * 0.75;
    let brand_middle = brand_top + brand_mark * 0.5;
    let brand_text_x = content_x + brand_mark + body_size * 0.65;
    let header_bottom = brand_top + brand_mark + padding * 0.7;
    let mut output = format!(r##"
      <rect x="{content_x}" y="{brand_top}" width="{brand_mark}" height="{brand_mark}" rx="{}" fill="#2f413a"/>
      <text x="{}" y="{}" font-size="{}" text-anchor="middle" dominant-baseline="central" font-weight="700" fill="#ffffff">✓</text>
      <text x="{brand_text_x}" y="{}" font-size="{}" font-weight="700" fill="{}">SchedulePin</text>
      <text x="{brand_text_x}" y="{}" font-size="{}" fill="{}">To-Do · 桌面</text>
      <line x1="{x}" y1="{header_bottom}" x2="{}" y2="{header_bottom}" stroke="{}" stroke-width="1"/>
    "##,
      brand_mark * 0.32,
      content_x + brand_mark * 0.5, brand_middle, body_size,
      brand_middle - small_size * 0.18, body_size * 1.05, palette.title,
      brand_middle + small_size * 0.98, small_size * 0.72, palette.muted,
      x + width, palette.divider,
    );

    let day_top = header_bottom + padding * 0.72;
    let date_size = body_size * 1.7;
    let ring_size = (body_size * 4.2).clamp(52.0, 82.0);
    let ring_width = (ring_size * 0.09).clamp(5.0, 8.0);
    let ring_x = content_x + content_width - ring_size * 0.5;
    let ring_y = day_top + ring_size * 0.5;
    let ring_radius = ring_size * 0.5 - ring_width * 0.5;
    let circumference = std::f64::consts::TAU * ring_radius;
    let completed = tasks.iter().filter(|item| is_completed(item, &snapshot.date)).count();
    let progress = if tasks.is_empty() { 0.0 } else { completed as f64 / tasks.len() as f64 };
    let progress_percent = (progress * 100.0).round() as usize;
    let progress_length = circumference * progress;
    output.push_str(&format!(r##"
      <text x="{content_x}" y="{}" font-size="{}" font-weight="700" letter-spacing="{}" fill="{}">今天</text>
      <text x="{content_x}" y="{}" font-size="{date_size}" font-weight="700" fill="{}">{}</text>
      <text x="{content_x}" y="{}" font-size="{small_size}" fill="{}">完成的任务会保留到今天结束</text>
      <circle cx="{ring_x}" cy="{ring_y}" r="{ring_radius}" fill="none" stroke="{}" stroke-width="{ring_width}"/>
      <circle cx="{ring_x}" cy="{ring_y}" r="{ring_radius}" fill="none" stroke="#de806a" stroke-width="{ring_width}" stroke-linecap="round" stroke-dasharray="{progress_length} {circumference}" transform="rotate(-90 {ring_x} {ring_y})"/>
      <text x="{ring_x}" y="{}" text-anchor="middle" font-size="{}" font-weight="700" fill="{}">{progress_percent}%</text>
      <text x="{ring_x}" y="{}" text-anchor="middle" font-size="{}" fill="{}">{completed}/{}</text>
    "##,
      day_top + small_size, small_size * 0.82, small_size * 0.12, palette.accent,
      day_top + small_size + date_size * 1.06, palette.title, xml(&date_label(&snapshot.date)),
      day_top + small_size + date_size * 1.06 + small_size * 1.55, palette.muted,
      palette.ring_track,
      ring_y + body_size * 0.12, body_size * 0.88, palette.title,
      ring_y + body_size * 1.05, small_size * 0.72, palette.muted, tasks.len(),
    ));

    let mut cursor = day_top + ring_size + section_gap;

    let principle = if snapshot.settings.principle.trim().is_empty() {
        "写下希望长期遵循的做事原则。"
    } else {
        snapshot.settings.principle.trim()
    };
    let principle_size = body_size * desktop_font_scale(snapshot.settings.principle_font_scale);
    let principle_padding = padding * 0.78;
    let principle_max_units = (content_width - principle_padding * 2.0) / principle_size;
    let principle_lines = wrap_text(principle, principle_max_units);
    let principle_label_size = (principle_size * 0.58).max(7.0);
    let principle_title_size = principle_size * 1.28;
    let principle_label_y = cursor + principle_padding + principle_label_size;
    let principle_title_y = principle_label_y + principle_title_size * 1.15;
    let principle_first_line_y = principle_title_y + principle_size * 1.75;
    let principle_line_height = principle_size * 1.45;
    let principle_height = principle_first_line_y - cursor
        + principle_line_height * principle_lines.len().saturating_sub(1) as f64
        + principle_padding;
    let principle_weight = match snapshot.settings.principle_text_style.as_str() {
        "medium" => "500",
        "bold" => "700",
        _ => "400",
    };
    let principle_font_family = font_family(&snapshot.settings.principle_font_family);
    let principle_text_x = content_x + principle_padding;
    output.push_str(&format!(r##"
      <defs><clipPath id="principle-card"><rect x="{content_x}" y="{cursor}" width="{content_width}" height="{principle_height}" rx="{card_radius}"/></clipPath></defs>
      <g clip-path="url(#principle-card)">
        <rect x="{content_x}" y="{cursor}" width="{content_width}" height="{principle_height}" fill="url(#principle-background)"/>
        <circle cx="{}" cy="{}" r="{}" fill="{}" fill-opacity="0.18"/>
      </g>
      <g font-family="{principle_font_family}">
        <text x="{principle_text_x}" y="{}" font-size="{principle_label_size}" font-weight="700" letter-spacing="{}" fill="{}">HOW I WORK</text>
        <text x="{principle_text_x}" y="{}" font-size="{principle_title_size}" font-weight="700" fill="{}">Principle</text>
    "##,
      content_x + content_width * 0.92, cursor + principle_height * 0.06, content_width * 0.28, principle_palette.decoration,
      principle_label_y, principle_label_size * 0.14, principle_palette.accent,
      principle_title_y, principle_palette.text,
    ));
    let principle_top = cursor;
    cursor = principle_first_line_y;
    for line in principle_lines {
        output.push_str(&format!(r##"<text x="{principle_text_x}" y="{cursor}" font-size="{principle_size}" font-weight="{principle_weight}" fill="{}">{}</text>"##,
          principle_palette.text, xml(&line)));
        cursor += principle_size * 1.45;
    }
    output.push_str("</g>");
    cursor = principle_top + principle_height + section_gap;

    let todo_top = cursor;
    let todo_bottom = y + height - padding;
    let todo_padding = padding * 0.78;
    let todo_text_x = content_x + todo_padding;
    let todo_heading_y = todo_top + todo_padding + body_size;
    let todo_subtitle_y = todo_heading_y + small_size * 1.35;
    let rows_top = todo_subtitle_y + small_size * 1.3;
    let minimum_row_height = match snapshot.settings.density.as_str() {
        "compact" => body_size * 2.15,
        "spacious" => body_size * 3.05,
        _ => body_size * 2.58,
    };
    let available_height = (todo_bottom - todo_top).max(0.0);
    let title_width = content_width - todo_padding * 2.0;
    let title_line_height = body_size * 1.38;
    let mut rows: Vec<(&PlanItem, Vec<String>, f64)> = Vec::new();
    let rows_capacity = (available_height - (rows_top - todo_top) - todo_padding).max(0.0);
    let mut rows_height = 0.0;
    for (index, task) in tasks.iter().take(8).enumerate() {
        let title_lines = wrap_text(&task.title, title_width / body_size);
        let time_height = if task.start_time.is_some() || task.end_time.is_some() { small_size * 1.45 } else { 0.0 };
        let row_height = minimum_row_height.max(body_size * 0.74 + title_lines.len() as f64 * title_line_height + time_height);
        let has_more = index + 1 < tasks.len();
        let overflow_reserve = if has_more { small_size * 1.45 } else { 0.0 };
        if rows_height + row_height + overflow_reserve > rows_capacity { break; }
        rows.push((*task, title_lines, row_height));
        rows_height += row_height;
    }
    let displayed_tasks = rows.len();
    let empty_height = if tasks.is_empty() { minimum_row_height } else { 0.0 };
    let overflow_height = if displayed_tasks < tasks.len() { small_size * 1.45 } else { 0.0 };
    let todo_height = ((rows_top - todo_top) + rows_height + empty_height + overflow_height + todo_padding)
        .min(available_height);
    output.push_str(&format!(r##"
      <rect x="{content_x}" y="{todo_top}" width="{content_width}" height="{todo_height}" rx="{card_radius}" fill="{}" fill-opacity="{}" stroke="{}" stroke-width="1"/>
      <rect x="{todo_text_x}" y="{}" width="{}" height="{}" rx="{}" fill="#e5eee9"/>
      <path d="M {} {}h {} M {} {}h {} M {} {}h {}" stroke="#71887d" stroke-width="{}" stroke-linecap="round"/>
      <text x="{}" y="{todo_heading_y}" font-size="{}" font-weight="700" fill="{}">To-Do List</text>
      <text x="{}" y="{todo_subtitle_y}" font-size="{}" fill="{}">按添加顺序排列</text>
    "##,
      palette.surface, palette.surface_opacity, palette.surface_stroke,
      todo_top + todo_padding * 0.72, body_size * 1.72, body_size * 1.72, body_size * 0.48,
      todo_text_x + body_size * 0.45, todo_top + todo_padding * 0.96, body_size * 0.82,
      todo_text_x + body_size * 0.45, todo_top + todo_padding * 1.18, body_size * 0.82,
      todo_text_x + body_size * 0.45, todo_top + todo_padding * 1.40, body_size * 0.82, body_size * 0.09,
      todo_text_x + body_size * 2.35, body_size * 1.16, palette.title,
      todo_text_x + body_size * 2.35, small_size * 0.78, palette.muted,
    ));

    if tasks.is_empty() {
        output.push_str(&format!(r##"<text x="{}" y="{}" text-anchor="middle" font-size="{}" fill="{}">现在没有待办事项</text>"##,
          content_x + content_width * 0.5, rows_top + minimum_row_height * 0.62, body_size, palette.muted));
    }
    let mut row_top = rows_top;
    for (index, (task, title_lines, row_height)) in rows.iter().enumerate() {
        let first_title_y = row_top + body_size * 1.08;
        let completed = is_completed(task, &snapshot.date);
        let opacity = if completed { 0.55 } else { 1.0 };
        output.push_str(&format!(r##"<g opacity="{opacity}">"##));
        for (line_index, line) in title_lines.iter().enumerate() {
            output.push_str(&format!(r##"<text x="{todo_text_x}" y="{}" font-size="{body_size}" font-weight="600" fill="{}"{}>{}</text>"##,
              first_title_y + line_index as f64 * title_line_height, palette.text,
              if completed { " text-decoration=\"line-through\"" } else { "" }, xml(line)));
        }
        if task.start_time.is_some() || task.end_time.is_some() {
            let time = format!("{}{}", task.start_time.as_deref().unwrap_or("--:--"), task.end_time.as_ref().map(|value| format!(" — {value}")).unwrap_or_default());
            output.push_str(&format!(r##"<text x="{todo_text_x}" y="{}" font-size="{}" fill="{}">{}</text>"##,
              first_title_y + title_lines.len() as f64 * title_line_height + small_size * 0.15,
              small_size * 0.78, palette.muted, xml(&time)));
        }
        output.push_str("</g>");
        if index + 1 < displayed_tasks {
            output.push_str(&format!(r##"<line x1="{todo_text_x}" y1="{}" x2="{}" y2="{}" stroke="{}" stroke-width="1"/>"##,
              row_top + row_height, content_x + content_width - todo_padding, row_top + row_height, palette.divider));
        }
        row_top += row_height;
    }
    if displayed_tasks < tasks.len() {
        output.push_str(&format!(r##"<text x="{}" y="{}" text-anchor="end" font-size="{}" fill="{}">还有 {} 项</text>"##,
          content_x + content_width - todo_padding, todo_top + todo_height - todo_padding * 0.55,
          small_size * 0.72, palette.muted, tasks.len() - displayed_tasks));
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
    let principle_palette = principle_palette(&snapshot.settings.principle_theme);
    let font_family = font_family(&snapshot.settings.font_family);
    let content = plan_content(snapshot, x, y, width, height);
    let svg = format!(r##"<svg xmlns="http://www.w3.org/2000/svg" width="{screen_width}" height="{screen_height}" viewBox="0 0 {screen_width} {screen_height}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#879c95"/><stop offset="0.5" stop-color="#d7cabe"/><stop offset="1" stop-color="#738b81"/></linearGradient>
        <linearGradient id="principle-background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{}"/><stop offset="1" stop-color="{}"/></linearGradient>
        <clipPath id="plan-card"><rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}"/></clipPath>
        <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#25332d" flood-opacity="0.24"/></filter>
      </defs>
      {background_svg}
      <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{}" fill-opacity="{opacity}" filter="url(#shadow)"/>
      <g clip-path="url(#plan-card)">
        <circle cx="{}" cy="{}" r="{}" fill="{}" fill-opacity="0.42"/>
        <circle cx="{}" cy="{}" r="{}" fill="{}" fill-opacity="0.34"/>
        <g font-family="{font_family}">{content}</g>
      </g>
    </svg>"##,
      principle_palette.start, principle_palette.end, palette.page,
      x + width * 0.08, y + height * 0.03, width * 0.42, palette.glow_primary,
      x + width * 0.94, y + height * 0.44, width * 0.36, palette.glow_secondary,
    );

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

    fn task(id: &str, title: &str, start_time: Option<&str>, completed: bool) -> PlanItem {
        PlanItem {
            id: id.into(), kind: "task".into(), title: title.into(), scheduled_date: "2026-09-14".into(),
            start_time: start_time.map(str::to_string), end_time: None, priority: 0, sort_order: id.parse().unwrap_or(0),
            recurring_daily: false, completed, completed_date: completed.then(|| "2026-09-14".into()),
            completed_at: None, archived_at: None,
        }
    }

    fn test_snapshot() -> DesktopSnapshot {
        DesktopSnapshot {
            protocol_version: 1, date: "2026-09-14".into(), generated_at: "now".into(),
            items: vec![
                task("1", "完成项目计划评审", Some("09:00"), true),
                task("2", "整理今天最重要的工作", Some("10:30"), false),
                task("3", "预留专注时间处理核心任务", None, false),
            ],
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
    fn wraps_chinese_without_losing_or_truncating_text() {
        let source = "完成简历同时整理项目回顾项目细节";
        let lines = wrap_text(source, 8.0);

        assert!(lines.len() > 1);
        assert_eq!(lines.concat(), source);
        assert!(lines.iter().all(|line| line.chars().count() <= 8));
    }

    #[test]
    fn desktop_font_scale_preserves_intent_without_copying_web_pixels() {
        assert_eq!(desktop_font_scale(1.0), 1.0);
        assert!(desktop_font_scale(1.6) > 1.0);
        assert!(desktop_font_scale(1.6) < 1.6);
        assert!(desktop_font_scale(0.75) < 1.0);
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
