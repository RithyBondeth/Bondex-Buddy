use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{App, AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;

const LABEL: &str = "settings";

#[derive(Default)]
pub struct SettingsState {
    snapshot: Mutex<Option<Value>>,
    focused: AtomicBool,
}

pub fn set_focused(app: &AppHandle, focused: bool) {
    app.state::<SettingsState>()
        .focused
        .store(focused, Ordering::Relaxed);
}

pub fn is_focused(app: &AppHandle) -> bool {
    app.state::<SettingsState>().focused.load(Ordering::Relaxed)
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "setting", content = "value", rename_all = "camelCase")]
pub enum HabitatChange {
    Companion(String),
    Decor(String),
    Outfit(String),
    Lighting(Lighting),
    Ghost(bool),
    Roaming(bool),
    Sound(bool),
    WaterMinutes(u8),
    WaterPreview(bool),
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Lighting {
    Auto,
    Day,
}

pub fn setup(app: &App) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("settings.html".into()))
        .title("Bondex Buddy Settings")
        .theme(Some(tauri::Theme::Dark))
        .inner_size(430.0, 560.0)
        .min_inner_size(340.0, 360.0)
        .center()
        .visible(false)
        .focused(false)
        .skip_taskbar(true)
        .build()?;
    #[cfg(target_os = "macos")]
    {
        use tauri::menu::{MenuItem, MenuItemKind};
        if let Some(menu) = app.menu()
            && let Some(MenuItemKind::Submenu(application)) = menu.items()?.first()
        {
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("Cmd+,"))?;
            application.insert(&settings, 1)?;
        }
    }
    Ok(())
}

pub fn open(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(LABEL) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

pub fn require_settings(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != LABEL {
        return Err("Open Settings from the menu bar to change preferences.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn read_habitat_settings(
    window: WebviewWindow,
    state: tauri::State<'_, SettingsState>,
) -> Result<Option<Value>, String> {
    require_settings(&window)?;
    Ok(state.snapshot.lock().map_err(|e| e.to_string())?.clone())
}

#[tauri::command]
pub fn publish_habitat_settings(
    window: WebviewWindow,
    state: tauri::State<'_, SettingsState>,
    snapshot: Value,
) -> Result<(), String> {
    crate::panel::require_panel(&window)?;
    *state.snapshot.lock().map_err(|e| e.to_string())? = Some(snapshot.clone());
    window
        .emit_to(LABEL, "habitat-settings", snapshot)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn change_habitat_setting(
    window: WebviewWindow,
    state: tauri::State<'_, SettingsState>,
    change: HabitatChange,
) -> Result<(), String> {
    require_settings(&window)?;
    if state.snapshot.lock().map_err(|e| e.to_string())?.is_none() {
        return Err("Your companion is still getting ready.".into());
    }
    window
        .emit_to("main", "habitat-setting-changed", change)
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct LaunchAtLogin {
    enabled: bool,
    editable: bool,
}

#[tauri::command]
pub fn launch_at_login(window: WebviewWindow) -> Result<LaunchAtLogin, String> {
    require_settings(&window)?;
    let enabled = window
        .app_handle()
        .autolaunch()
        .is_enabled()
        .map_err(|e| e.to_string())?;
    Ok(LaunchAtLogin {
        enabled,
        editable: !cfg!(debug_assertions),
    })
}

#[tauri::command]
pub fn set_launch_at_login(window: WebviewWindow, enabled: bool) -> Result<LaunchAtLogin, String> {
    require_settings(&window)?;
    if cfg!(debug_assertions) {
        return Err("Launch at login is available in the installed app.".into());
    }
    let manager = window.app_handle().autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|e| e.to_string())?;
    launch_at_login(window)
}
