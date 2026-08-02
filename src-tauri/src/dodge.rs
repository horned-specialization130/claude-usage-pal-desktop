use crate::state::AppState;
use device_query::{DeviceQuery, DeviceState, Keycode};
use std::time::{Duration, Instant};
use tauri::{Manager, PhysicalPosition, Position};

const TICK_MS: u64 = 40;
const COOLDOWN_MS: u64 = 350;
const FLEE_DISTANCE: f64 = 150.0;
// How much past the sprite's edge counts as "close range" before it flees.
const EXTRA_BUFFER: f64 = 20.0;
// Glide the flee motion instead of teleporting instantly.
const GLIDE_STEPS: u32 = 24;
const GLIDE_STEP_MS: u64 = 14;

/// Background loop: while shy mode is on, no panel is open, and Shift isn't
/// held, hops the pet window away whenever the global cursor gets close.
/// Needs OS-level global mouse/keyboard polling (via `device_query`) since a
/// webview can't observe the cursor once it's outside the window's bounds.
pub async fn run(app_handle: tauri::AppHandle) {
    let device_state = DeviceState::new();
    let mut last_dodge = Instant::now() - Duration::from_millis(COOLDOWN_MS);

    loop {
        tokio::time::sleep(Duration::from_millis(TICK_MS)).await;

        let state = app_handle.state::<AppState>();
        if state.is_panel_open() {
            continue;
        }
        let settings = state.get_settings();
        if !settings.shy_mode_enabled {
            continue;
        }
        if last_dodge.elapsed() < Duration::from_millis(COOLDOWN_MS) {
            continue;
        }

        let keys = device_state.get_keys();
        if keys.contains(&Keycode::LShift) || keys.contains(&Keycode::RShift) {
            continue;
        }

        let Some(window) = app_handle.get_webview_window("pet") else {
            continue;
        };
        let Ok(pos) = window.outer_position() else {
            continue;
        };
        let Ok(size) = window.outer_size() else {
            continue;
        };

        let mouse = device_state.get_mouse();
        let (mx, my) = (mouse.coords.0 as f64, mouse.coords.1 as f64);

        let cx = pos.x as f64 + size.width as f64 / 2.0;
        let cy = pos.y as f64 + size.height as f64 / 2.0;

        let dx = mx - cx;
        let dy = my - cy;
        let distance = (dx * dx + dy * dy).sqrt();

        let threshold = (size.width.max(size.height) as f64 / 2.0) + EXTRA_BUFFER;
        if distance >= threshold {
            continue;
        }

        // Flee away from the cursor; pick an arbitrary direction if it's dead-center.
        let (flee_dx, flee_dy) = if distance > 1.0 {
            (-dx / distance, -dy / distance)
        } else {
            (0.0, -1.0)
        };

        let mut new_cx = cx + flee_dx * FLEE_DISTANCE;
        let mut new_cy = cy + flee_dy * FLEE_DISTANCE;

        if let Ok(Some(monitor)) = window.current_monitor() {
            let mpos = monitor.position();
            let msize = monitor.size();
            let half_w = size.width as f64 / 2.0;
            let half_h = size.height as f64 / 2.0;
            let min_x = mpos.x as f64 + half_w;
            let max_x = mpos.x as f64 + msize.width as f64 - half_w;
            let min_y = mpos.y as f64 + half_h;
            let max_y = mpos.y as f64 + msize.height as f64 - half_h;
            if min_x <= max_x {
                new_cx = new_cx.clamp(min_x, max_x);
            }
            if min_y <= max_y {
                new_cy = new_cy.clamp(min_y, max_y);
            }
        }

        let start_x = pos.x as f64;
        let start_y = pos.y as f64;
        let target_x = new_cx - size.width as f64 / 2.0;
        let target_y = new_cy - size.height as f64 / 2.0;

        glide_to(&window, start_x, start_y, target_x, target_y).await;
        last_dodge = Instant::now();
    }
}

/// Eases the window from (start_x, start_y) to (target_x, target_y) over
/// several steps instead of teleporting instantly to the flee point.
async fn glide_to(window: &tauri::WebviewWindow, start_x: f64, start_y: f64, target_x: f64, target_y: f64) {
    for step in 1..=GLIDE_STEPS {
        let t = step as f64 / GLIDE_STEPS as f64;
        // Ease-in-out cubic: gentle start, brisk middle, gentle settle.
        let eased = if t < 0.5 {
            4.0 * t * t * t
        } else {
            1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
        };
        let x = (start_x + (target_x - start_x) * eased).round() as i32;
        let y = (start_y + (target_y - start_y) * eased).round() as i32;
        if window
            .set_position(Position::Physical(PhysicalPosition { x, y }))
            .is_err()
        {
            return;
        }
        tokio::time::sleep(Duration::from_millis(GLIDE_STEP_MS)).await;
    }
}
