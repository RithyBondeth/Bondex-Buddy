use crate::shell::ShellState;
use std::sync::atomic::Ordering;
use tauri::{Manager, PhysicalPosition, WebviewWindow};

#[cfg(target_os = "macos")]
fn mouse_down() -> bool {
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceButtonState(state: i32, button: u32) -> bool;
    }
    // SAFETY: scalar arguments select combined-session state and the left button.
    unsafe { CGEventSourceButtonState(0, 0) }
}
#[cfg(target_os = "windows")]
fn mouse_down() -> bool {
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetAsyncKeyState(key: i32) -> i16;
    }
    // SAFETY: VK_LBUTTON is valid; no pointers or hooks.
    unsafe { GetAsyncKeyState(1) < 0 }
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn mouse_down() -> bool {
    false
}

fn fit(
    p: PhysicalPosition<i32>,
    min: PhysicalPosition<i32>,
    max: PhysicalPosition<i32>,
    threshold: i32,
) -> PhysicalPosition<i32> {
    let axis = |v: i32, low: i32, high: i32| {
        let high = high.max(low);
        let v = v.clamp(low, high);
        if v - low <= threshold {
            low
        } else if high - v <= threshold {
            high
        } else {
            v
        }
    };
    PhysicalPosition::new(axis(p.x, min.x, max.x), axis(p.y, min.y, max.y))
}
fn place(window: &WebviewWindow, p: PhysicalPosition<i32>, snap: bool) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        let a = monitor.work_area();
        let size = window.outer_size()?;
        let max = PhysicalPosition::new(
            a.position.x + a.size.width as i32 - size.width as i32,
            a.position.y + a.size.height as i32 - size.height as i32,
        );
        window.set_position(fit(
            p,
            a.position,
            max,
            if snap {
                (16.0 * monitor.scale_factor()).round() as i32
            } else {
                0
            },
        ))?;
    }
    Ok(())
}
#[tauri::command]
pub fn begin_drag(
    window: WebviewWindow,
    state: tauri::State<'_, ShellState>,
) -> Result<(), String> {
    // Keyboard/AX activation and an already released click must not enter an OS drag loop.
    if !mouse_down() {
        return Ok(());
    }
    state.manual_placement.store(true, Ordering::Relaxed);
    state.dragging.store(true, Ordering::Relaxed);
    if let Err(error) = window.start_dragging() {
        state.dragging.store(false, Ordering::Relaxed);
        return Err(error.to_string());
    }
    Ok(())
}
#[tauri::command]
pub fn nudge_habitat(
    window: WebviewWindow,
    state: tauri::State<'_, ShellState>,
    dx: i32,
    dy: i32,
) -> Result<(), String> {
    if !(-24..=24).contains(&dx) || !(-24..=24).contains(&dy) {
        return Err("Invalid movement".into());
    }
    let p = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    state.manual_placement.store(true, Ordering::Relaxed);
    place(
        &window,
        PhysicalPosition::new(
            p.x + (dx as f64 * scale).round() as i32,
            p.y + (dy as f64 * scale).round() as i32,
        ),
        false,
    )
    .map_err(|e| e.to_string())
}
pub fn finish_drag(window: &WebviewWindow) -> bool {
    let state = window.state::<ShellState>();
    if !state.dragging.load(Ordering::Relaxed) {
        return false;
    }
    if mouse_down() {
        return true;
    }
    state.dragging.store(false, Ordering::Relaxed);
    if let Ok(p) = window.outer_position()
        && let Err(error) = place(window, p, true)
    {
        eprintln!("Could not snap habitat: {error}");
    }
    false
}

pub fn keep_visible(window: &WebviewWindow) -> tauri::Result<()> {
    place(window, window.outer_position()?, false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn snap_clamp_and_negative_display_origins() {
        let min = PhysicalPosition::new(-1440, 24);
        let max = PhysicalPosition::new(-220, 700);
        assert_eq!(
            fit(PhysicalPosition::new(-1430, 60), min, max, 16),
            PhysicalPosition::new(-1440, 60)
        );
        assert_eq!(fit(PhysicalPosition::new(50, 900), min, max, 16), max);
        assert_eq!(
            fit(PhysicalPosition::new(-500, 500), min, max, 16),
            PhysicalPosition::new(-500, 500)
        );
        assert_eq!(
            fit(PhysicalPosition::new(-1430, 60), min, max, 0),
            PhysicalPosition::new(-1430, 60)
        );
    }
}
