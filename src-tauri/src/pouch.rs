use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read},
    path::{Component, Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, WebviewWindow};

const DAY_MS: u64 = 24 * 60 * 60 * 1000;
const MAX_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_FILES: usize = 50;
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub struct PouchState {
    files: Mutex<()>,
    drag: Mutex<Option<String>>,
    incoming_files: AtomicBool,
}

impl PouchState {
    fn leased(&self) -> Result<Option<String>, String> {
        self.drag
            .lock()
            .map(|slot| slot.clone())
            .map_err(|error| error.to_string())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PouchFile {
    id: String,
    name: String,
    size: u64,
    added_at: u64,
    expires_at: u64,
}

#[derive(Clone, Serialize)]
struct PouchNotice {
    added: usize,
    error: Option<String>,
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("file-pouch"))
}

fn private_directory(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        fs::DirBuilder::new().mode(0o700).create(path)
    }
    #[cfg(not(unix))]
    {
        fs::create_dir(path)
    }
}

fn create_root(root: &Path) -> io::Result<()> {
    if let Some(parent) = root.parent() {
        fs::create_dir_all(parent)?;
    }
    match private_directory(root) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            if fs::symlink_metadata(root)?.is_dir() {
                Ok(())
            } else {
                Err(error)
            }
        }
        Err(error) => Err(error),
    }
}

fn valid_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn valid_filename(name: &str) -> bool {
    let mut parts = Path::new(name).components();
    matches!(parts.next(), Some(Component::Normal(part)) if part == name)
        && parts.next().is_none()
        && (!cfg!(windows) || !name.contains(':'))
}

fn payload(root: &Path, entry: &PouchFile) -> PathBuf {
    root.join(&entry.id).join("file").join(&entry.name)
}

fn read_record(root: &Path, id: &str) -> Option<PouchFile> {
    if !valid_id(id) || !fs::symlink_metadata(root).ok()?.is_dir() {
        return None;
    }
    let folder = root.join(id);
    if !fs::symlink_metadata(&folder).ok()?.is_dir() {
        return None;
    }
    let metadata = folder.join("record.json");
    if !fs::symlink_metadata(&metadata).ok()?.is_file() {
        return None;
    }
    let mut raw = Vec::new();
    File::open(metadata)
        .ok()?
        .take(8193)
        .read_to_end(&mut raw)
        .ok()?;
    if raw.len() > 8192 {
        return None;
    }
    let record: PouchFile = serde_json::from_slice(&raw).ok()?;
    (record.id == id && valid_filename(&record.name)).then_some(record)
}

fn write_record(folder: &Path, record: &PouchFile) -> Result<(), String> {
    let bytes = serde_json::to_vec(record).map_err(|error| error.to_string())?;
    crate::clipboard::private_write(&folder.join("record.json"), &bytes)
}

fn list(root: &Path, now: u64, leased: Option<&str>) -> Result<Vec<PouchFile>, String> {
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.is_dir() => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        _ => return Err("Could not open Ember’s pouch.".into()),
    }
    let children = match fs::read_dir(root) {
        Ok(children) => children,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let mut entries = Vec::new();
    for child in children.flatten() {
        let name = child.file_name();
        let Some(id) = name.to_str() else { continue };
        if child.file_type().is_ok_and(|kind| kind.is_dir())
            && id.strip_prefix(".incoming-").is_some_and(valid_id)
        {
            let _ = fs::remove_dir_all(child.path());
        } else if let Some(entry) = read_record(root, id) {
            if entry.expires_at <= now {
                if leased != Some(id) {
                    let _ = fs::remove_dir_all(child.path());
                }
            } else if fs::symlink_metadata(payload(root, &entry)).is_ok_and(|meta| meta.is_file()) {
                entries.push(entry);
            }
        }
    }
    entries.sort_by_key(|entry| (std::cmp::Reverse(entry.added_at), entry.id.clone()));
    Ok(entries)
}

