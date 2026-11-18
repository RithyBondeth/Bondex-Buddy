mod activity;
mod placement;
mod shell;
mod storage;
mod tray;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .manage(shell::ShellState::default())
        .manage(storage::ProgressStorage::default())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            shell::show_shell,
            shell::show_shell_error,
            shell::update_shell_mask,
            shell::set_controls_visible,
            shell::set_drawer_visible,
            shell::set_working,
            shell::set_ghost_mode,
            placement::begin_drag,
            placement::nudge_habitat,
            shell::shell_visibility,
            activity::activity_snapshot,
            storage::load_progress,
            storage::save_progress
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::setup(app)?;
            let window = app
                .get_webview_window("main")
                .ok_or("Habitat window missing")?;
            window.set_ignore_cursor_events(true)?;
            if let Some(monitor) = window.primary_monitor()? {
                shell::dock(&window, &monitor)?;
            }
            activity::start_observer(window.clone());
            shell::start_hit_testing(window);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("Could not hide habitat: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Tiny Desk Spirit");
}
