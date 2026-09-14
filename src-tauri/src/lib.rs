use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

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
    always_on_top: bool,
    display_mode: String,
    monitor_index: usize,
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
fn configure_windows(app: tauri::AppHandle, settings: WindowSettings) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    if monitors.is_empty() {
        return Ok(());
    }

    for (label, window) in app.webview_windows() {
        if label.starts_with("panel-") {
            window.close().map_err(|error| error.to_string())?;
        }
    }

    let selected_index = settings.monitor_index.min(monitors.len() - 1);
    let selected = &monitors[selected_index];
    if let Some(main) = app.get_webview_window("main") {
        main.set_position(PhysicalPosition::new(selected.position().x + 28, selected.position().y + 28))
            .map_err(|error| error.to_string())?;
        main.set_always_on_top(settings.always_on_top).map_err(|error| error.to_string())?;
    }

    if settings.display_mode == "all" {
        for (index, monitor) in monitors.iter().enumerate() {
            if index == selected_index { continue; }
            let label = format!("panel-{index}");
            let max_height = monitor.size().height.saturating_sub(56).min(760);
            let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html?panel=1".into()))
                .title("SchedulePin")
                .decorations(false)
                .transparent(true)
                .always_on_top(settings.always_on_top)
                .inner_size(440.0, max_height as f64 / monitor.scale_factor())
                .position(
                    (monitor.position().x + 28) as f64 / monitor.scale_factor(),
                    (monitor.position().y + 28) as f64 / monitor.scale_factor(),
                )
                .build()
                .map_err(|error| error.to_string())?;
            window.set_size(PhysicalSize::new(440, max_height)).map_err(|error| error.to_string())?;
        }
    }

    app.emit("schedulepin://data-changed", ()).map_err(|error| error.to_string())?;
    Ok(())
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
        .run(tauri::generate_context!())
        .expect("error while running SchedulePin");
}