fn copy_into(root: &Path, source: &Path, remaining: u64, now: u64) -> Result<PouchFile, String> {
    let source_metadata =
        fs::symlink_metadata(source).map_err(|_| "Could not read a dropped file.")?;
    if !source_metadata.is_file() {
        return Err("Drop individual files into Ember’s pouch.".into());
    }
    if source_metadata.len() > remaining {
        return Err("That drop would exceed the pouch’s 2 GB limit.".into());
    }
    let source = fs::canonicalize(source).map_err(|_| "Could not read a dropped file.")?;
    if source.starts_with(root) {
        return Err("That file is already in the pouch.".into());
    }
    let name = source
        .file_name()
        .ok_or("The dropped file has no name.")?
        .to_string_lossy()
        .into_owned();
    if !valid_filename(&name) {
        return Err("Could not store that file name.".into());
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let id = format!(
        "{:032x}",
        nanos.wrapping_add(u128::from(NEXT_ID.fetch_add(1, Ordering::Relaxed)))
    );
    let incoming = root.join(format!(".incoming-{id}"));
    private_directory(&incoming).map_err(|_| "Could not create a temporary file.")?;
    let result = (|| {
        let contents = incoming.join("file");
        private_directory(&contents).map_err(|_| "Could not create a temporary file.")?;
        let source = File::open(source).map_err(|_| "Could not open a dropped file.")?;
        if !source.metadata().is_ok_and(|metadata| metadata.is_file()) {
            return Err("Drop individual files into Ember’s pouch.".into());
        }
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut destination = options
            .open(contents.join(&name))
            .map_err(|_| "Could not save a temporary copy.")?;
        let size = io::copy(&mut source.take(remaining + 1), &mut destination)
            .map_err(|_| "Could not copy a dropped file.")?;
        if size > remaining {
            return Err("That drop would exceed the pouch’s 2 GB limit.".into());
        }
        destination
            .sync_all()
            .map_err(|_| "Could not save the temporary copy.")?;
        drop(destination);
        let entry = PouchFile {
            id,
            name,
            size,
            added_at: now,
            expires_at: now.saturating_add(DAY_MS),
        };
        write_record(&incoming, &entry)?;
        fs::rename(&incoming, root.join(&entry.id)).map_err(|_| "Could not tuck the file away.")?;
        Ok(entry)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(incoming);
    }
    result
}

fn add_files(app: &AppHandle, paths: &[PathBuf]) -> Result<PouchNotice, String> {
    let state = app.state::<PouchState>();
    let _guard = state.files.lock().map_err(|error| error.to_string())?;
    let lease = state.leased()?;
    let root = root(app)?;
    create_root(&root).map_err(|_| "Could not open Ember’s pouch.")?;
    let root = fs::canonicalize(root).map_err(|_| "Could not open Ember’s pouch.")?;
    let now = crate::agents::now_ms();
    let existing = list(&root, now, lease.as_deref())?;
    let mut bytes = existing
        .iter()
        .fold(0_u64, |total, entry| total.saturating_add(entry.size));
    let expired_lease = lease
        .as_deref()
        .and_then(|id| read_record(&root, id))
        .filter(|entry| entry.expires_at <= now);
    if let Some(entry) = &expired_lease {
        bytes = bytes.saturating_add(entry.size);
    }
    let occupied = existing.len() + usize::from(expired_lease.is_some());
    let mut notice = PouchNotice {
        added: 0,
        error: None,
    };
    for source in paths.iter().take(MAX_FILES) {
        if occupied + notice.added >= MAX_FILES {
            notice
                .error
                .get_or_insert_with(|| "The pouch can hold 50 files.".into());
            break;
        }
        match copy_into(
            &root,
            source,
            MAX_BYTES.saturating_sub(bytes),
            crate::agents::now_ms(),
        ) {
            Ok(entry) => {
                bytes = bytes.saturating_add(entry.size);
                notice.added += 1;
            }
            Err(error) => {
                notice.error.get_or_insert(error);
            }
        }
    }
    if paths.len() > MAX_FILES {
        notice
            .error
            .get_or_insert_with(|| "Drop up to 50 files at a time.".into());
    }
    Ok(notice)
}

pub fn set_hover(window: &WebviewWindow, hovered: bool) {
    let shell = window.state::<crate::shell::ShellState>();
    if shell.pouch_hover.swap(hovered, Ordering::Relaxed) != hovered {
        let _ = window.emit("pouch-hover", hovered);
    }
}

pub fn drop_event(window: &WebviewWindow, event: &DragDropEvent) {
    let state = window.state::<PouchState>();
    match event {
        DragDropEvent::Enter { paths, position } => {
            state
                .incoming_files
                .store(!paths.is_empty(), Ordering::Relaxed);
            set_hover(
                window,
                !paths.is_empty() && crate::shell::file_drop_target(window, *position),
            );
        }
        DragDropEvent::Over { position } => {
            set_hover(
                window,
                state.incoming_files.load(Ordering::Relaxed)
                    && crate::shell::file_drop_target(window, *position),
            );
        }
        DragDropEvent::Drop { paths, position } => {
            state.incoming_files.store(false, Ordering::Relaxed);
            set_hover(window, false);
            if paths.is_empty() || !crate::shell::file_drop_target(window, *position) {
                return;
            }
            let paths: Vec<_> = paths.iter().take(MAX_FILES + 1).cloned().collect();
            let window = window.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let notice =
                    add_files(window.app_handle(), &paths).unwrap_or_else(|error| PouchNotice {
                        added: 0,
                        error: Some(error),
                    });
                let _ = window.emit("pouch-notice", notice);
            });
        }
        _ => {
            state.incoming_files.store(false, Ordering::Relaxed);
            set_hover(window, false);
        }
    }
}

pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            if let Ok(root) = root(&app) {
                let state = app.state::<PouchState>();
                if let Ok(_guard) = state.files.lock()
                    && let Ok(lease) = state.leased()
                {
                    let _ = list(&root, crate::agents::now_ms(), lease.as_deref());
                }
            }
            std::thread::sleep(Duration::from_secs(60));
        }
    });
}

