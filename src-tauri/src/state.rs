use crate::settings::{self, Settings};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

/// In-memory copy of settings (backed by the on-disk file) plus transient UI
/// state, shared across commands and the background dodge loop so the loop
/// doesn't have to re-read settings.json dozens of times a second.
pub struct AppState {
    settings: Mutex<Settings>,
    panel_open: AtomicBool,
}

impl AppState {
    pub fn load(app: &tauri::AppHandle) -> Self {
        Self {
            settings: Mutex::new(settings::load_settings(app)),
            panel_open: AtomicBool::new(false),
        }
    }

    pub fn get_settings(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    pub fn set_settings(&self, app: &tauri::AppHandle, new_settings: Settings) -> Result<(), String> {
        settings::save_settings(app, &new_settings)?;
        *self.settings.lock().unwrap() = new_settings;
        Ok(())
    }

    pub fn is_panel_open(&self) -> bool {
        self.panel_open.load(Ordering::Relaxed)
    }

    pub fn set_panel_open(&self, open: bool) {
        self.panel_open.store(open, Ordering::Relaxed);
    }
}
