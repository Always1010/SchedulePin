pub mod model;
mod native_messaging;
mod renderer;
mod storage;
mod wallpaper;

use chrono::Local;
use model::{DesktopLayout, DesktopSnapshot, HelperResponse, HelperState, NativeRequest};
use std::{path::Path, thread, time::Duration};

fn monitor_signature(monitors: &[model::MonitorInfo]) -> String {
    monitors.iter().map(|monitor| format!("{}:{}x{}@{},{}", monitor.id, monitor.width, monitor.height, monitor.x, monitor.y)).collect::<Vec<_>>().join("|")
}

fn response(state: &HelperState) -> HelperResponse {
    match wallpaper::monitors() {
        Ok(monitors) => HelperResponse {
            version: env!("CARGO_PKG_VERSION"),
            desktop_enabled: state.desktop_enabled,
            last_sync: state.last_sync.clone(),
            monitors,
            error: None,
        },
        Err(error) => HelperResponse::failure(error),
    }
}

fn original_path<'a>(state: &'a HelperState, monitor_id: &str) -> Option<&'a Path> {
    let backup = state.original.as_ref()?.monitors.iter().find(|item| item.id == monitor_id)?;
    backup.backup_path.as_deref().or(Some(backup.original_path.as_str())).map(Path::new)
}

fn restore_state(state: &mut HelperState) -> Result<(), String> {
    if let Some(original) = &state.original {
        wallpaper::restore_all(original)?;
    }
    state.desktop_enabled = false;
    storage::save_state(state)
}

pub fn apply_snapshot(snapshot: DesktopSnapshot) -> Result<HelperResponse, String> {
    if snapshot.protocol_version != 1 {
        return Err(format!("不支持的协议版本：{}", snapshot.protocol_version));
    }
    let mut state = storage::load_state()?;
    state.snapshot = Some(snapshot.clone());
    state.last_sync = Some(snapshot.generated_at.clone());

    if !snapshot.settings.desktop_enabled {
        restore_state(&mut state)?;
        return Ok(response(&state));
    }

    if state.original.is_none() {
        state.original = Some(wallpaper::capture_backup()?);
        storage::save_state(&state)?;
    }

    let monitors = wallpaper::monitors()?;
    let selected = snapshot.settings.selected_monitor_id.clone().or_else(|| monitors.iter().find(|monitor| monitor.primary).map(|monitor| monitor.id.clone())).or_else(|| monitors.first().map(|monitor| monitor.id.clone()));
    let generated = storage::generated_dir()?;

    for monitor in &monitors {
        let should_render = snapshot.settings.display_mode == "all" || selected.as_deref() == Some(monitor.id.as_str());
        if should_render {
            let layout = snapshot.settings.layouts.get(&monitor.id).cloned().unwrap_or_else(DesktopLayout::default);
            let target = generated.join(format!("monitor-{}-{}.png", monitor.index, Local::now().timestamp_millis()));
            renderer::render_wallpaper(monitor, original_path(&state, &monitor.id), &snapshot, &layout, &target)?;
            wallpaper::set_wallpaper(&monitor.id, &target)?;
        } else if let Some(original) = state.original.as_ref().and_then(|backup| backup.monitors.iter().find(|item| item.id == monitor.id)) {
            wallpaper::restore_monitor(original)?;
        }
    }

    state.desktop_enabled = true;
    state.last_rendered_date = Some(snapshot.date.clone());
    state.last_monitor_signature = Some(monitor_signature(&monitors));
    storage::save_state(&state)?;
    Ok(response(&state))
}

pub fn restore() -> Result<HelperResponse, String> {
    let mut state = storage::load_state()?;
    restore_state(&mut state)?;
    Ok(response(&state))
}

pub fn status() -> HelperResponse {
    match storage::load_state() {
        Ok(state) => response(&state),
        Err(error) => HelperResponse::failure(error),
    }
}

pub fn refresh_cached() -> Result<HelperResponse, String> {
    let state = storage::load_state()?;
    let mut snapshot = state.snapshot.ok_or_else(|| "还没有可刷新的计划快照".to_string())?;
    snapshot.date = Local::now().format("%Y-%m-%d").to_string();
    snapshot.generated_at = Local::now().to_rfc3339();
    apply_snapshot(snapshot)
}

pub fn handle_request(request: NativeRequest) -> HelperResponse {
    let result = match request {
        NativeRequest::Status { protocol_version } | NativeRequest::Restore { protocol_version } if protocol_version != 1 => Err(format!("不支持的协议版本：{protocol_version}")),
        NativeRequest::Status { .. } => return status(),
        NativeRequest::Sync { snapshot } => apply_snapshot(snapshot),
        NativeRequest::Restore { .. } => restore(),
    };
    result.unwrap_or_else(HelperResponse::failure)
}

pub fn run_native_host() -> Result<(), String> {
    native_messaging::run()
}

pub fn run_daemon() -> Result<(), String> {
    loop {
        if let Ok(state) = storage::load_state() {
            if state.desktop_enabled {
                if let (Some(mut snapshot), Ok(monitors)) = (state.snapshot, wallpaper::monitors()) {
                    let today = Local::now().format("%Y-%m-%d").to_string();
                    let signature = monitor_signature(&monitors);
                    if state.last_rendered_date.as_deref() != Some(&today) || state.last_monitor_signature.as_deref() != Some(&signature) {
                        snapshot.date = today;
                        snapshot.generated_at = Local::now().to_rfc3339();
                        let _ = apply_snapshot(snapshot);
                    }
                }
            }
        }
        thread::sleep(Duration::from_secs(60));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_protocol_versions() {
        let response = handle_request(NativeRequest::Status { protocol_version: 99 });
        assert!(response.error.as_deref().is_some_and(|error| error.contains("协议版本")));
    }
}
