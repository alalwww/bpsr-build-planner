#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, WindowEvent};

/// About ウィンドウをモーダル表示する。開いている間は main を無効化して
/// 操作できなくする。再有効化は About の CloseRequested ハンドラで行う。
#[tauri::command]
fn show_about_window(app: AppHandle) {
    let (Some(main), Some(about)) = (
        app.get_webview_window("main"),
        app.get_webview_window("about"),
    ) else {
        return;
    };
    let _ = main.set_enabled(false);
    let _ = about.show();
    let _ = about.set_focus();
}

/// タイトルバーのアイコンを非表示にする(Windows 標準のモーダルダイアログと同じ見た目)。
#[cfg(windows)]
fn remove_titlebar_icon(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        GWL_EXSTYLE, GetWindowLongPtrW, ICON_BIG, ICON_SMALL, SWP_FRAMECHANGED, SWP_NOMOVE,
        SWP_NOSIZE, SWP_NOZORDER, SendMessageW, SetWindowLongPtrW, SetWindowPos, WM_SETICON,
        WS_EX_DLGMODALFRAME,
    };
    let Ok(hwnd) = window.hwnd() else { return };
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_DLGMODALFRAME.0 as isize);
        SendMessageW(
            hwnd,
            WM_SETICON,
            Some(WPARAM(ICON_SMALL as usize)),
            Some(LPARAM(0)),
        );
        SendMessageW(
            hwnd,
            WM_SETICON,
            Some(WPARAM(ICON_BIG as usize)),
            Some(LPARAM(0)),
        );
        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
        );
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![show_about_window])
        .setup(|app| {
            #[cfg(windows)]
            if let Some(about) = app.get_webview_window("about") {
                remove_titlebar_icon(&about);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    // The settings window stays alive (hidden) in the background, so a
                    // normal "last window closed" exit never fires. Closing the main
                    // window must always terminate the app regardless of what other
                    // windows are open.
                    "main" => window.app_handle().exit(0),
                    // The settings window is resident (hide/show); letting the titlebar
                    // close destroy it would make it impossible to reopen.
                    "settings" => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    // The about window is a resident modal: hide it and give control
                    // back to the main window disabled by show_about_window.
                    "about" => {
                        api.prevent_close();
                        let _ = window.hide();
                        if let Some(main) = window.app_handle().get_webview_window("main") {
                            let _ = main.set_enabled(true);
                            let _ = main.set_focus();
                        }
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
