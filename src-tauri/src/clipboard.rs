use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;

const MAX_ITEMS: usize = 50;
const MAX_PINS: usize = 20;
const MAX_TEXT: usize = 16_384;
// A valid text byte can expand to six JSON bytes (for example, a NUL escape).
const MAX_FILE: u64 = (MAX_PINS * (MAX_TEXT * 6 + 256) + 1024) as u64;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clip {
    id: u64,
    text: String,
    pinned: bool,
    copied_at: u64,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    enabled: bool,
    entries: Vec<Clip>,
    error: Option<String>,
    revision: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    version: u8,
    enabled: bool,
    pins: Vec<Clip>,
}

#[derive(Clone, Default)]
struct Vault {
    snapshot: Snapshot,
    next_id: u64,
    last_seen: Option<u64>,
    seeded: bool,
    read_only: bool,
}

#[derive(Default)]
pub struct ClipboardState(Mutex<Vault>);

fn fingerprint(text: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

impl Vault {
    fn capture(&mut self, text: &str, now: u64) {
        let hash = fingerprint(text);
        if !self.seeded {
            // Enabling capture never imports the clipboard that was already there.
            self.seeded = true;
            self.last_seen = Some(hash);
            return;
        }
        if self.last_seen.replace(hash) == Some(hash)
            || text.trim().is_empty()
            || text.len() > MAX_TEXT
        {
            return;
        }
        if let Some(entry) = self.snapshot.entries.iter_mut().find(|e| e.text == text) {
            entry.copied_at = now;
        } else {
            if self.snapshot.entries.len() == MAX_ITEMS {
                let oldest = self
                    .snapshot
                    .entries
                    .iter()
                    .filter(|e| !e.pinned)
                    .min_by_key(|e| e.copied_at)
                    .map(|e| e.id);
                if let Some(id) = oldest {
                    self.snapshot.entries.retain(|e| e.id != id);
                } else {
                    return;
                }
            }
            self.next_id += 1;
            self.snapshot.entries.push(Clip {
                id: self.next_id,
                text: text.into(),
                pinned: false,
                copied_at: now,
            });
        }
        self.snapshot.revision += 1;
    }

    fn edit(&mut self, action: &str, id: Option<u64>) -> Result<(), String> {
        match action {
            "enable" | "pause" => {
                self.snapshot.enabled = action == "enable";
                self.seeded = false;
                self.last_seen = None;
            }
            "clear" => self.snapshot.entries.clear(),
            "pin" | "remove" => {
                let index = self
                    .snapshot
                    .entries
                    .iter()
                    .position(|e| Some(e.id) == id)
                    .ok_or("Clip no longer exists")?;
                if action == "remove" {
                    self.snapshot.entries.remove(index);
                } else {
                    if !self.snapshot.entries[index].pinned
                        && self.snapshot.entries.iter().filter(|e| e.pinned).count() >= MAX_PINS
                    {
                        return Err("You can pin up to 20 snippets".into());
                    }
                    self.snapshot.entries[index].pinned = !self.snapshot.entries[index].pinned;
                }
            }
            _ => return Err("Unknown clipboard action".into()),
        }
        self.snapshot.revision += 1;
        Ok(())
    }
}

pub(crate) fn private_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid storage path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
    let result = (|| {
        use std::io::Write;
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary).map_err(|e| e.to_string())?;
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&temporary, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("clipboard.json"))
}

fn save(path: &Path, vault: &Vault) -> Result<(), String> {
    if vault.read_only {
        return Err(
            "Existing clipboard settings could not be read. The file has been preserved.".into(),
        );
    }
    let saved = Saved {
        version: 1,
        enabled: vault.snapshot.enabled,
        pins: vault
            .snapshot
            .entries
            .iter()
            .filter(|e| e.pinned)
            .cloned()
            .collect(),
    };
    private_write(
        path,
        &serde_json::to_vec(&saved).map_err(|e| e.to_string())?,
    )
}

fn load(path: &Path) -> Result<Vault, String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vault::default()),
        Err(e) => return Err(e.to_string()),
    };
    let mut raw = Vec::new();
    file.take(MAX_FILE + 1)
        .read_to_end(&mut raw)
        .map_err(|e| e.to_string())?;
    if raw.len() as u64 > MAX_FILE {
        return Err("Clipboard file exceeds size limit".into());
    }
    let saved: Saved = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    if saved.version != 1
        || saved.pins.len() > MAX_PINS
        || saved
            .pins
            .iter()
            .any(|e| e.text.len() > MAX_TEXT || !e.pinned || e.id > 1_000_000_000_000)
    {
        return Err("Unsupported clipboard settings".into());
    }
    let mut vault = Vault {
        next_id: saved.pins.iter().map(|e| e.id).max().unwrap_or(0),
        ..Vault::default()
    };
    vault.snapshot.enabled = saved.enabled;
    vault.snapshot.entries = saved.pins;
    Ok(vault)
}

