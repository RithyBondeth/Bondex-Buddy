use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::shell;

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let preferences_separator = PredefinedMenuItem::separator(app)?;
    let focus = MenuItem::with_id(app, "focus", "Focus timer…", true, None::<&str>)?;
    let clipboard = MenuItem::with_id(app, "clipboard", "Open clipboard…", true, None::<&str>)?;
    let agents = MenuItem::with_id(app, "agents", "AI agents…", true, None::<&str>)?;
    let utilities_separator = PredefinedMenuItem::separator(app)?;
    let show = MenuItem::with_id(app, "show", "Show spirit", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide spirit", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "Reset to bottom right", true, None::<&str>)?;
    let display = MenuItem::with_id(app, "display", "Move to next display", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tiny Desk Spirit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &settings,
            &preferences_separator,
            &focus,
            &clipboard,
            &agents,
            &utilities_separator,
            &show,
            &hide,
            &reset,
            &display,
            &separator,
            &quit,
        ],
    )?;
    let tray = TrayIconBuilder::with_id("habitat")
        .tooltip("Bondex Buddy")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "macos"));
    let mut tray = tray
        .on_tray_icon_event(|tray, event| {
            if !cfg!(target_os = "macos")
                && matches!(
                    event,
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                )
            {
                crate::panel::request_open(tray.app_handle(), "clipboard");
            }
        })
        .on_menu_event(|app, event| {
            if matches!(event.id.as_ref(), "focus" | "clipboard" | "agents") {
                crate::panel::request_open(app, event.id.as_ref());
                return;
            }
            if event.id.as_ref() == "settings" {
                if let Err(error) = crate::settings::open(app) {
                    eprintln!("Could not open Bondex Buddy Settings: {error}");
                }
                return;
            }
            if event.id.as_ref() == "quit" {
                app.exit(0);
                return;
            }
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            if matches!(event.id.as_ref(), "reset" | "display") {
                if let Err(error) = crate::panel::set_companion_open(window.clone(), false) {
                    eprintln!("Could not collapse Ember before moving: {error}");
                    return;
                }
                let _ = window.emit("buddy-tab", "close");
            }
            let result = match event.id.as_ref() {
                "show" => {
                    crate::roaming::set_enabled(&window, false);
                    shell::show_existing(&window)
                }
                "hide" => window.hide(),
                "reset" => shell::reset_position(&window),
                "display" => shell::next_display(&window),
                _ => Ok(()),
            };
            if let Err(error) = result {
                eprintln!("Habitat menu action failed: {error}");
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
