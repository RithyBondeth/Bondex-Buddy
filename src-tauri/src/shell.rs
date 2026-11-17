use std::{sync::Mutex, thread, time::Duration};

use tauri::{Manager, PhysicalPosition, WebviewWindow};

pub const MASK_WIDTH: usize = 110;
pub const MASK_HEIGHT: usize = 100;
const LOGICAL_WIDTH: f64 = 220.0;
const LOGICAL_HEIGHT: f64 = 200.0;

#[derive(Default)]
pub struct ShellState {
    mask: Mutex<Vec<u8>>,
}

/// Convert desktop physical coordinates into the fixed-resolution Canvas mask.
fn hits_mask(mask: &[u8], x: f64, y: f64, scale: f64) -> bool {
    if !scale.is_finite() || scale <= 0.0 || !x.is_finite() || !y.is_finite() {
        return false;
    }
    let x = x / scale;
    let y = y / scale;
    if !(0.0..LOGICAL_WIDTH).contains(&x) || !(0.0..LOGICAL_HEIGHT).contains(&y) {
        return false;
    }
    let column = (x * MASK_WIDTH as f64 / LOGICAL_WIDTH).floor() as usize;
    let row = (y * MASK_HEIGHT as f64 / LOGICAL_HEIGHT).floor() as usize;
    mask.get(row * MASK_WIDTH + column).copied().unwrap_or(0) != 0
}

fn dock_position(x: i32, y: i32, width: u32, height: u32, scale: f64) -> PhysicalPosition<i32> {
    // Use the work area, which excludes the Dock/taskbar and menu bar.
    let window_width = (LOGICAL_WIDTH * scale).round() as i32;
    let window_height = (LOGICAL_HEIGHT * scale).round() as i32;
    PhysicalPosition::new(
        x + (width as i32 - window_width).max(0),
        y + (height as i32 - window_height).max(0),
    )
}

pub fn dock(window: &WebviewWindow, monitor: &tauri::Monitor) -> tauri::Result<()> {
    let area = monitor.work_area();
    let position = dock_position(
        area.position.x,
        area.position.y,
        area.size.width,
        area.size.height,
        monitor.scale_factor(),
    );
    if window.outer_position()? != position {
        window.set_position(position)?;
    }
    Ok(())
}

pub fn reset_position(window: &WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        dock(window, &monitor)?;
    }
    Ok(())
}

pub fn next_display(window: &WebviewWindow) -> tauri::Result<()> {
    let monitors = window.available_monitors()?;
    let current = window.current_monitor()?;
    let index = current
        .and_then(|current| {
            monitors
                .iter()
                .position(|m| m.position() == current.position())
        })
        .map_or(0, |index| (index + 1) % monitors.len().max(1));
    if let Some(monitor) = monitors.get(index) {
        dock(window, monitor)?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_shell(
    window: WebviewWindow,
    state: tauri::State<'_, ShellState>,
    mask: Vec<u8>,
) -> Result<(), String> {
    if window.label() != "main"
        || mask.len() != MASK_WIDTH * MASK_HEIGHT
        || mask.iter().any(|&v| v > 1)
    {
        return Err("Invalid habitat hit mask".into());
    }
    *state.mask.lock().map_err(|e| e.to_string())? = mask;
    window.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_shell_error(window: WebviewWindow) -> Result<(), String> {
    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())
}

/// Native polling continues when a transparent area ignores webview mouse events.
/// Cursor coordinates are used transiently for hit testing and never recorded.
pub fn start_hit_testing(window: WebviewWindow) {
    thread::spawn(move || {
        let mut ignoring = true;
        let mut ticks = 0;
        loop {
            if !window.is_visible().unwrap_or(false) {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
            let state = window.state::<ShellState>();
            let ready = state.mask.lock().is_ok_and(|mask| !mask.is_empty());
            if !ready {
                thread::sleep(Duration::from_millis(250));
                continue;
            }
            let geometry = window
                .cursor_position()
                .and_then(|cursor| Ok((cursor, window.inner_position()?, window.scale_factor()?)));
            if let Ok((cursor, origin, scale)) = geometry {
                let hit = state.mask.lock().is_ok_and(|mask| {
                    hits_mask(
                        &mask,
                        cursor.x - origin.x as f64,
                        cursor.y - origin.y as f64,
                        scale,
                    )
                });
                let should_ignore = !hit;
                if should_ignore != ignoring
                    && window.set_ignore_cursor_events(should_ignore).is_ok()
                {
                    ignoring = should_ignore;
                }
            }
            // Re-dock if the current display's work area changes (e.g. Dock moves).
            if ticks % 50 == 0
                && let Err(error) = reset_position(&window)
            {
                eprintln!("Could not update habitat placement: {error}");
            }
            ticks = (ticks + 1) % 50;
            thread::sleep(Duration::from_millis(40));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hit_testing_handles_transparency_bounds_and_display_scale() {
        let mut mask = vec![0; MASK_WIDTH * MASK_HEIGHT];
        mask[50 * MASK_WIDTH + 40] = 1;
        for scale in [1.0, 1.25, 1.5, 2.0] {
            assert!(hits_mask(&mask, 80.5 * scale, 100.5 * scale, scale));
            assert!(!hits_mask(&mask, 79.0 * scale, 100.5 * scale, scale));
            assert!(!hits_mask(&mask, 220.0 * scale, 100.5 * scale, scale));
            assert!(!hits_mask(&mask, -0.1, 100.5 * scale, scale));
        }
        assert!(!hits_mask(&[], 80.0, 100.0, 1.0));
        assert!(!hits_mask(&mask, f64::NAN, 100.0, 1.0));
        assert!(!hits_mask(&mask, 80.0, 100.0, 0.0));
    }

    #[test]
    fn docking_uses_scaled_work_area_and_negative_monitor_origins() {
        assert_eq!(
            dock_position(0, 24, 1440, 816, 1.0),
            PhysicalPosition::new(1220, 640)
        );
        assert_eq!(
            dock_position(-2880, 48, 2880, 1632, 2.0),
            PhysicalPosition::new(-440, 1280)
        );
        assert_eq!(
            dock_position(100, 50, 100, 100, 1.0),
            PhysicalPosition::new(100, 50)
        );
    }
}
