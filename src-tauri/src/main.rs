#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            // The settings window stays alive (hidden) in the background, so a normal
            // "last window closed" exit never fires. Closing the main window must
            // always terminate the app regardless of what other windows are open.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { .. } = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
