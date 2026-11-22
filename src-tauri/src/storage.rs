use std::{fs, io::Read, path::Path, sync::Mutex};
use tauri::Manager;

#[derive(Default)]
pub struct ProgressStorage(Mutex<()>);
const LIMIT: u64 = 65_536;

fn read(path: &Path) -> Result<Option<String>, String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let mut raw = String::new();
    file.take(LIMIT + 1)
        .read_to_string(&mut raw)
        .map_err(|e| e.to_string())?;
    if raw.len() as u64 > LIMIT {
        return Err("Progress exceeds size limit".into());
    }
    Ok(Some(raw))
}

fn valid(raw: &str) -> Result<(), String> {
    if raw.len() as u64 > LIMIT {
        return Err("Progress exceeds size limit".into());
    }
    let value: serde_json::Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
    if !matches!(value.get("version").and_then(|v| v.as_u64()), Some(1 | 2)) {
        return Err("Unsupported progress version".into());
    }
    Ok(())
}

fn write(path: &Path, raw: &str) -> Result<(), String> {
    valid(raw)?;
    if let Some(previous) = read(path)? {
        valid(&previous)?;
    }
    crate::clipboard::private_write(path, raw.as_bytes())
}

#[tauri::command]
pub fn load_progress(
    app: tauri::AppHandle,
    state: tauri::State<'_, ProgressStorage>,
) -> Result<Option<String>, String> {
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    read(
        &app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("progress.json"),
    )
}

#[tauri::command]
pub fn save_progress(
    app: tauri::AppHandle,
    state: tauri::State<'_, ProgressStorage>,
    data: String,
) -> Result<(), String> {
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    write(
        &app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("progress.json"),
        &data,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replaces_existing_save_and_preserves_unknown_or_invalid_data() {
        let dir =
            std::env::temp_dir().join(format!("tiny-desk-storage-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("progress.json");
        let _ = fs::remove_file(&path);
        assert_eq!(read(&path).unwrap(), None);
        write(&path, "{\"version\":1,\"completedFocusSessions\":1}").unwrap();
        write(&path, "{\"version\":1,\"completedFocusSessions\":3}").unwrap();
        let previous = read(&path).unwrap();
        assert!(write(&path, "broken").is_err());
        assert_eq!(read(&path).unwrap(), previous);
        fs::write(&path, "{\"version\":99}").unwrap();
        assert!(write(&path, "{\"version\":1}").is_err());
        assert_eq!(read(&path).unwrap().unwrap(), "{\"version\":99}");
        fs::remove_dir_all(dir).unwrap();
    }
}