#[tauri::command]
pub async fn pouch_files(window: WebviewWindow) -> Result<Vec<PouchFile>, String> {
    crate::panel::require_panel(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let app = window.app_handle();
        let state = app.state::<PouchState>();
        let _guard = state.files.lock().map_err(|error| error.to_string())?;
        let lease = state.leased()?;
        list(&root(app)?, crate::agents::now_ms(), lease.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn pouch_edit(window: WebviewWindow, id: String, action: String) -> Result<(), String> {
    crate::panel::require_panel(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let app = window.app_handle();
        let state = app.state::<PouchState>();
        let _guard = state.files.lock().map_err(|error| error.to_string())?;
        let lease = state.leased()?;
        let root = root(app)?;
        let now = crate::agents::now_ms();
        let mut entry = read_record(&root, &id)
            .filter(|entry| entry.expires_at > now)
            .ok_or("That file has expired.")?;
        let folder = root.join(&id);
        match action.as_str() {
            "extend" => {
                entry.expires_at = entry.expires_at.saturating_add(DAY_MS);
                write_record(&folder, &entry)
            }
            "remove" if lease.as_deref() == Some(&id) => {
                Err("Finish dragging the file first.".into())
            }
            "remove" => fs::remove_dir_all(folder)
                .map_err(|_| "Could not remove the temporary copy.".into()),
            _ => Err("Unknown pouch action.".into()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn release_drag(window: &WebviewWindow, id: &str) {
    let state = window.state::<PouchState>();
    if let Ok(mut lease) = state.drag.lock()
        && lease.as_deref() == Some(id)
    {
        *lease = None;
    }
}

#[tauri::command]
pub async fn pouch_drag(window: WebviewWindow, id: String) -> Result<(), String> {
    crate::panel::require_panel(&window)?;
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        let target = window.clone();
        let drag_id = id.clone();
        let path = tauri::async_runtime::spawn_blocking(move || -> Result<PathBuf, String> {
            let app = target.app_handle();
            let state = app.state::<PouchState>();
            let _guard = state.files.lock().map_err(|error| error.to_string())?;
            let mut lease = state.drag.lock().map_err(|error| error.to_string())?;
            if lease.is_some() {
                return Err("A file drag is already in progress.".into());
            }
            let root = root(app)?;
            let entry = read_record(&root, &drag_id)
                .filter(|entry| entry.expires_at > crate::agents::now_ms())
                .ok_or("That file has expired.")?;
            let path = fs::canonicalize(payload(&root, &entry))
                .map_err(|_| "Could not find the temporary copy.")?;
            let folder = fs::canonicalize(root.join(&entry.id))
                .map_err(|_| "Could not find the temporary copy.")?;
            if !path.starts_with(folder) || !path.is_file() {
                return Err("Could not find the temporary copy.".into());
            }
            *lease = Some(drag_id);
            Ok(path)
        })
        .await
        .map_err(|error| error.to_string())??;
        let target = window.clone();
        let drag_id = id.clone();
        if let Err(error) = window.run_on_main_thread(move || {
            if !crate::placement::mouse_down() {
                release_drag(&target, &drag_id);
                return;
            }
            let callback_window = target.clone();
            let callback_id = drag_id.clone();
            let result = drag::start_drag(
                &target,
                drag::DragItem::Files(vec![path]),
                drag::Image::Raw(include_bytes!("../icons/32x32.png").to_vec()),
                move |_, _| release_drag(&callback_window, &callback_id),
                drag::Options::default(),
            );
            if result.is_err() {
                release_drag(&target, &drag_id);
                let _ = target.emit(
                    "pouch-notice",
                    PouchNotice {
                        added: 0,
                        error: Some("Could not start the file drag.".into()),
                    },
                );
            }
        }) {
            release_drag(&window, &id);
            return Err(error.to_string());
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = id;
        Err("File drag-out is available on macOS and Windows.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_expire_and_extensions_leave_originals_alone() {
        let test = std::env::temp_dir().join(format!("buddy-pouch-{}", std::process::id()));
        let root = test.join("pouch");
        create_root(&root).unwrap();
        let original = test.join("notes.txt");
        fs::write(&original, b"hello").unwrap();
        let root = fs::canonicalize(root).unwrap();
        let mut entry = copy_into(&root, &original, 10, 100).unwrap();
        assert_eq!(fs::read(payload(&root, &entry)).unwrap(), b"hello");
        assert_eq!(entry.expires_at, 100 + DAY_MS);
        assert!(copy_into(&root, &original, 4, 100).is_err());
        assert!(copy_into(&root, &test, 10, 100).is_err());
        assert!(copy_into(&root, &payload(&root, &entry), 10, 100).is_err());
        entry.expires_at += DAY_MS;
        write_record(&root.join(&entry.id), &entry).unwrap();
        assert_eq!(list(&root, 100 + DAY_MS, None).unwrap().len(), 1);
        assert!(
            list(&root, 100 + 2 * DAY_MS, Some(&entry.id))
                .unwrap()
                .is_empty()
        );
        assert!(payload(&root, &entry).exists());
        assert!(list(&root, 100 + 2 * DAY_MS, None).unwrap().is_empty());
        assert!(!payload(&root, &entry).exists());
        assert_eq!(fs::read(&original).unwrap(), b"hello");
        fs::remove_dir_all(test).unwrap();
    }
}
