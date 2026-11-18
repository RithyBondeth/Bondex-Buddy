mod activity;
mod native_check;
mod placement;
mod shell;
mod storage;
mod tray;

use tauri::Manager;

fn reveal_existing(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main")
        && let Err(error) = shell::show_existing(&window)
    {
        eprintln!("Could not restore habitat: {error}");
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        // Detect a second process before startup observers or storage are initialized.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            reveal_existing(app);
        }))
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
            storage::save_progress,
            native_check::native_check_status,
            native_check::native_check_action
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::setup(app)?;
            native_check::setup(app)?;
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
        .build(tauri::generate_context!())
        .expect("failed to build Tiny Desk Spirit");

    app.run(|handle, event| {
        // LaunchServices reuses the process on macOS and sends Reopen instead.
        #[cfg(target_os = "macos")]
        if matches!(event, tauri::RunEvent::Reopen { .. }) {
            reveal_existing(handle);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (handle, event);
    });
}
