use serde::Serialize;
use std::sync::{Mutex, atomic::Ordering};
use tauri::{Emitter, Manager, PhysicalPosition, WebviewWindow};

#[derive(Default)]
pub struct PanelState(Mutex<Option<Collapsed>>);
struct Collapsed {
    position: PhysicalPosition<i32>,
    expanded_position: PhysicalPosition<i32>,
    manual: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PocketSize {
    width: f64,
    height: f64,
}
fn expanded_size(work_width: f64, work_height: f64) -> PocketSize {
    PocketSize {
        width: work_width.clamp(220.0, 300.0),
        height: work_height.clamp(200.0, 300.0),
    }
}
pub fn request_open(app: &tauri::AppHandle, tab: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.emit("buddy-tab", tab);
        let _ = window.set_focus();
    }
}
#[tauri::command]
pub fn set_companion_open(window: WebviewWindow, open: bool) -> Result<PocketSize, String> {
    if window.label() != "main" {
        return Err("Only Ember can open its pocket".into());
    }
    let app = window.app_handle();
    let panel = app.state::<PanelState>();
    let mut previous = panel.0.lock().map_err(|e| e.to_string())?;
    let shell = app.state::<crate::shell::ShellState>();
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    if open {
        if previous.is_none() {
            let position = window.outer_position().map_err(|e| e.to_string())?;
            let monitor = window
                .current_monitor()
                .map_err(|e| e.to_string())?
                .ok_or("Display unavailable")?;
            let area = monitor.work_area();
            let size = expanded_size(
                area.size.width as f64 / scale,
                area.size.height as f64 / scale,
            );
            let position_expanded = PhysicalPosition::new(
                (position.x - ((size.width - 220.0) * scale).round() as i32).clamp(
                    area.position.x,
                    (area.position.x + area.size.width as i32
                        - (size.width * scale).round() as i32)
                        .max(area.position.x),
                ),
                (position.y - ((size.height - 200.0) * scale).round() as i32).clamp(
                    area.position.y,
                    (area.position.y + area.size.height as i32
                        - (size.height * scale).round() as i32)
                        .max(area.position.y),
                ),
            );
            shell.tools_open.store(true, Ordering::Relaxed);
            if let Err(error) = window
                .set_size(tauri::LogicalSize::new(size.width, size.height))
                .and_then(|_| window.set_position(position_expanded))
            {
                let _ = window.set_size(tauri::LogicalSize::new(220.0, 200.0));
                let _ = window.set_position(position);
                shell.tools_open.store(false, Ordering::Relaxed);
                return Err(error.to_string());
            }
            *previous = Some(Collapsed {
                position,
                expanded_position: position_expanded,
                manual: shell.manual_placement.load(Ordering::Relaxed),
            });
        }
        window
            .set_ignore_cursor_events(false)
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        return Ok(PocketSize {
            width: size.width as f64 / scale,
            height: size.height as f64 / scale,
        });
    }
    if let Some(saved) = previous.as_ref() {
        let expanded = window.outer_position().map_err(|e| e.to_string())?;
        let moved = expanded != saved.expanded_position;
        let collapsed = PhysicalPosition::new(
            saved.position.x + (expanded.x - saved.expanded_position.x),
            saved.position.y + (expanded.y - saved.expanded_position.y),
        );
        window
            .set_size(tauri::LogicalSize::new(220.0, 200.0))
            .map_err(|e| e.to_string())?;
        window.set_position(collapsed).map_err(|e| e.to_string())?;
        shell
            .manual_placement
            .store(saved.manual || moved, Ordering::Relaxed);
        crate::placement::keep_visible(&window).map_err(|e| e.to_string())?;
        *previous = None;
    }
    shell.tools_open.store(false, Ordering::Relaxed);
    Ok(PocketSize {
        width: 220.0,
        height: 200.0,
    })
}
pub fn require_panel(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only Ember can access its tools".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pocket_fits_small_and_scaled_work_areas() {
        let regular = expanded_size(1440.0, 816.0);
        assert_eq!((regular.width, regular.height), (300.0, 300.0));
        let small = expanded_size(240.0, 250.0);
        assert_eq!((small.width, small.height), (240.0, 250.0));
    }
}
