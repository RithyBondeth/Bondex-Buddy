use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::WebviewWindow;

const LIMIT: u64 = 1_048_576;
const STALE_MS: u64 = 15 * 60_000;
const RETAIN_MS: u64 = 24 * 60 * 60_000;
const MARKER: &str = "--buddy-agent-hook";

#[derive(Default)]
pub struct AgentSetup(Mutex<()>);

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentEvent {
    agent: String,
    session: String,
    project: String,
    status: String,
    activity: String,
    updated_at: u64,
}

fn valid_agent(agent: &str) -> Result<(), String> {
    if !matches!(agent, "codex" | "claude") {
        return Err("Unknown agent".into());
    }
    Ok(())
}

fn events(agent: &str) -> &'static [&'static str] {
    if agent == "codex" {
        &[
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PermissionRequest",
            "Stop",
            "SessionEnd",
            "Interrupt",
        ]
    } else {
        &[
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PermissionRequest",
            "Notification",
            "Stop",
            "StopFailure",
            "SessionEnd",
        ]
    }
}

fn config_path(agent: &str) -> Result<PathBuf, String> {
    valid_agent(agent)?;
    let home = dirs::home_dir().ok_or("Home folder unavailable")?;
    let (variable, default, name) = if agent == "codex" {
        ("CODEX_HOME", ".codex", "hooks.json")
    } else {
        ("CLAUDE_CONFIG_DIR", ".claude", "settings.json")
    };
    let directory = std::env::var_os(variable)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(default));
    if !directory.is_absolute() {
        return Err("Agent configuration folder must be absolute".into());
    }
    Ok(directory.join(name))
}

fn bounded_read(path: &Path) -> Result<Vec<u8>, String> {
    let mut raw = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(LIMIT + 1)
        .read_to_end(&mut raw)
        .map_err(|e| e.to_string())?;
    if raw.len() as u64 > LIMIT {
        return Err("Agent file exceeds size limit".into());
    }
    Ok(raw)
}

fn read_config(path: &Path) -> Result<(Vec<u8>, Value), String> {
    let raw = if path.exists() {
        bounded_read(path)?
    } else {
        Vec::new()
    };
    let value = if raw.is_empty() && !path.exists() {
        json!({})
    } else {
        serde_json::from_slice(&raw).map_err(|_| {
            "Agent settings are not valid JSON; the file was left unchanged".to_string()
        })?
    };
    if !value.is_object() || value.get("hooks").is_some_and(|v| !v.is_object()) {
        return Err("Agent hooks have an unsupported format; the file was left unchanged".into());
    }
    Ok((raw, value))
}

fn hook_command(agent: &str) -> Result<String, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let raw = executable
        .to_str()
        .ok_or("Application path is not valid text")?;
    // Codex uses the user's shell (PowerShell by default on Windows). Claude's
    // Windows hook explicitly selects PowerShell to avoid Git Bash differences.
    #[cfg(windows)]
    return Ok(format!(
        "& '{}' {MARKER} {agent}",
        raw.replace('\\', "/").replace('\'', "''")
    ));
    #[cfg(not(windows))]
    Ok(format!("'{}' {MARKER} {agent}", raw.replace('\'', "'\\''")))
}

fn ours(hook: &Value) -> bool {
    hook.get("command")
        .and_then(Value::as_str)
        .is_some_and(|command| command.contains(&format!(" {MARKER} ")))
}

fn edit_hooks(value: &mut Value, agent: &str, command: &str, install: bool) -> Result<(), String> {
    let hooks = value
        .as_object_mut()
        .ok_or("Settings must be an object")?
        .entry("hooks")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Hooks must be an object")?;
    for groups in hooks.values_mut() {
        let groups = groups.as_array_mut().ok_or("Hook groups must be arrays")?;
        for group in groups.iter_mut() {
            let entries = group
                .get_mut("hooks")
                .and_then(Value::as_array_mut)
                .ok_or("Hook entries must be arrays")?;
            entries.retain(|hook| !ours(hook));
        }
        groups.retain(|group| group["hooks"].as_array().is_some_and(|a| !a.is_empty()));
    }
    if install {
        for event in events(agent) {
            let groups = hooks
                .entry(*event)
                .or_insert_with(|| json!([]))
                .as_array_mut()
                .ok_or("Hook groups must be arrays")?;
            let mut hook = json!({"type":"command", "command":command, "timeout":2});
            if agent == "claude" {
                hook["onFailure"] = json!("continue");
                #[cfg(windows)]
                {
                    hook["shell"] = json!("powershell");
                }
            }
            groups.push(json!({"hooks":[hook]}));
        }
    }
    Ok(())
}

