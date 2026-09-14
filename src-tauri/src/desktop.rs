use serde::{Deserialize, Serialize};
use tauri::{Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

pub const MIN_WIDTH: u32 = 360;
pub const MIN_HEIGHT: u32 = 420;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowLayout {
    pub monitor_index: usize,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn default_layout(monitor: &Monitor, monitor_index: usize) -> WindowLayout {
    let width = monitor.size().width.saturating_sub(48).min(520).max(MIN_WIDTH);
    let height = monitor.size().height.saturating_sub(48).min(800).max(MIN_HEIGHT);
    WindowLayout {
        monitor_index,
        x: monitor.position().x + monitor.size().width as i32 - width as i32 - 24,
        y: monitor.position().y + 24,
        width,
        height,
    }
}

pub fn clamp_layout(layout: WindowLayout, monitor: &Monitor) -> WindowLayout {
    let width = layout
        .width
        .max(MIN_WIDTH)
        .min(monitor.size().width.max(MIN_WIDTH));
    let height = layout
        .height
        .max(MIN_HEIGHT)
        .min(monitor.size().height.max(MIN_HEIGHT));
    let min_x = monitor.position().x;
    let min_y = monitor.position().y;
    let max_x = min_x + monitor.size().width as i32 - width as i32;
    let max_y = min_y + monitor.size().height as i32 - height as i32;

    WindowLayout {
        monitor_index: layout.monitor_index,
        x: layout.x.clamp(min_x, max_x.max(min_x)),
        y: layout.y.clamp(min_y, max_y.max(min_y)),
        width,
        height,
    }
}

pub fn show_as_desktop_widget(
    window: &WebviewWindow,
    layout: &WindowLayout,
) -> Result<(), String> {
    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_bottom(true)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())?;
    window
        .set_resizable(false)
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(layout.x, layout.y))
        .map_err(|error| error.to_string())?;
    window
        .set_size(PhysicalSize::new(layout.width, layout.height))
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn show_for_layout_edit(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_bottom(false)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())?;
    window
        .set_resizable(true)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn capture_layout(
    window: &WebviewWindow,
    monitor_index: usize,
) -> Result<WindowLayout, String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    Ok(WindowLayout {
        monitor_index,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}
