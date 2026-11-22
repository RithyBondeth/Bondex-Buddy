use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use tauri::{Emitter, Manager, PhysicalPosition, WebviewWindow};

pub const MASK_WIDTH: usize = 110;
pub const MASK_HEIGHT: usize = 100;
const LOGICAL_WIDTH: f64 = 220.0;
const LOGICAL_HEIGHT: f64 = 200.0;

#[derive(Default)]
pub struct ShellState {
    pub manual_placement: AtomicBool,
    pub dragging: AtomicBool,
    pub pet_pressed: AtomicBool,
    pub ignored: AtomicBool,
    pub ghosted: AtomicBool,
    pub tools_open: AtomicBool,
    ghost_enabled: AtomicBool,
    working: AtomicBool,
    mask: Mutex<Vec<u8>>,
    habitat_focused: AtomicBool,
}

/// Restore the existing habitat without recreating its WebView.
pub fn show_existing(window: &WebviewWindow) -> tauri::Result<()> {
    window.state::<crate::roaming::PlayState>().restart_route();
    crate::placement::keep_visible(window)?;
    window.unminimize()?;
    window.show()
}

#[tauri::command]
pub fn set_working(state: tauri::State<'_, ShellState>, working: bool) {
    state.working.store(working, Ordering::Relaxed);
}
#[tauri::command]
pub fn set_ghost_mode(state: tauri::State<'_, ShellState>, enabled: bool) {
    state.ghost_enabled.store(enabled, Ordering::Relaxed);
}

fn logical_point(x: f64, y: f64, scale: f64) -> Option<(f64, f64)> {
    if !scale.is_finite() || scale <= 0.0 || !x.is_finite() || !y.is_finite() {
        return None;
    }
    let (x, y) = (x / scale, y / scale);
    ((0.0..LOGICAL_WIDTH).contains(&x) && (0.0..LOGICAL_HEIGHT).contains(&y)).then_some((x, y))
}

fn pet_local(x: f64, y: f64, scale: f64, width: f64, height: f64, open: bool) -> (f64, f64) {
    if open {
        (
            x - (width - 220.0 * scale).max(0.0),
            y - (height - 200.0 * scale).max(0.0),
        )
    } else {
        (x, y)
    }
}

fn hits_pocket(x: f64, y: f64, width: f64, height: f64, open: bool) -> bool {
    // Match the bubble in companion.css. Its trailing dots are decorative.
    let right = width - 10.0;
    let bottom = height - 76.0;
    if !open || !(10.0..right).contains(&x) || !(10.0..bottom).contains(&y) {
        return false;
    }
    let radius = 10.0;
    let dx = x - x.clamp(10.0 + radius, right - radius);
    let dy = y - y.clamp(10.0 + radius, bottom - radius);
    dx * dx + dy * dy < radius * radius
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
    crate::roaming::set_enabled(window, false);
    window
        .state::<ShellState>()
        .manual_placement
        .store(false, Ordering::Relaxed);
    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        dock(window, &monitor)?;
    }
    Ok(())
}

