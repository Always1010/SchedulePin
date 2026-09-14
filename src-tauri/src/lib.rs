use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(target_os = "windows")]
mod desktop;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorInfo {
    index: usize,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowSettings {
    display_mode: String,
    monitor_index: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopConfiguration {
    attached_windows: usize,
    host_class: String,
}

#[tauri::command]
fn list_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| MonitorInfo {
            index,
            name: monitor.name().unwrap_or(&format!("显示器 {}", index + 1)).to_string(),
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
            scale_factor: monitor.scale_factor(),
        })
        .collect())
}

#[tauri::command]
fn configure_windows(app: tauri::AppHandle, settings: WindowSettings) -> Result<DesktopConfiguration, String> {
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    if monitors.is_empty() {
        return Err("没有检测到可用显示器".into());
    }

    for (label, window) in app.webview_windows() {
        if label.starts_with("panel-") {
            window.close().map_err(|error| error.to_string())?;
        }
    }

    let selected_index = settings.monitor_index.min(monitors.len() - 1);
    let selected = &monitors[selected_index];
    let mut attached_windows = 0;
    let mut host_class = String::new();
    if let Some(main) = app.get_webview_window("main") {
        let width = selected.size().width.saturating_sub(56).min(440);
        let height = selected.size().height.saturating_sub(56).min(760);
        let attachment = desktop::attach_to_desktop(
            &main,
            selected.position().x + selected.size().width as i32 - width as i32 - 28,
            selected.position().y + 28,
            width,
            height,
        )?;
        host_class = attachment.host_class;
        attached_windows += 1;
    }

    if settings.display_mode == "all" {
        for (index, monitor) in monitors.iter().enumerate() {
            if index == selected_index { continue; }
            let label = format!("panel-{index}");
            let width = monitor.size().width.saturating_sub(56).min(440);
            let height = monitor.size().height.saturating_sub(56).min(760);
            let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html?panel=1".into()))
                .title("SchedulePin")
                .decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false)
                .inner_size(width as f64 / monitor.scale_factor(), height as f64 / monitor.scale_factor())
                .build()
                .map_err(|error| error.to_string())?;
            let attachment = desktop::attach_to_desktop(
                &window,
                monitor.position().x + monitor.size().width as i32 - width as i32 - 28,
                monitor.position().y + 28,
                width,
                height,
            )?;
            host_class = attachment.host_class;
            attached_windows += 1;
        }
    }

    app.emit("schedulepin://data-changed", ()).map_err(|error| error.to_string())?;
    Ok(DesktopConfiguration { attached_windows, host_class })
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create schedulepin data tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS plan_items (
                    id TEXT PRIMARY KEY NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('task', 'discipline', 'note')),
                    title TEXT NOT NULL,
                    scheduled_date TEXT NOT NULL,
                    start_time TEXT,
                    end_time TEXT,
                    priority INTEGER NOT NULL DEFAULT 0,
                    recurring_daily INTEGER NOT NULL DEFAULT 0,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS item_completions (
                    item_id TEXT NOT NULL,
                    day TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (item_id, day),
                    FOREIGN KEY (item_id) REFERENCES plan_items(id) ON DELETE CASCADE
                );
            "#,
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:schedulepin.db", migrations).build())
        .invoke_handler(tauri::generate_handler![list_monitors, configure_windows, quit_app])
        .setup(|app| {
            let monitors = app.available_monitors()?;
            if let (Some(main), Some(monitor)) = (app.get_webview_window("main"), monitors.first()) {
                let width = monitor.size().width.saturating_sub(56).min(440);
                let height = monitor.size().height.saturating_sub(56).min(760);
                desktop::attach_to_desktop(
                    &main,
                    monitor.position().x + monitor.size().width as i32 - width as i32 - 28,
                    monitor.position().y + 28,
                    width,
                    height,
                )
                .map_err(std::io::Error::other)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SchedulePin");
}
