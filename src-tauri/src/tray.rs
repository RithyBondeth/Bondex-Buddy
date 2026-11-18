use tauri::{
    Manager,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};

use crate::shell;
use tauri_plugin_autostart::ManagerExt;

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show spirit", true, None::<&str>)?;
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
        &[&show, &hide, &reset, &display, &login, &separator, &quit],
    )?;
    let mut tray = TrayIconBuilder::with_id("habitat")
        .tooltip("Tiny Desk Spirit")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
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
            let result = match event.id.as_ref() {
                "show" => shell::show_existing(&window),
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
