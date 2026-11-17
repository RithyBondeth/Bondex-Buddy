use tauri::{
    Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
};

use crate::shell;

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show spirit", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide spirit", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "Reset to bottom right", true, None::<&str>)?;
    let display = MenuItem::with_id(app, "display", "Move to next display", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tiny Desk Spirit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &reset, &display, &separator, &quit])?;
    let mut tray = TrayIconBuilder::with_id("habitat")
        .tooltip("Tiny Desk Spirit")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "quit" {
                app.exit(0);
                return;
            }
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            let result = match event.id.as_ref() {
                "show" => shell::reset_position(&window).and_then(|()| window.show()),
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
