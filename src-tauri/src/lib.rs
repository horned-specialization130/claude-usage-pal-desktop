mod admin_api;
mod credentials;
mod dodge;
mod local_sessions;
mod settings;
mod state;
mod usage_api;

use settings::Settings;
use state::AppState;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State,
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
fn get_settings(state: State<AppState>) -> Settings {
    state.get_settings()
}

#[tauri::command]
fn save_settings_cmd(app: tauri::AppHandle, state: State<AppState>, settings: Settings) -> Result<(), String> {
    state.set_settings(&app, settings)
}

#[tauri::command]
fn save_window_position(app: tauri::AppHandle, state: State<AppState>, x: i32, y: i32) -> Result<(), String> {
    let mut settings = state.get_settings();
    settings.window_x = Some(x);
    settings.window_y = Some(y);
    state.set_settings(&app, settings)
}

#[tauri::command]
fn set_panel_open(state: State<AppState>, open: bool) {
    state.set_panel_open(open);
}

/// Resizes the pet window to match only the currently visible content
/// (small when idle, bigger while the stats/settings panel is open),
/// keeping the window's bottom-center point fixed so the pet doesn't
/// visually jump. This matters because a transparent window still
/// intercepts clicks over its whole rectangle even where nothing is
/// drawn, so an oversized window blocks whatever is behind it.
///
/// `width`/`height` are logical (CSS) pixels, matching how the frontend and
/// `tauri.conf.json` express sizes — all geometry here is done in logical
/// pixels (converting the physical reads via the scale factor) so the actual
/// window always matches what the CSS expects, regardless of display scaling.
#[tauri::command]
fn resize_pet_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app.get_webview_window("pet").ok_or("pet window not found")?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;

    let current_pos = window
        .outer_position()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    let current_size = window
        .outer_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);

    let center_x = current_pos.x + current_size.width / 2.0;
    let bottom_y = current_pos.y + current_size.height;
    let mut new_x = center_x - width / 2.0;
    let mut new_y = bottom_y - height;

    // Clamp to the monitor's work area so growing the window (e.g. opening the
    // stats panel while the pet has fled near a screen edge) can't push it
    // partly off-screen, which would clip the panel.
    if let Ok(Some(monitor)) = window.current_monitor() {
        let mscale = monitor.scale_factor();
        let mpos = monitor.position().to_logical::<f64>(mscale);
        let msize = monitor.size().to_logical::<f64>(mscale);
        let max_x = mpos.x + msize.width - width;
        let max_y = mpos.y + msize.height - height;
        if mpos.x <= max_x {
            new_x = new_x.clamp(mpos.x, max_x);
        }
        if mpos.y <= max_y {
            new_y = new_y.clamp(mpos.y, max_y);
        }
    }

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition { x: new_x, y: new_y }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_admin_usage(app: tauri::AppHandle) -> Result<admin_api::AdminUsageSummary, String> {
    let settings = app.state::<AppState>().get_settings();
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
            set_panel_open,
            resize_pet_window,
            get_admin_usage
        ])
        .setup(|app| {
            app.manage(AppState::load(&app.handle()));
            let app_state = app.state::<AppState>();
            let saved = app_state.get_settings();
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

            let usage_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let poll_settings = usage_app_handle.state::<AppState>().get_settings();

                    let (usage, usage_error) = match fetch_usage_with_retry().await {
                        Ok(u) => (Some(u), None),
                        Err(e) => (None, Some(e)),
                    };
                    let local = local_sessions::today_local_usage();

                    let _ = usage_app_handle.emit(
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

            let dodge_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(dodge::run(dodge_app_handle));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