fn installed(value: &Value, agent: &str, command: &str) -> bool {
    events(agent).iter().all(|event| {
        value["hooks"][*event].as_array().is_some_and(|groups| {
            groups.iter().any(|group| {
                group["hooks"].as_array().is_some_and(|hooks| {
                    hooks
                        .iter()
                        .any(|hook| hook["command"] == command && hook["type"] == "command")
                })
            })
        })
    })
}

fn clean_label(raw: &str, max: usize) -> String {
    raw.chars().filter(|c| !c.is_control()).take(max).collect()
}

fn parse_event(agent: &str, raw: &[u8], now: u64) -> Option<AgentEvent> {
    valid_agent(agent).ok()?;
    let value: Value = serde_json::from_slice(raw).ok()?;
    let event = value["hook_event_name"].as_str()?;
    let session = value["session_id"].as_str()?;
    if session.is_empty()
        || session.len() > 100
        || !session
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
    {
        return None;
    }
    let tool = value["tool_name"].as_str().unwrap_or("");
    let asks = ["AskUserQuestion", "ExitPlanMode", "request_user_input"]
        .iter()
        .any(|name| tool.ends_with(name));
    let (status, activity) = match event {
        "SessionStart" => ("idle", "Session started".into()),
        "UserPromptSubmit" => ("working", "Thinking through your request".into()),
        "PermissionRequest" => ("needsInput", "Waiting for permission".into()),
        "PreToolUse" if asks => ("needsInput", "Waiting for your answer".into()),
        "PreToolUse" | "PostToolUse" => (
            "working",
            if tool.is_empty() {
                "Working on your request".into()
            } else {
                format!("Using {}", clean_label(tool, 60))
            },
        ),
        "Notification"
            if matches!(
                value["notification_type"].as_str(),
                Some("permission_prompt" | "idle_prompt" | "elicitation_dialog")
            ) =>
        {
            ("needsInput", "Waiting for your input".into())
        }
        "Stop" => ("done", "Response ready".into()),
        "StopFailure" => ("error", "Turn ended with an error".into()),
        "Interrupt" => ("idle", "Turn interrupted".into()),
        "SessionEnd" => ("idle", "Session ended".into()),
        _ => return None,
    };
    // Only a project label and lifecycle information are retained. Never inspect transcripts,
    // prompt text, tool arguments, permission details, or model output.
    let project = value["cwd"]
        .as_str()
        .and_then(|cwd| cwd.trim_end_matches(['/', '\\']).rsplit(['/', '\\']).next())
        .map(|s| clean_label(s, 80))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Local session".into());
    Some(AgentEvent {
        agent: agent.into(),
        session: session.into(),
        project,
        status: status.into(),
        activity,
        updated_at: now,
    })
}

fn data_dir() -> Result<PathBuf, String> {
    Ok(dirs::data_dir()
        .ok_or("App data folder unavailable")?
        .join("com.bondexbuddy.tinydeskspirit")
        .join("agent-events"))
}

/// Called before Tauri initializes, so agent hooks never launch or reveal the pet.
pub fn handle_hook_cli() -> bool {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some(MARKER) {
        return false;
    }
    // Observation must never block an agent or emit a hook decision/context.
    let _ = (|| -> Result<(), String> {
        let received_at = now_ms();
        let agent = args.get(2).ok_or("Missing agent")?;
        let mut raw = Vec::new();
        std::io::stdin()
            .take(LIMIT + 1)
            .read_to_end(&mut raw)
            .map_err(|e| e.to_string())?;
        if raw.len() as u64 > LIMIT {
            return Ok(());
        }
        if let Some(event) = parse_event(agent, &raw, received_at) {
            write_event(&data_dir()?, &event)?;
        }
        Ok(())
    })();
    true
}

fn event_lock(folder: &Path) -> Result<fs::File, String> {
    fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .read(true)
        .open(folder.join(".events.lock"))
        .map_err(|e| e.to_string())
}