pub fn next_display(window: &WebviewWindow) -> tauri::Result<()> {
    crate::roaming::set_enabled(window, false);
    window
        .state::<ShellState>()
        .manual_placement
        .store(false, Ordering::Relaxed);
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
    update_shell_mask(window.clone(), state, mask)?;
    crate::native_check::place_overlay(&window).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_shell_mask(
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
    Ok(())
}

#[tauri::command]
pub fn set_habitat_focused(
    window: WebviewWindow,
    state: tauri::State<'_, ShellState>,
    focused: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Invalid habitat window".into());
    }
    state.habitat_focused.store(focused, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn shell_focused(window: WebviewWindow) -> Result<bool, String> {
    if window.label() != "main" {
        return Err("Invalid habitat window".into());
    }
    window.is_focused().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shell_visibility(window: WebviewWindow) -> Result<bool, String> {
    window.is_visible().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_shell_error(
    window: WebviewWindow,
    state: tauri::State<'_, ShellState>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Invalid habitat window".into());
    }
    state.mask.lock().map_err(|e| e.to_string())?.clear();
    state.habitat_focused.store(false, Ordering::Relaxed);
    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())
}

/// Native polling continues when a transparent area ignores webview mouse events.
/// Cursor coordinates are used transiently for hit testing and never recorded.
pub fn start_hit_testing(window: WebviewWindow) {
    thread::spawn(move || {
        let mut roamer = crate::roaming::Roamer::default();
        let mut ignoring = None;
        let mut hovered = false;
        let mut was_visible = false;
        let mut ticks = 0;
        let mut ghosted = false;
        loop {
            let visible = window.is_visible().unwrap_or(false);
            if was_visible != visible {
                was_visible = visible;
                let _ = window.emit("habitat-visibility", visible);
            }
            if !visible {
                let _ = roamer.tick(&window, false, false, false);
                window
                    .state::<ShellState>()
                    .ghosted
                    .store(false, Ordering::Relaxed);
                if ghosted {
                    ghosted = false;
                    let _ = window.emit("habitat-ghost", false);
                }
                ignoring = None;
                if hovered {
                    hovered = false;
                    let _ = window.emit("habitat-hover", false);
                }
                thread::sleep(Duration::from_millis(250));
                continue;
            }
            let state = window.state::<ShellState>();
            if crate::placement::finish_drag(&window) {
                let _ = roamer.tick(&window, false, true, true);
                if window.set_ignore_cursor_events(false).is_ok() {
                    ignoring = Some(false);
                    state.ignored.store(false, Ordering::Relaxed);
                }
                thread::sleep(Duration::from_millis(40));
                continue;
            }
            let ready = state.mask.lock().is_ok_and(|mask| !mask.is_empty());
            if !ready {
                ignoring = None;
                thread::sleep(Duration::from_millis(250));
                continue;
            }
            let geometry = window
                .cursor_position()
                .and_then(|cursor| Ok((cursor, window.inner_position()?, window.scale_factor()?)));
            if let Ok((cursor, origin, scale)) = geometry {
                let x = cursor.x - origin.x as f64;
                let y = cursor.y - origin.y as f64;
                let tools_open = state.tools_open.load(Ordering::Relaxed);
                let size = window.inner_size().unwrap_or_default();
                let (pet_x, pet_y) = pet_local(
                    x,
                    y,
                    scale,
                    size.width as f64,
                    size.height as f64,
                    tools_open,
                );
                let inside = logical_point(pet_x, pet_y, scale).is_some();
                if hovered != inside {
                    hovered = inside;
                    let _ = window.emit("habitat-hover", hovered);
                }
                let hit = state.mask.lock().is_ok_and(|mask| {
                    (hits_mask(&mask, pet_x, pet_y, scale)
                        && !(!tools_open
                            && state.ghost_enabled.load(Ordering::Relaxed)
                            && state.working.load(Ordering::Relaxed)
                            && inside))
                        || hits_pocket(
                            x / scale,
                            y / scale,
                            size.width as f64 / scale,
                            size.height as f64 / scale,
                            tools_open,
                        )
                });
                let ghost = !tools_open
                    && state.ghost_enabled.load(Ordering::Relaxed)
                    && state.working.load(Ordering::Relaxed)
                    && inside;
                if ghosted != ghost {
                    ghosted = ghost;
                    state.ghosted.store(ghost, Ordering::Relaxed);
                    let _ = window.emit("habitat-ghost", ghost);
                }
                // Keep delivering pointer events until the click or drag is resolved.
                let pet_pressed = state.pet_pressed.load(Ordering::Relaxed);
                let held = pet_pressed && crate::placement::mouse_down();
                if pet_pressed && !held {
                    state.pet_pressed.store(false, Ordering::Relaxed);
                }
                let should_ignore = !hit && !held;
                if Some(should_ignore) != ignoring
                    && window.set_ignore_cursor_events(should_ignore).is_ok()
                {
                    ignoring = Some(should_ignore);
                    state.ignored.store(should_ignore, Ordering::Relaxed);
                }
            }
            if let Err(error) = roamer.tick(
                &window,
                hovered
                    || (state.habitat_focused.load(Ordering::Relaxed)
                        && window.is_focused().unwrap_or(false)),
                false,
                true,
            ) {
                eprintln!("Could not update playful roaming: {error}");
                crate::roaming::set_enabled(&window, false);
            }
            // Re-dock if the current display's work area changes (e.g. Dock moves).
            if ticks % 50 == 0
                && !state.tools_open.load(Ordering::Relaxed)
                && !crate::roaming::active(&window)
            {
                let result = if state.manual_placement.load(Ordering::Relaxed) {
                    crate::placement::keep_visible(&window)
                } else {
                    window.current_monitor().and_then(|monitor| {
                        if let Some(monitor) = monitor {
                            dock(&window, &monitor)
                        } else {
                            Ok(())
                        }
                    })
                };
                if let Err(error) = result {
                    eprintln!("Could not update habitat placement: {error}");
                }
            }
            ticks = (ticks + 1) % 50;
            // Use finer native position steps during a run, without increasing idle polling.
            thread::sleep(Duration::from_millis(if crate::roaming::active(&window) {
                16
            } else {
                33
            }));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expanded_sheet_and_pet_mask_keep_transparent_gaps_click_through() {
        assert_eq!(
            pet_local(580.0, 1120.0, 2.0, 800.0, 1320.0, true),
            (220.0, 200.0)
        );
        assert_eq!(
            pet_local(110.0, 100.0, 1.0, 220.0, 200.0, false),
            (110.0, 100.0)
        );
        assert!(hits_pocket(30.0, 179.0, 264.0, 256.0, true));
        assert!(!hits_pocket(10.0, 10.0, 264.0, 256.0, true));
        assert!(!hits_pocket(5.0, 40.0, 264.0, 256.0, true));
        assert!(!hits_pocket(158.0, 184.0, 264.0, 256.0, true));
        assert!(!hits_pocket(30.0, 40.0, 264.0, 256.0, false));
    }

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
