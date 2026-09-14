use crate::{
    model::{MonitorInfo, MonitorWallpaperBackup, WallpaperBackup},
    storage,
};
use std::{fs, path::Path};
use windows::{
    core::{HSTRING, PWSTR},
    Win32::{
        Foundation::COLORREF,
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
            COINIT_APARTMENTTHREADED,
        },
        UI::Shell::{DesktopWallpaper, IDesktopWallpaper, DESKTOP_WALLPAPER_POSITION},
    },
};

struct ComApartment;

impl ComApartment {
    fn initialize() -> Result<Self, String> {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }
            .ok()
            .map_err(|error| format!("无法初始化 Windows COM：{error}"))?;
        Ok(Self)
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

fn api() -> Result<(ComApartment, IDesktopWallpaper), String> {
    let apartment = ComApartment::initialize()?;
    let desktop = unsafe { CoCreateInstance(&DesktopWallpaper, None, CLSCTX_ALL) }
        .map_err(|error| format!("无法打开 Windows 壁纸接口：{error}"))?;
    Ok((apartment, desktop))
}

unsafe fn take_string(value: PWSTR) -> Result<String, String> {
    let result = unsafe { value.to_string() }.map_err(|error| error.to_string());
    unsafe { CoTaskMemFree(Some(value.0.cast())) };
    result
}

fn monitor_ids(desktop: &IDesktopWallpaper) -> Result<Vec<String>, String> {
    let count = unsafe { desktop.GetMonitorDevicePathCount() }.map_err(|error| error.to_string())?;
    (0..count)
        .map(|index| {
            let value = unsafe { desktop.GetMonitorDevicePathAt(index) }.map_err(|error| error.to_string())?;
            unsafe { take_string(value) }
        })
        .collect()
}

pub fn monitors() -> Result<Vec<MonitorInfo>, String> {
    let (_apartment, desktop) = api()?;
    monitor_ids(&desktop)?
        .into_iter()
        .enumerate()
        .map(|(index, id)| {
            let rect = unsafe { desktop.GetMonitorRECT(&HSTRING::from(&id)) }
                .map_err(|error| format!("无法读取显示器 {index}：{error}"))?;
            Ok(MonitorInfo {
                id,
                index,
                name: format!("显示器 {}", index + 1),
                x: rect.left,
                y: rect.top,
                width: (rect.right - rect.left).max(0) as u32,
                height: (rect.bottom - rect.top).max(0) as u32,
                primary: rect.left == 0 && rect.top == 0,
            })
        })
        .collect()
}

pub fn capture_backup() -> Result<WallpaperBackup, String> {
    let (_apartment, desktop) = api()?;
    let position = unsafe { desktop.GetPosition() }.map_err(|error| error.to_string())?.0;
    let background_color = unsafe { desktop.GetBackgroundColor() }.map_err(|error| error.to_string())?.0;
    let backup_root = storage::backup_dir()?;
    let mut backups = Vec::new();

    for (index, id) in monitor_ids(&desktop)?.into_iter().enumerate() {
        let value = unsafe { desktop.GetWallpaper(&HSTRING::from(&id)) }.map_err(|error| error.to_string())?;
        let original_path = unsafe { take_string(value) }?;
        let source = Path::new(&original_path);
        let backup_path = if source.is_file() {
            let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("img");
            let destination = backup_root.join(format!("monitor-{index}.{extension}"));
            fs::copy(source, &destination).map_err(|error| format!("无法备份原壁纸：{error}"))?;
            Some(destination.to_string_lossy().into_owned())
        } else {
            None
        };
        backups.push(MonitorWallpaperBackup { id, original_path, backup_path });
    }

    Ok(WallpaperBackup { position, background_color, monitors: backups })
}

pub fn set_wallpaper(monitor_id: &str, path: &Path) -> Result<(), String> {
    let (_apartment, desktop) = api()?;
    unsafe {
        desktop.SetWallpaper(
            &HSTRING::from(monitor_id),
            &HSTRING::from(path.to_string_lossy().as_ref()),
        )
    }
    .map_err(|error| format!("无法应用计划壁纸：{error}"))
}

pub fn restore_monitor(backup: &MonitorWallpaperBackup) -> Result<(), String> {
    let path = if Path::new(&backup.original_path).is_file() {
        &backup.original_path
    } else {
        backup.backup_path.as_deref().unwrap_or("")
    };
    if path.is_empty() {
        return Ok(());
    }
    let (_apartment, desktop) = api()?;
    unsafe { desktop.SetWallpaper(&HSTRING::from(&backup.id), &HSTRING::from(path)) }
        .map_err(|error| format!("无法恢复原壁纸：{error}"))
}

pub fn restore_all(backup: &WallpaperBackup) -> Result<(), String> {
    for monitor in &backup.monitors {
        restore_monitor(monitor)?;
    }
    let (_apartment, desktop) = api()?;
    unsafe {
        desktop.SetPosition(DESKTOP_WALLPAPER_POSITION(backup.position)).map_err(|error| error.to_string())?;
        desktop.SetBackgroundColor(COLORREF(backup.background_color)).map_err(|error| error.to_string())?;
    }
    Ok(())
}