fn write_event(folder: &Path, event: &AgentEvent) -> Result<(), String> {
    let lock = event_lock(folder)?;
    lock.lock().map_err(|e| e.to_string())?;
    let path = folder.join(format!("{}-{}.json", event.agent, event.session));
    // A late-finishing older hook must not replace a newer event.
    if let Ok(previous) = bounded_read(&path)
        && let Ok(previous) = serde_json::from_slice::<AgentEvent>(&previous)
        && previous.updated_at > event.updated_at
    {
        return Ok(());
    }
    crate::clipboard::private_write(
        &path,
        &serde_json::to_vec(event).map_err(|e| e.to_string())?,
    )
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    agent: String,
    installed: bool,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    connections: Vec<Connection>,
    sessions: Vec<AgentEvent>,
}

fn sessions(folder: &Path, now: u64) -> Vec<AgentEvent> {
    let mut result = Vec::new();
    if let Ok(files) = fs::read_dir(folder) {
        for file in files.flatten() {
            let path = file.path();
            if path.extension().and_then(|v| v.to_str()) != Some("json") {
                continue;
            }
            if file.metadata().is_ok_and(|metadata| metadata.len() > 8192) {
                continue;
            }
            if let Ok(raw) = bounded_read(&path)
                && let Ok(mut event) = serde_json::from_slice::<AgentEvent>(&raw)
                && valid_agent(&event.agent).is_ok()
                && event.project.len() <= 400
                && event.activity.len() <= 400
                && event.updated_at <= now + 30_000
            {
                if now.saturating_sub(event.updated_at) > RETAIN_MS {
                    expire_record(&path, now);
                    continue;
                }
                if now.saturating_sub(event.updated_at) > STALE_MS
                    && matches!(event.status.as_str(), "working" | "needsInput")
                {
                    event.status = "stale".into();
                    event.activity = "No recent signal · check the agent".into();
                }
                if matches!(
                    event.status.as_str(),
                    "working" | "needsInput" | "done" | "idle" | "error" | "stale"
                ) {
                    result.push(event);
                }
            }
        }
    }
    result.sort_by_key(|event| std::cmp::Reverse(event.updated_at));
    result
}

fn connected_sessions(folder: &Path, now: u64, connected: &[&str]) -> Vec<AgentEvent> {
    sessions(folder, now)
        .into_iter()
        .filter(|event| connected.contains(&event.agent.as_str()))
        .collect()
}

fn expire_record(path: &Path, now: u64) {
    // Coordinate cleanup with hook writers, and recheck after acquiring the lock.
    // One fixed lock covers all sessions, so session identifiers expire with their records.
    if let Some(folder) = path.parent()
        && let Ok(lock) = event_lock(folder)
        && lock.try_lock().is_ok()
        && let Ok(raw) = bounded_read(path)
        && let Ok(event) = serde_json::from_slice::<AgentEvent>(&raw)
        && now.saturating_sub(event.updated_at) > RETAIN_MS
    {
        let _ = fs::remove_file(path);
    }
}

fn connections() -> Vec<Connection> {
    let mut connections = Vec::new();
    for agent in ["codex", "claude"] {
        let result = config_path(agent)
            .and_then(|path| read_config(&path))
            .and_then(|(_, value)| Ok(installed(&value, agent, &hook_command(agent)?)));
        connections.push(match result {
            Ok(installed) => Connection {
                agent: agent.into(),
                installed,
                error: None,
            },
            Err(error) => Connection {
                agent: agent.into(),
                installed: false,
                error: Some(error),
            },
        });
    }
    connections
}

#[tauri::command]
pub fn agent_connections(
    window: WebviewWindow,
    state: tauri::State<'_, AgentSetup>,
) -> Result<Vec<Connection>, String> {
    crate::settings::require_settings(&window)?;
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(connections())
}

#[tauri::command]
pub fn agent_snapshot(
    window: WebviewWindow,
    state: tauri::State<'_, AgentSetup>,
) -> Result<Snapshot, String> {
    crate::panel::require_panel(&window)?;
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    let connections = connections();
    let connected: Vec<_> = connections
        .iter()
        .filter(|connection| connection.installed)
        .map(|connection| connection.agent.as_str())
        .collect();
    let mut sessions = connected_sessions(&data_dir()?, now_ms(), &connected);
    sessions.truncate(40);
    Ok(Snapshot {
        connections,
        sessions,
    })
}

#[tauri::command]
pub fn agent_connect(
    window: WebviewWindow,
    state: tauri::State<'_, AgentSetup>,
    agent: String,
    connect: bool,
) -> Result<(), String> {
    crate::settings::require_settings(&window)?;
    let _guard = state.0.lock().map_err(|e| e.to_string())?;
    let path = config_path(&agent)?;
    update_config(&path, &agent, &hook_command(&agent)?, connect)
}

