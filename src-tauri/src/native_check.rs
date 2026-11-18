//! Opt-in debug-only acceptance fixture. It never runs in a normal/release app.
use crate::shell::ShellState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use tauri::{Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub fn enabled() -> bool {
    cfg!(all(debug_assertions, feature = "native-test"))
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    if !enabled() {
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        "native-check",
        WebviewUrl::App("native-check.html".into()),
    )
    .title("Native acceptance test")
    .inner_size(650.0, 530.0)
    .resizable(false)
    .center()
    .build()?;
    Ok(())
}

pub fn place_overlay(window: &WebviewWindow) -> tauri::Result<()> {
    if !enabled() {
        return Ok(());
    }
    if let Some(checker) = window.app_handle().get_webview_window("native-check") {
        let p = checker.inner_position()?;
        let scale = checker.scale_factor()?;
        window
            .state::<ShellState>()
            .manual_placement
            .store(true, Ordering::Relaxed);
        window.set_position(PhysicalPosition::new(
            p.x + (300.0 * scale) as i32,
            p.y + (150.0 * scale) as i32,
        ))?;
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    x: f64,
    y: f64,
    scale: f64,
    ignored: bool,
    ghost: bool,
    visible: bool,
}

fn main_window(caller: &WebviewWindow) -> Result<WebviewWindow, String> {
    if !enabled() || caller.label() != "native-check" {
        return Err("Native fixture is disabled".into());
    }
    caller
        .app_handle()
        .get_webview_window("main")
        .ok_or("Habitat missing".into())
}

#[tauri::command]
pub fn native_check_status(window: WebviewWindow) -> Result<Status, String> {
    let pet = main_window(&window)?;
    let origin = window.inner_position().map_err(|e| e.to_string())?;
    let p = pet.inner_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let state = pet.state::<ShellState>();
    Ok(Status {
        x: (p.x - origin.x) as f64 / scale,
        y: (p.y - origin.y) as f64 / scale,
        scale,
        ignored: state.ignored.load(Ordering::Relaxed),
        ghost: state.ghosted.load(Ordering::Relaxed),
        visible: pet.is_visible().map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
pub fn native_check_action(window: WebviewWindow, action: String) -> Result<(), String> {
    let pet = main_window(&window)?;
    match action.as_str() {
        "dock" => {
            crate::shell::set_ghost_mode(pet.state(), false);
            crate::shell::reset_position(&pet).map_err(|e| e.to_string())?;
            window.hide().map_err(|e| e.to_string())
        }
        "place" => {
            crate::shell::set_ghost_mode(pet.state(), false);
            place_overlay(&pet).map_err(|e| e.to_string())?;
            pet.show().map_err(|e| e.to_string())
        }
        "hide" => pet.hide().map_err(|e| e.to_string()),
        "show" => pet.show().map_err(|e| e.to_string()),
        "ghost" => {
            crate::shell::set_working(pet.state(), true);
            crate::shell::set_ghost_mode(pet.state(), true);
            Ok(())
        }
        "solid" => {
            crate::shell::set_ghost_mode(pet.state(), false);
            Ok(())
        }
        _ => Err("Unknown native fixture action".into()),
    }
}