#[tauri::command]
pub fn clipboard_snapshot(
    window: WebviewWindow,
    state: tauri::State<'_, ClipboardState>,
) -> Result<Snapshot, String> {
    crate::panel::require_panel(&window)?;
    Ok(state.0.lock().map_err(|e| e.to_string())?.snapshot.clone())
}

#[derive(Serialize)]
pub struct CaptureStatus {
    enabled: bool,
    error: Option<String>,
}

impl From<&Snapshot> for CaptureStatus {
    fn from(snapshot: &Snapshot) -> Self {
        Self {
            enabled: snapshot.enabled,
            error: snapshot.error.clone(),
        }
    }
}

fn apply_edit(
    window: &WebviewWindow,
    vault: &mut Vault,
    action: &str,
    id: Option<u64>,
) -> Result<(), String> {
    let mut next = vault.clone();
    next.edit(action, id)?;
    save(&path(window.app_handle())?, &next)?;
    *vault = next;
    Ok(())
}

#[tauri::command]
pub fn clipboard_capture_status(
    window: WebviewWindow,
    state: tauri::State<'_, ClipboardState>,
) -> Result<CaptureStatus, String> {
    crate::settings::require_settings(&window)?;
    let vault = state.0.lock().map_err(|e| e.to_string())?;
    Ok(CaptureStatus::from(&vault.snapshot))
}

#[tauri::command]
pub fn set_clipboard_capture(
    window: WebviewWindow,
    state: tauri::State<'_, ClipboardState>,
    enabled: bool,
) -> Result<CaptureStatus, String> {
    crate::settings::require_settings(&window)?;
    let mut vault = state.0.lock().map_err(|e| e.to_string())?;
    apply_edit(
        &window,
        &mut vault,
        if enabled { "enable" } else { "pause" },
        None,
    )?;
    Ok(CaptureStatus::from(&vault.snapshot))
}

#[tauri::command]
pub fn clipboard_edit(
    window: WebviewWindow,
    state: tauri::State<'_, ClipboardState>,
    action: String,
    id: Option<u64>,
) -> Result<Snapshot, String> {
    crate::panel::require_panel(&window)?;
    if matches!(action.as_str(), "enable" | "pause") {
        return Err("Manage clipboard capture in Settings.".into());
    }
    let mut vault = state.0.lock().map_err(|e| e.to_string())?;
    apply_edit(&window, &mut vault, &action, id)?;
    Ok(vault.snapshot.clone())
}

#[tauri::command]
pub fn clipboard_copy(
    window: WebviewWindow,
    state: tauri::State<'_, ClipboardState>,
    id: u64,
) -> Result<(), String> {
    crate::panel::require_panel(&window)?;
    let mut vault = state.0.lock().map_err(|e| e.to_string())?;
    let text = &vault
        .snapshot
        .entries
        .iter()
        .find(|e| e.id == id)
        .ok_or("Clip no longer exists")?
        .text;
    let text = text.clone();
    copy_from_buddy(window.app_handle(), &mut vault, text)
}

pub(crate) fn copy_handoff(
    window: &WebviewWindow,
    state: &ClipboardState,
    text: String,
) -> Result<(), String> {
    let mut vault = state.0.lock().map_err(|e| e.to_string())?;
    copy_from_buddy(window.app_handle(), &mut vault, text)
}

fn copy_from_buddy(app: &tauri::AppHandle, vault: &mut Vault, text: String) -> Result<(), String> {
    let fingerprint = fingerprint(&text);
    app.clipboard()
        .write_text(text)
        .map_err(|_| "Could not copy. Try again.".to_string())?;
    vault.last_seen = Some(fingerprint);
    vault.seeded = true;
    Ok(())
}