fn update_config(path: &Path, agent: &str, command: &str, connect: bool) -> Result<(), String> {
    // Replace the actual managed file, preserving a dotfile manager's symlink.
    let target = match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => fs::canonicalize(path)
            .map_err(|e| format!("Could not resolve the agent settings link: {e}"))?,
        Ok(_) => path.to_path_buf(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => path.to_path_buf(),
        Err(error) => return Err(error.to_string()),
    };
    let path = target.as_path();
    let existed = path.exists();
    if !existed && !connect {
        return Ok(());
    }
    let (previous, mut value) = read_config(path)?;
    edit_hooks(&mut value, agent, command, connect)?;
    let updated = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
    if updated.len() as u64 > LIMIT {
        return Err(
            "Updated agent settings exceed 1 MiB; the existing file was left unchanged".into(),
        );
    }
    if existed {
        let backup = path.with_file_name(format!(
            "{}.buddy-backup-{}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        crate::clipboard::private_write(&backup, &previous)?;
        if bounded_read(path)? != previous {
            return Err("Agent settings changed during setup. Please retry.".into());
        }
    } else if path.exists() {
        return Err("Agent settings changed during setup. Please retry.".into());
    }
    crate::clipboard::private_write(path, &updated)
}

#[tauri::command]
pub fn agent_cue(window: WebviewWindow) -> Result<String, String> {
    if window.label() != "main" {
        return Err("Only Ember can read the status cue".into());
    }
    let connected: Vec<_> = ["codex", "claude"]
        .into_iter()
        .filter(|agent| {
            config_path(agent)
                .and_then(|path| read_config(&path))
                .and_then(|(_, value)| Ok(installed(&value, agent, &hook_command(agent)?)))
                .unwrap_or(false)
        })
        .collect();
    let now = now_ms();
    let events = connected_sessions(&data_dir()?, now, &connected);
    Ok(cue_for(&events, now).into())
}

fn cue_for(events: &[AgentEvent], now: u64) -> &'static str {
    for status in ["needsInput", "working", "error", "done"] {
        if events
            .iter()
            .any(|event| event.status == status && now.saturating_sub(event.updated_at) < STALE_MS)
        {
            return status;
        }
    }
    "idle"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_retains_only_status_and_project_basename() {
        let raw = br#"{"hook_event_name":"PreToolUse","session_id":"abc-123","cwd":"/private/project","tool_name":"AskUserQuestion","prompt":"secret","tool_input":{"secret":"private"}}"#;
        let event = parse_event("claude", raw, 42).unwrap();
        assert_eq!(event.status, "needsInput");
        assert_eq!(event.project, "project");
        let saved = serde_json::to_string(&event).unwrap();
        assert!(!saved.contains("secret"));
        assert!(!saved.contains("/private"));
        assert!(
            parse_event(
                "codex",
                br#"{"hook_event_name":"Stop","session_id":"../escape"}"#,
                0
            )
            .is_none()
        );
        assert_eq!(
            parse_event(
                "codex",
                br#"{"hook_event_name":"Stop","session_id":"safe"}"#,
                0
            )
            .unwrap()
            .status,
            "done"
        );
    }

    #[test]
    fn installing_and_removing_preserve_other_hooks_and_settings() {
        let mut value = json!({"permissions":{"allow":["Read"]},"hooks":{"Stop":[{"matcher":"*","hooks":[{"type":"command","command":"existing"}]}]}});
        let original = value.clone();
        let command = "'/app' --buddy-agent-hook codex";
        edit_hooks(&mut value, "codex", command, true).unwrap();
        edit_hooks(&mut value, "codex", command, true).unwrap();
        assert!(installed(&value, "codex", command));
        assert_eq!(value["hooks"]["Stop"].as_array().unwrap().len(), 2);
        assert_eq!(value["permissions"], original["permissions"]);
        edit_hooks(&mut value, "codex", command, false).unwrap();
        assert_eq!(value["hooks"]["Stop"], original["hooks"]["Stop"]);
    }

    #[test]
    fn setup_keeps_a_byte_exact_backup_and_refuses_malformed_settings() {
        let dir = std::env::temp_dir().join(format!("buddy-hook-setup-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        let original = b"{\n  \"permissions\": {\"allow\": [\"Read\"]}\n}\n";
        fs::write(&path, original).unwrap();
        let command = "'/app' --buddy-agent-hook claude";
        update_config(&path, "claude", command, true).unwrap();
        let (_, updated) = read_config(&path).unwrap();
        assert!(installed(&updated, "claude", command));
        assert_eq!(updated["permissions"]["allow"][0], "Read");
        assert!(fs::read_dir(&dir).unwrap().flatten().any(|entry| {
            entry.file_name().to_string_lossy().contains("buddy-backup")
                && fs::read(entry.path()).unwrap() == original
        }));
        fs::write(&path, b"malformed").unwrap();
        assert!(update_config(&path, "claude", command, true).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"malformed");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn setup_never_writes_a_config_larger_than_it_can_read() {
        let dir = std::env::temp_dir().join(format!("buddy-hook-size-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        let original =
            serde_json::to_vec(&json!({"custom": "x".repeat(LIMIT as usize - 64)})).unwrap();
        fs::write(&path, &original).unwrap();
        assert!(read_config(&path).is_ok());
        assert!(update_config(&path, "claude", "'/app' --buddy-agent-hook claude", true).is_err());
        assert_eq!(fs::read(&path).unwrap(), original);
        assert!(read_config(&path).is_ok());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn multiple_sessions_stale_signals_and_expiry_are_explicit() {
        let dir = std::env::temp_dir().join(format!("buddy-agents-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for (id, timestamp) in [
            ("one", 1),
            ("two", RETAIN_MS),
            ("three", RETAIN_MS + STALE_MS),
        ] {
            let event = AgentEvent {
                agent: "codex".into(),
                session: id.into(),
                project: "test".into(),
                status: "working".into(),
                activity: "Working".into(),
                updated_at: timestamp,
            };
            fs::write(
                dir.join(format!("{id}.json")),
                serde_json::to_vec(&event).unwrap(),
            )
            .unwrap();
        }
        let result = sessions(&dir, RETAIN_MS + STALE_MS + 1);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].status, "working");
        assert_eq!(result[1].status, "stale");
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn setup_preserves_symlinked_agent_settings() {
        let dir = std::env::temp_dir().join(format!("buddy-hook-symlink-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let managed = dir.join("managed.json");
        let link = dir.join("settings.json");
        fs::write(&managed, br#"{"theme":"dark"}"#).unwrap();
        std::os::unix::fs::symlink(&managed, &link).unwrap();
        let command = "'/app' --buddy-agent-hook claude";
        update_config(&link, "claude", command, true).unwrap();
        assert!(
            fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert!(installed(
            &read_config(&managed).unwrap().1,
            "claude",
            command
        ));
        update_config(&link, "claude", command, false).unwrap();
        assert!(
            fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(read_config(&managed).unwrap().1["theme"], "dark");
        assert!(!installed(
            &read_config(&managed).unwrap().1,
            "claude",
            command
        ));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn disconnected_or_newer_completed_sessions_cannot_hide_a_working_agent() {
        let dir = std::env::temp_dir().join(format!("buddy-connected-{}", std::process::id()));
        let working = AgentEvent {
            agent: "codex".into(),
            session: "active".into(),
            project: "test".into(),
            status: "working".into(),
            activity: "Working".into(),
            updated_at: 1,
        };
        write_event(&dir, &working).unwrap();
        for index in 0..50 {
            let newer = AgentEvent {
                agent: "claude".into(),
                session: format!("done-{index}"),
                status: "done".into(),
                updated_at: index + 2,
                ..working.clone()
            };
            write_event(&dir, &newer).unwrap();
        }
        let connected = connected_sessions(&dir, 60, &["codex"]);
        assert_eq!(connected.len(), 1);
        assert_eq!(cue_for(&connected, 60), "working");
        let all_connected = connected_sessions(&dir, 60, &["codex", "claude"]);
        assert_eq!(all_connected.len(), 51);
        assert_eq!(cue_for(&all_connected, 60), "working");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn expired_session_identifiers_leave_only_one_shared_lock() {
        let dir = std::env::temp_dir().join(format!("buddy-bounded-locks-{}", std::process::id()));
        for index in 0..50 {
            let event = AgentEvent {
                agent: "codex".into(),
                session: format!("session-{index}"),
                project: "test".into(),
                status: "working".into(),
                activity: "Working".into(),
                updated_at: 1,
            };
            write_event(&dir, &event).unwrap();
        }
        assert!(sessions(&dir, RETAIN_MS + 2).is_empty());
        let files: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|file| file.file_name())
            .collect();
        assert_eq!(files, vec![std::ffi::OsString::from(".events.lock")]);
        fs::remove_dir_all(dir).unwrap();
    }
}
