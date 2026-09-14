use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

mod desktop;
use desktop::WindowLayout;

#[derive(Default)]
struct WindowMonitorMap(Mutex<HashMap<String, usize>>);

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
    layouts: HashMap<String, WindowLayout>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopConfiguration {
    attached_windows: usize,
    edit_mode: bool,
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

fn selected_layout(
    settings: &WindowSettings,
    monitor: &tauri::Monitor,
    monitor_index: usize,
) -> WindowLayout {
    settings
        .layouts
        .get(&monitor_index.to_string())
        .cloned()
        .map(|layout| desktop::clamp_layout(layout, monitor))
        .unwrap_or_else(|| desktop::default_layout(monitor, monitor_index))
}

#[tauri::command]
fn configure_windows(
    app: tauri::AppHandle,
    state: tauri::State<WindowMonitorMap>,
    settings: WindowSettings,
) -> Result<DesktopConfiguration, String> {
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
    let mut window_monitors = state.0.lock().map_err(|error| error.to_string())?;
    window_monitors.clear();
    if let Some(main) = app.get_webview_window("main") {
        let layout = selected_layout(&settings, selected, selected_index);
        desktop::show_as_desktop_widget(&main, &layout)?;
        window_monitors.insert("main".into(), selected_index);
        attached_windows += 1;
    }

    if settings.display_mode == "all" {
        for (index, monitor) in monitors.iter().enumerate() {
            if index == selected_index {
                continue;
            }
            let label = format!("panel-{index}");
            let layout = selected_layout(&settings, monitor, index);
            let url = format!("index.html?panel=1&monitor={index}");
            let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
                .title("SchedulePin")
                .decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false)
                .inner_size(
                    layout.width as f64 / monitor.scale_factor(),
                    layout.height as f64 / monitor.scale_factor(),
                )
                .build()
                .map_err(|error| error.to_string())?;
            desktop::show_as_desktop_widget(&window, &layout)?;
            window_monitors.insert(label, index);
            attached_windows += 1;
        }
    }
    drop(window_monitors);

    app.emit("schedulepin://data-changed", ()).map_err(|error| error.to_string())?;
    Ok(DesktopConfiguration { attached_windows, edit_mode: false })
}

fn set_layout_edit_impl(
    app: &tauri::AppHandle,
    state: &WindowMonitorMap,
    enabled: bool,
) -> Result<Vec<WindowLayout>, String> {
    let mapping = state.0.lock().map_err(|error| error.to_string())?.clone();
    let monitors = app.available_monitors().map_err(|error| error.to_string())?;
    let mut layouts = Vec::new();

    for (label, window) in app.webview_windows() {
        if enabled {
            desktop::show_for_layout_edit(&window)?;
        } else if let Some(index) = mapping.get(&label).copied() {
            if let Some(monitor) = monitors.get(index) {
                let captured = desktop::capture_layout(&window, index)?;
                let layout = desktop::clamp_layout(captured, monitor);
                desktop::show_as_desktop_widget(&window, &layout)?;
                layouts.push(layout);
            }
        }
    }

    if enabled {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.set_focus();
        }
    } else {
        app.emit("schedulepin://layout-saved", layouts.clone())
            .map_err(|error| error.to_string())?;
    }
    app.emit("schedulepin://edit-mode", enabled)
        .map_err(|error| error.to_string())?;
    Ok(layouts)
}

#[tauri::command]
fn set_layout_edit(
    app: tauri::AppHandle,
    state: tauri::State<WindowMonitorMap>,
    enabled: bool,
) -> Result<Vec<WindowLayout>, String> {
    set_layout_edit_impl(&app, &state, enabled)
}

fn hide_widgets_impl(app: &tauri::AppHandle) -> Result<(), String> {
    for window in app.webview_windows().into_values() {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_widgets(app: tauri::AppHandle) -> Result<(), String> {
    hide_widgets_impl(&app)
}

fn show_widgets_impl(app: &tauri::AppHandle) -> Result<(), String> {
    for window in app.webview_windows().into_values() {
        window.show().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_widgets(app: tauri::AppHandle) -> Result<(), String> {
    show_widgets_impl(&app)
}

fn create_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示桌面组件", true, None::<&str>)?;
    let edit = MenuItem::with_id(app, "edit", "调整位置和大小", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏桌面组件", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 SchedulePin", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &edit, &hide, &quit])?;
    let mut tray = TrayIconBuilder::with_id("schedulepin")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("SchedulePin · 今日计划")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_widgets_impl(app);
            }
            "edit" => {
                let state = app.state::<WindowMonitorMap>();
                let _ = set_layout_edit_impl(app, &state, true);
            }
            "hide" => {
                let _ = hide_widgets_impl(app);
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
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
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let _ = show_widgets_impl(app);
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:schedulepin.db", migrations).build())
        .invoke_handler(tauri::generate_handler![
            list_monitors,
            configure_windows,
            set_layout_edit,
            hide_widgets,
            show_widgets,
            quit_app
        ])
        .setup(|app| {
            app.manage(WindowMonitorMap::default());
            create_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SchedulePin");
}
