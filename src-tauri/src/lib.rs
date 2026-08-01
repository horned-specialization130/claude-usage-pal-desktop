mod admin_api;
mod credentials;
mod local_sessions;
mod settings;
mod usage_api;

use settings::Settings;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

async fn fetch_usage_with_retry() -> Result<usage_api::UsageReport, String> {
    let cred = credentials::read_access_token()?;
    match usage_api::fetch_usage(&cred.access_token).await {
        Ok(usage) => Ok(usage),
        Err(first_err) => {
            // Claude Code refreshes this token in the background during normal use,
            // so a stale token often just needs a re-read + one retry.
            let cred_retry = credentials::read_access_token()?;
            usage_api::fetch_usage(&cred_retry.access_token)
                .await
                .map_err(|_| first_err)
        }
    }
}

#[tauri::command]
async fn get_usage() -> Result<usage_api::UsageReport, String> {
    fetch_usage_with_retry().await
}

#[tauri::command]
fn get_local_usage() -> local_sessions::TodayLocalUsage {
    local_sessions::today_local_usage()
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Settings {
    settings::load_settings(&app)
}

#[tauri::command]
fn save_settings_cmd(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    settings::save_settings(&app, &settings)
}

#[tauri::command]
fn save_window_position(app: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    let mut settings = settings::load_settings(&app);
    settings.window_x = Some(x);
    settings.window_y = Some(y);
    settings::save_settings(&app, &settings)
}

#[tauri::command]
async fn get_admin_usage(app: tauri::AppHandle) -> Result<admin_api::AdminUsageSummary, String> {
    let settings = settings::load_settings(&app);
    let key = settings
        .admin_api_key
        .filter(|k| !k.is_empty())
        .ok_or("no admin API key configured")?;
    admin_api::fetch_cost_report(&key).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_usage,
            get_local_usage,
            get_settings,
            save_settings_cmd,
            save_window_position,
            get_admin_usage
        ])
        .setup(|app| {
            let saved = settings::load_settings(&app.handle());
            if let (Some(x), Some(y)) = (saved.window_x, saved.window_y) {
                if let Some(window) = app.get_webview_window("pet") {
                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x,
                        y,
                    }));
                }
            }

            let toggle = MenuItem::with_id(app, "toggle", "Show/Hide Pet", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &quit])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("pet") {
                            let visible = window.is_visible().unwrap_or(true);
                            let _ = if visible { window.hide() } else { window.show() };
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let poll_settings = settings::load_settings(&app_handle);

                    let (usage, usage_error) = match fetch_usage_with_retry().await {
                        Ok(u) => (Some(u), None),
                        Err(e) => (None, Some(e)),
                    };
                    let local = local_sessions::today_local_usage();

                    let _ = app_handle.emit(
                        "usage-updated",
                        serde_json::json!({
                            "usage": usage,
                            "usageError": usage_error,
                            "local": local,
                        }),
                    );

                    tokio::time::sleep(Duration::from_secs(poll_settings.poll_interval_secs.max(15)))
                        .await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
