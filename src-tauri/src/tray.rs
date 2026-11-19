use tauri::{
    Emitter, Manager,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::shell;
use tauri_plugin_autostart::ManagerExt;

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let clipboard = MenuItem::with_id(app, "clipboard", "Open clipboard…", true, None::<&str>)?;
    let agents = MenuItem::with_id(app, "agents", "AI agents…", true, None::<&str>)?;
    let utilities_separator = PredefinedMenuItem::separator(app)?;
    let show = MenuItem::with_id(app, "show", "Show spirit", true, None::<&str>)?;
    let play = MenuItem::with_id(app, "play", "Play now · run and peek", true, None::<&str>)?;
    let rest = MenuItem::with_id(app, "rest", "Rest here", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide spirit", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "Reset to bottom right", true, None::<&str>)?;
    let display = MenuItem::with_id(app, "display", "Move to next display", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tiny Desk Spirit", true, None::<&str>)?;
    let login = CheckMenuItem::with_id(
        app,
        "login",
        if cfg!(debug_assertions) {
            "Launch at login (release builds)"
        } else {
            "Launch at login"
        },
        !cfg!(debug_assertions),
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let menu = Menu::with_items(
        app,
        &[
            &clipboard,
            &agents,
            &utilities_separator,
            &show,
            &hide,
            &play,
            &rest,
            &reset,
            &display,
            &login,
            &separator,
            &quit,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("habitat")
        .tooltip("Ember · Clipboard and AI agents")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                crate::panel::request_open(tray.app_handle(), "clipboard");
            }
        })
        .on_menu_event(move |app, event| {
            if matches!(event.id.as_ref(), "clipboard" | "agents") {
                crate::panel::request_open(app, event.id.as_ref());
                return;
            }
            if event.id.as_ref() == "login" {
                let manager = app.autolaunch();
                let result = manager.is_enabled().and_then(|enabled| {
                    if enabled {
                        manager.disable()
                    } else {
                        manager.enable()
                    }
                });
                let _ = login.set_checked(manager.is_enabled().unwrap_or(false));
                if result.is_err() {
                    eprintln!("Launch-at-login change failed");
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
            if event.id.as_ref() == "play" {
                let _ = window.emit("buddy-tab", "close");
            }
            let result = match event.id.as_ref() {
                "show" => {
                    crate::roaming::set_enabled(&window, false);
                    shell::show_existing(&window)
                }
                "hide" => window.hide(),
                "play" => {
                    crate::roaming::set_enabled(&window, true);
                    window.show()
                }
                "rest" => {
                    crate::roaming::set_enabled(&window, false);
                    crate::placement::keep_visible(&window)
                }
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