pub fn start(app: &tauri::AppHandle) -> Result<(), String> {
    let loaded = load(&path(app)?).unwrap_or_else(|_| {
        let mut vault = Vault {
            read_only: true,
            ..Vault::default()
        };
        vault.snapshot.error =
            Some("Clipboard settings could not be read. Your existing file is preserved.".into());
        vault
    });
    *app.state::<ClipboardState>()
        .0
        .lock()
        .map_err(|e| e.to_string())? = loaded;
    let app = app.clone();
    thread::spawn(move || {
        loop {
            if let Ok(mut vault) = app.state::<ClipboardState>().0.lock()
                && vault.snapshot.enabled
            {
                match app.clipboard().read_text() {
                    Ok(text) => {
                        vault.snapshot.error = None;
                        vault.capture(&text, crate::agents::now_ms());
                    }
                    Err(error) => {
                        // A clipboard with an image or no text is a valid baseline too.
                        // arboard exposes this as ContentNotAvailable through the plugin.
                        if error.to_string().contains("not available") {
                            vault.seeded = true;
                            vault.last_seen = None;
                            vault.snapshot.error = None;
                        } else {
                            vault.snapshot.error =
                                Some("Clipboard is unavailable. Capture will retry.".into());
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(900));
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baseline_dedup_delete_and_clear_do_not_recapture_unchanged_text() {
        let mut v = Vault::default();
        v.capture("before consent", 0);
        assert!(v.snapshot.entries.is_empty());
        v.capture("new", 1);
        v.capture("new", 2);
        assert_eq!(v.snapshot.entries.len(), 1);
        v.edit("remove", Some(1)).unwrap();
        v.capture("new", 3);
        assert!(v.snapshot.entries.is_empty());
        v.capture("another", 4);
        v.edit("clear", None).unwrap();
        v.capture("another", 5);
        assert!(v.snapshot.entries.is_empty());
    }

    #[test]
    fn capture_is_bounded_and_preserves_pins() {
        let mut v = Vault::default();
        v.capture("baseline", 0);
        v.capture("pin me", 1);
        v.edit("pin", Some(1)).unwrap();
        for i in 0..80 {
            v.capture(&format!("clip {i}"), i + 2);
        }
        assert_eq!(v.snapshot.entries.len(), MAX_ITEMS);
        assert!(v.snapshot.entries.iter().any(|e| e.text == "pin me"));
        v.capture(&"x".repeat(MAX_TEXT + 1), 100);
        assert_eq!(v.snapshot.entries.len(), MAX_ITEMS);
    }

    #[test]
    fn pin_limit_and_pause_baseline_are_enforced() {
        let mut v = Vault::default();
        v.capture("baseline", 0);
        for i in 0..=MAX_PINS {
            v.capture(&format!("clip {i}"), i as u64 + 1);
            let id = v.next_id;
            assert_eq!(v.edit("pin", Some(id)).is_ok(), i < MAX_PINS);
        }
        let length = v.snapshot.entries.len();
        v.edit("pause", None).unwrap();
        v.edit("enable", None).unwrap();
        v.capture("copied while paused", 99);
        assert_eq!(v.snapshot.entries.len(), length);
        v.capture("new copy after resume", 100);
        assert_eq!(v.snapshot.entries.len(), length + 1);
    }

    #[test]
    fn only_pins_and_capture_preference_survive_restart() {
        let path =
            std::env::temp_dir().join(format!("buddy-clipboard-{}.json", std::process::id()));
        let mut v = Vault::default();
        v.capture("baseline", 0);
        v.capture("keep", 1);
        v.edit("pin", Some(1)).unwrap();
        v.capture("forget", 2);
        save(&path, &v).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.snapshot.entries.len(), 1);
        assert_eq!(loaded.snapshot.entries[0].text, "keep");
        fs::write(&path, b"broken").unwrap();
        assert!(load(&path).is_err());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn maximum_pins_round_trip_even_with_worst_case_json_escaping() {
        let path = std::env::temp_dir().join(format!(
            "buddy-clipboard-escaped-{}.json",
            std::process::id()
        ));
        let mut vault = Vault::default();
        vault.capture("baseline", 0);
        for index in 0..MAX_PINS {
            let text = format!("{index:02}{}", "\0".repeat(MAX_TEXT - 2));
            vault.capture(&text, index as u64 + 1);
            vault.edit("pin", Some(vault.next_id)).unwrap();
        }
        save(&path, &vault).unwrap();
        assert!(fs::metadata(&path).unwrap().len() > 400_000);
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.snapshot.entries.len(), MAX_PINS);
        for (before, after) in vault.snapshot.entries.iter().zip(&loaded.snapshot.entries) {
            assert_eq!(before.text, after.text);
        }
        fs::remove_file(path).unwrap();
    }
}
