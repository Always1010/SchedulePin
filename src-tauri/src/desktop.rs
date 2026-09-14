use tauri::WebviewWindow;
use windows::{
    core::{w, BOOL, PCWSTR},
    Win32::{
        Foundation::{HWND, LPARAM, RECT},
        UI::WindowsAndMessaging::{
            EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetParent, GetWindowLongPtrW,
            GetWindowRect, SetParent, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
            HWND_TOP, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_SHOWWINDOW, WS_CHILD, WS_EX_APPWINDOW,
            WS_EX_TOOLWINDOW, WS_POPUP,
        },
    },
};

pub struct DesktopAttachment {
    pub host_class: String,
}

unsafe extern "system" fn find_icon_host(window: HWND, parameter: LPARAM) -> BOOL {
    if unsafe {
        FindWindowExW(
            Some(window),
            None,
            w!("SHELLDLL_DefView"),
            PCWSTR::null(),
        )
    }
    .is_ok()
    {
        let output = unsafe { &mut *(parameter.0 as *mut Option<HWND>) };
        *output = Some(window);
        return BOOL(0);
    }
    BOOL(1)
}

fn desktop_host() -> Result<HWND, String> {
    let mut icon_host = None;
    unsafe {
        let _ = EnumWindows(
            Some(find_icon_host),
            LPARAM((&mut icon_host as *mut Option<HWND>) as isize),
        );
    }

    if let Some(host) = icon_host {
        return Ok(host);
    }

    unsafe { FindWindowW(w!("Progman"), PCWSTR::null()) }
        .map_err(|error| format!("无法找到 Windows 桌面宿主：{error}"))
}

fn class_name(window: HWND) -> String {
    let mut buffer = [0_u16; 64];
    let length = unsafe { GetClassNameW(window, &mut buffer) }.max(0) as usize;
    String::from_utf16_lossy(&buffer[..length])
}

pub fn attach_to_desktop(
    window: &WebviewWindow,
    screen_x: i32,
    screen_y: i32,
    width: u32,
    height: u32,
) -> Result<DesktopAttachment, String> {
    let desktop = desktop_host()?;
    let handle = window.hwnd().map_err(|error| error.to_string())?;

    unsafe {
        let style = GetWindowLongPtrW(handle, GWL_STYLE) as u32;
        SetWindowLongPtrW(
            handle,
            GWL_STYLE,
            ((style & !WS_POPUP.0) | WS_CHILD.0) as isize,
        );

        let extended_style = GetWindowLongPtrW(handle, GWL_EXSTYLE) as u32;
        SetWindowLongPtrW(
            handle,
            GWL_EXSTYLE,
            ((extended_style & !WS_EX_APPWINDOW.0) | WS_EX_TOOLWINDOW.0) as isize,
        );

        // SetParent returns the previous parent, which is null for a top-level window even
        // when the operation succeeds. Verify the new relationship explicitly instead.
        let _ = SetParent(handle, Some(desktop));
        if GetParent(handle).ok() != Some(desktop) {
            return Err("无法把计划板连接到 Windows 桌面层".into());
        }

        let mut desktop_rect = RECT::default();
        GetWindowRect(desktop, &mut desktop_rect)
            .map_err(|error| format!("无法读取桌面区域：{error}"))?;
        SetWindowPos(
            handle,
            Some(HWND_TOP),
            screen_x - desktop_rect.left,
            screen_y - desktop_rect.top,
            width as i32,
            height as i32,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        .map_err(|error| format!("无法放置桌面组件：{error}"))?;
    }

    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())?;

    Ok(DesktopAttachment {
        host_class: class_name(desktop),
    })
}
