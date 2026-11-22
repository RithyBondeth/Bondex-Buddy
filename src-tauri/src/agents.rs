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

use crate::agent_usage::{self, OPT_IN_FILE, Tokens, Usage};

const LIMIT: u64 = 1_048_576;
const STALE_MS: u64 = 15 * 60_000;
const RETAIN_MS: u64 = 24 * 60 * 60_000;
const MARKER: &str = "--buddy-agent-hook";
const AGENTS: [&str; 5] = ["codex", "claude", "gemini", "antigravity", "cursor"];
const ANTIGRAVITY_HOOK: &str = "bondex-buddy-observer";

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
    #[serde(default)]
    requests: u32,
    #[serde(default)]
    turn_started_at: Option<u64>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Usage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_model_sample: Option<Tokens>,
}

fn events(agent: &str) -> &'static [&'static str] {
    match agent {
        "codex" => &[
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PermissionRequest",
            "Stop",
            "SessionEnd",
            "Interrupt",
        ],
        "claude" => &[
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PermissionRequest",
            "Notification",
            "Stop",
            "StopFailure",
            "SessionEnd",
        ],
        "gemini" => &[
            "SessionStart",
            "BeforeAgent",
            "BeforeTool",
            "AfterTool",
            "BeforeModel",
            "AfterModel",
            "AfterAgent",
            "Notification",
            "SessionEnd",
        ],
        "antigravity" => &[
            "SessionStart",
            "PreInvocation",
            "PostInvocation",
            "PreToolUse",
            "PostToolUse",
            "Stop",
        ],
        "cursor" => &[
            "sessionStart",
            "beforeSubmitPrompt",
            "postToolUse",
            "postToolUseFailure",
            "afterAgentThought",
            "stop",
            "sessionEnd",
        ],
        _ => &[],
    }
}

fn config_path(agent: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Home folder unavailable")?;
    let (variable, default, name) = match agent {
        "codex" => (Some("CODEX_HOME"), ".codex", "hooks.json"),
        "claude" => (Some("CLAUDE_CONFIG_DIR"), ".claude", "settings.json"),
        "gemini" => (Some("GEMINI_CLI_HOME"), "", ".gemini/settings.json"),
        "antigravity" => (None, ".gemini/config", "hooks.json"),
        "cursor" => (None, ".cursor", "hooks.json"),
        _ => return Err("Unknown agent".into()),
    };
    let directory = variable
        .and_then(std::env::var_os)
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
    if !value.is_object() {
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

fn ours(hook: &Value, agent: &str) -> bool {
    hook["command"].as_str().is_some_and(|command| {
        command
            .rsplit_once(&format!(" {MARKER} "))
            .is_some_and(|(_, arguments)| arguments.split_whitespace().next() == Some(agent))
    })
}

fn nested_hooks(agent: &str, event: &str) -> bool {
    match agent {
        "cursor" => false,
        "antigravity" => matches!(event, "PreToolUse" | "PostToolUse"),
        _ => true,
    }
}

fn event_command(command: &str, agent: &str, event: &str) -> String {
    if matches!(agent, "antigravity" | "cursor") {
        format!("{command} {event}")
    } else {
        command.into()
    }
}

fn remaining_hooks(entries: &mut Vec<Value>, agent: &str, event: &str) -> Result<(), String> {
    if nested_hooks(agent, event) {
        for group in entries.iter_mut() {
            let hooks = group
                .get_mut("hooks")
                .and_then(Value::as_array_mut)
                .ok_or("Hook entries must be arrays")?;
            hooks.retain(|hook| !ours(hook, agent));
        }
        entries.retain(|group| {
            group["hooks"]
                .as_array()
                .is_some_and(|hooks| !hooks.is_empty())
        });
    } else {
        entries.retain(|hook| !ours(hook, agent));
    }
    Ok(())
}

fn edit_hooks(value: &mut Value, agent: &str, command: &str, install: bool) -> Result<(), String> {
    let root = value.as_object_mut().ok_or("Settings must be an object")?;
    if agent == "cursor" && install {
        root.entry("version").or_insert_with(|| json!(1));
    }
    let key = if agent == "antigravity" {
        ANTIGRAVITY_HOOK
    } else {
        "hooks"
    };
    if !install && !root.contains_key(key) {
        return Ok(());
    }
    let hooks = root
        .entry(key)
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Hooks must be an object")?;
    for event in events(agent) {
        if let Some(entries) = hooks.get_mut(*event) {
            remaining_hooks(
                entries.as_array_mut().ok_or("Hook groups must be arrays")?,
                agent,
                event,
            )?;
        }
        if install {
            let timeout = if agent == "gemini" { 2000 } else { 2 };
            let mut hook = json!({"type":"command", "command":event_command(command, agent, event), "timeout":timeout});
            if agent == "gemini" {
                hook["name"] = json!(format!("Bondex Buddy ({event})"));
            }
            if agent == "claude" {
                hook["onFailure"] = json!("continue");
                #[cfg(windows)]
                {
                    hook["shell"] = json!("powershell");
                }
            }
            let entry = if nested_hooks(agent, event) {
                json!({"hooks":[hook]})
            } else {
                hook
            };
            hooks
                .entry(*event)
                .or_insert_with(|| json!([]))
                .as_array_mut()
                .ok_or("Hook groups must be arrays")?
                .push(entry);
        } else if hooks
            .get(*event)
            .and_then(Value::as_array)
            .is_some_and(Vec::is_empty)
        {
            hooks.remove(*event);
        }
    }
    if agent == "antigravity" && hooks.is_empty() {
        root.remove(key);
    }
    Ok(())
}

fn installed(value: &Value, agent: &str, command: &str) -> bool {
    let key = if agent == "antigravity" {
        ANTIGRAVITY_HOOK
    } else {
        "hooks"
    };
    let hooks = &value[key];
    if hooks["enabled"].as_bool() == Some(false)
        || value["hooksConfig"]["enabled"].as_bool() == Some(false)
    {
        return false;
    }
    // Existing connections keep working when a new optional telemetry hook is added.
    let required: &[&str] = match agent {
        "codex" | "claude" => &["UserPromptSubmit", "Stop"],
        "gemini" => &["BeforeAgent", "AfterAgent"],
        "antigravity" => &["PreInvocation", "Stop"],
        "cursor" => &["beforeSubmitPrompt", "stop"],
        _ => return false,
    };
    required.iter().all(|event| {
        let command = event_command(command, agent, event);
        let matches = |hook: &Value| hook["command"] == command && hook["type"] == "command";
        hooks[*event].as_array().is_some_and(|entries| {
            entries.iter().any(|entry| {
                if nested_hooks(agent, event) {
                    entry["hooks"]
                        .as_array()
                        .is_some_and(|entries| entries.iter().any(matches))
                } else {
                    matches(entry)
                }
            })
        })
    })
}

fn clean_label(raw: &str, max: usize) -> String {
    raw.chars().filter(|c| !c.is_control()).take(max).collect()
}

fn valid_session(session: &str) -> bool {
    !session.is_empty()
        && session.len() <= 100
        && session
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

#[cfg(test)]
fn parse_event(agent: &str, raw: &[u8], now: u64) -> Option<AgentEvent> {
    parse_signal(agent, &serde_json::from_slice(raw).ok()?, None, now)
}

fn parse_signal(
    agent: &str,
    value: &Value,
    explicit_event: Option<&str>,
    now: u64,
) -> Option<AgentEvent> {
    let event = if agent == "antigravity" {
        explicit_event?
    } else {
        value["hook_event_name"].as_str()?
    };
    if !events(agent).contains(&event) {
        return None;
    }
    let session = match agent {
        "cursor" => value["conversation_id"].as_str(),
        "antigravity" => value["conversationId"].as_str(),
        _ => value["session_id"].as_str(),
    }?;
    if !valid_session(session) {
        return None;
    }
    let tool = value["tool_name"]
        .as_str()
        .or_else(|| value["toolCall"]["name"].as_str())
        .unwrap_or("");
    let asks = [
        "AskUserQuestion",
        "ExitPlanMode",
        "request_user_input",
        "ask_user",
        "ask_user_question",
    ]
    .iter()
    .any(|name| tool.ends_with(name));
    let before_tool = matches!(event, "PreToolUse" | "BeforeTool" | "preToolUse");
    let after_tool = matches!(
        event,
        "PostToolUse" | "AfterTool" | "postToolUse" | "postToolUseFailure"
    );
    let before_model = matches!(event, "BeforeModel" | "PreInvocation");
    let request = matches!(
        event,
        "UserPromptSubmit" | "BeforeAgent" | "beforeSubmitPrompt"
    );
    let chunk = if event == "AfterModel" {
        // Gemini streams a hook per chunk. Only usage-bearing chunks need a write.
        Some(agent_usage::gemini_tokens(value)?)
    } else {
        None
    };
    let error = matches!(event, "StopFailure")
        || (event == "stop" && value["status"] == "error")
        || (agent == "antigravity"
            && event == "Stop"
            && matches!(
                value["terminationReason"].as_str(),
                Some("error" | "max_steps_exceeded")
            ));
    let aborted = event == "stop" && value["status"] == "aborted";
    let (status, activity) = match event {
        "SessionStart" | "sessionStart" => ("idle", "Session started".into()),
        _ if request => ("working", "Thinking through your request".into()),
        "PermissionRequest" => ("needsInput", "Waiting for permission".into()),
        "Notification"
            if matches!(
                value["notification_type"].as_str(),
                Some("permission_prompt" | "idle_prompt" | "elicitation_dialog" | "ToolPermission")
            ) =>
        {
            ("needsInput", "Waiting for your input".into())
        }
        _ if before_tool && asks => ("needsInput", "Waiting for your answer".into()),
        _ if before_tool || after_tool => (
            "working",
            if tool.trim().is_empty() {
                "Using a tool".into()
            } else {
                format!("Using {}", clean_label(tool, 60))
            },
        ),
        _ if before_model
            || chunk.is_some()
            || matches!(event, "PostInvocation" | "afterAgentThought") =>
        {
            ("working", "Working with the model".into())
        }
        _ if error => ("error", "Turn ended with an error".into()),
        _ if aborted => ("idle", "Turn interrupted".into()),
        "Stop" if agent == "antigravity" && value["fullyIdle"].as_bool() == Some(false) => {
            ("working", "Finishing background tasks".into())
        }
        "Stop" | "stop" | "AfterAgent" => ("done", "Response ready".into()),
        "Interrupt" => ("idle", "Turn interrupted".into()),
        "SessionEnd" | "sessionEnd" => ("idle", "Session ended".into()),
        _ => return None,
    };
    let roots = match agent {
        "cursor" => &value["workspace_roots"],
        "antigravity" => &value["workspacePaths"],
        _ => &Value::Null,
    };
    let project = roots[0]
        .as_str()
        .or_else(|| value["cwd"].as_str())
        .and_then(|cwd| cwd.trim_end_matches(['/', '\\']).rsplit(['/', '\\']).next())
        .map(|s| clean_label(s, 80))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Local session".into());
    let model = value["model_id"]
        .as_str()
        .or_else(|| value["model"].as_str())
        .or_else(|| value["modelName"].as_str())
        .or_else(|| value["llm_request"]["model"].as_str())
        .map(|model| clean_label(model, 80))
        .filter(|model| !model.trim().is_empty());
    Some(AgentEvent {
        agent: agent.into(),
        session: session.into(),
        project,
        status: status.into(),
        activity,
        updated_at: now,
        requests: u32::from(request),
        turn_started_at: matches!(status, "working" | "needsInput").then_some(now),
        model,
        usage: Usage {
            tool_calls: u32::from(before_tool || (agent == "cursor" && after_tool)),
            tool_failures: u32::from(event == "postToolUseFailure"),
            model_calls: u32::from(before_model),
            thinking_ms: if event == "afterAgentThought" {
                value["duration_ms"].as_u64().unwrap_or(0)
            } else {
                0
            },
            ..Usage::default()
        },
        last_model_sample: chunk,
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
    // Give providers with a JSON output contract their neutral response.
    let agent = args.get(2).map(String::as_str).unwrap_or("");
    let explicit = args.get(3).map(String::as_str);
    match (agent, explicit) {
        ("antigravity", Some("Stop")) => println!(r#"{{"decision":"stop"}}"#),
        ("cursor", Some("beforeSubmitPrompt")) => println!(r#"{{"continue":true}}"#),
        ("antigravity" | "cursor" | "gemini", _) => println!("{{}}"),
        _ => {}
    }
    let _ = (|| -> Result<(), String> {
        let received_at = now_ms();
        let mut raw = Vec::new();
        std::io::stdin()
            .take(LIMIT + 1)
            .read_to_end(&mut raw)
            .map_err(|e| e.to_string())?;
        if raw.len() as u64 > LIMIT {
            return Ok(());
        }
        let value: Value = serde_json::from_slice(&raw).map_err(|error| error.to_string())?;
        if let Some(mut event) = parse_signal(agent, &value, explicit, received_at) {
            let folder = data_dir()?;
            if matches!(agent, "codex" | "claude")
                && matches!(
                    value["hook_event_name"].as_str(),
                    Some("UserPromptSubmit" | "PostToolUse" | "Stop")
                )
                && agent_usage::is_enabled(&folder)
                && let Some(path) = value["transcript_path"].as_str()
                && let Some(config) = config_path(agent)?.parent()
                && let Some((tokens, partial)) = agent_usage::log_tokens(
                    agent,
                    &config.join(if agent == "codex" {
                        "sessions"
                    } else {
                        "projects"
                    }),
                    Path::new(path),
                    &event.session,
                )
            {
                event.usage.tokens = Some(tokens);
                event.usage.recent_tokens_only = partial;
                event.usage.token_signal_at = Some(received_at);
            }
            write_event(&folder, event)?;
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

fn write_event(folder: &Path, mut event: AgentEvent) -> Result<(), String> {
    let lock = event_lock(folder)?;
    lock.lock().map_err(|e| e.to_string())?;
    let path = folder.join(format!("{}-{}.json", event.agent, event.session));
    // A late-finishing older hook must not replace a newer event.
    let mut previous_sample = None;
    if let Ok(raw) = bounded_read(&path)
        && let Ok(previous) = serde_json::from_slice::<AgentEvent>(&raw)
    {
        if previous.updated_at > event.updated_at {
            return Ok(());
        }
        if event.updated_at - previous.updated_at <= RETAIN_MS {
            let new_request = event.requests > 0;
            if event.usage.model_calls == 0 && !new_request {
                previous_sample = previous.last_model_sample;
            }
            event.usage.tool_calls = event
                .usage
                .tool_calls
                .saturating_add(previous.usage.tool_calls);
            event.usage.tool_failures = event
                .usage
                .tool_failures
                .saturating_add(previous.usage.tool_failures);
            event.usage.model_calls = event
                .usage
                .model_calls
                .saturating_add(previous.usage.model_calls);
            event.usage.thinking_ms = event
                .usage
                .thinking_ms
                .saturating_add(previous.usage.thinking_ms);
            if event.usage.tokens.is_none() {
                event.usage.tokens = previous.usage.tokens;
                event.usage.recent_tokens_only = previous.usage.recent_tokens_only;
                event.usage.token_signal_at = previous.usage.token_signal_at;
            }
            if event.project == "Local session" {
                event.project = previous.project;
            }
            if event.activity == "Session started"
                && matches!(previous.status.as_str(), "working" | "needsInput")
            {
                event.status = previous.status.clone();
                event.activity = previous.activity;
            }
            event.requests = previous.requests.saturating_add(event.requests);
            event.model = event.model.or(previous.model);
            if !new_request
                && event.status != "idle"
                && (matches!(previous.status.as_str(), "working" | "needsInput")
                    || previous.status == event.status)
            {
                event.turn_started_at = previous.turn_started_at.or(event.turn_started_at);
            }
        }
    }
    if let Some(sample) = event.last_model_sample {
        let new_sample = previous_sample.map_or(sample, |prior| prior.max(sample));
        let delta = previous_sample.map_or(sample, |prior| new_sample.delta(prior));
        event.usage.tokens = Some(event.usage.tokens.map_or(delta, |total| total.add(delta)));
        event.last_model_sample = Some(new_sample);
        event.usage.token_signal_at = Some(event.updated_at);
    } else {
        event.last_model_sample = previous_sample;
    }
    crate::clipboard::private_write(
        &path,
        &serde_json::to_vec(&event).map_err(|e| e.to_string())?,
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
    cue: Option<AgentEvent>,
    handoffs: Vec<AgentEvent>,
    usage: Vec<ProviderUsage>,
    token_usage_enabled: bool,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderUsage {
    agent: String,
    sessions: usize,
    requests: u32,
    tool_calls: u32,
    tool_failures: u32,
    model_calls: u32,
    thinking_ms: u64,
    latest_tokens: Option<Tokens>,
    recent_tokens_only: bool,
    token_signal_at: Option<u64>,
}

fn summarize_usage(agent: &str, sessions: &[AgentEvent]) -> ProviderUsage {
    let mut usage = ProviderUsage {
        agent: agent.into(),
        ..ProviderUsage::default()
    };
    for session in sessions.iter().filter(|session| session.agent == agent) {
        usage.sessions += 1;
        usage.requests = usage.requests.saturating_add(session.requests);
        usage.tool_calls = usage.tool_calls.saturating_add(session.usage.tool_calls);
        usage.tool_failures = usage
            .tool_failures
            .saturating_add(session.usage.tool_failures);
        usage.model_calls = usage.model_calls.saturating_add(session.usage.model_calls);
        usage.thinking_ms = usage.thinking_ms.saturating_add(session.usage.thinking_ms);
        if session.usage.tokens.is_some()
            && (usage.latest_tokens.is_none()
                || session.usage.token_signal_at > usage.token_signal_at)
        {
            usage.latest_tokens = session.usage.tokens;
            usage.recent_tokens_only = session.usage.recent_tokens_only;
            usage.token_signal_at = session.usage.token_signal_at;
        }
    }
    usage
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
                && AGENTS.contains(&event.agent.as_str())
                && event.project.len() <= 400
                && event.activity.len() <= 400
                && event.updated_at <= now + 30_000
            {
                if now.saturating_sub(event.updated_at) > RETAIN_MS {
                    expire_record(&path, now);
                    continue;
                }
                if now.saturating_sub(event.updated_at) >= STALE_MS
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
    for agent in AGENTS {
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
    let now = now_ms();
    let folder = data_dir()?;
    let token_usage_enabled = agent_usage::is_enabled(&folder);
    let mut sessions = connected_sessions(&folder, now, &connected);
    if !token_usage_enabled {
        for event in sessions
            .iter_mut()
            .filter(|event| matches!(event.agent.as_str(), "codex" | "claude"))
        {
            event.usage.tokens = None;
        }
    }
    let usage = connected
        .iter()
        .map(|agent| summarize_usage(agent, &sessions))
        .collect();
    let handoffs = recent_handoffs(&sessions, now);
    let (sessions, cue) = current_work(sessions, now);
    Ok(Snapshot {
        connections,
        sessions,
        cue,
        handoffs,
        usage,
        token_usage_enabled,
    })
}

fn is_handoff(event: &AgentEvent, now: u64) -> bool {
    matches!(event.status.as_str(), "needsInput" | "done")
        && now.saturating_sub(event.updated_at) < STALE_MS
}

fn recent_handoffs(sessions: &[AgentEvent], now: u64) -> Vec<AgentEvent> {
    let mut signals: Vec<_> = sessions
        .iter()
        .filter(|event| is_handoff(event, now))
        .collect();
    signals.sort_by_key(|event| event.status == "done");
    signals.into_iter().take(12).cloned().collect()
}

#[tauri::command]
pub fn agent_handoff(
    window: WebviewWindow,
    state: tauri::State<'_, crate::clipboard::ClipboardState>,
    agent: String,
    session: String,
) -> Result<&'static str, String> {
    crate::panel::require_panel(&window)?;
    let valid_id = valid_session(&session)
        && session
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphanumeric);
    if !AGENTS.contains(&agent.as_str()) || !valid_id {
        return Err("Invalid agent session".into());
    }
    let (_, settings) = read_config(&config_path(&agent)?)?;
    if !installed(&settings, &agent, &hook_command(&agent)?) {
        return Err("Connect the agent in Settings first.".into());
    }
    let raw = bounded_read(&data_dir()?.join(format!("{agent}-{session}.json")))
        .map_err(|_| "This handoff has expired.")?;
    let record: AgentEvent = serde_json::from_slice(&raw).map_err(|_| "Invalid agent signal")?;
    if record.agent != agent || record.session != session || !is_handoff(&record, now_ms()) {
        return Err("This handoff has changed. Check the agent again.".into());
    }
    if agent == "codex" && open_codex_session(&session) {
        return Ok("opened");
    }
    let command = match agent.as_str() {
        "codex" => "codex resume",
        "claude" => "claude --resume",
        "gemini" => "gemini --resume",
        "antigravity" => "agy --conversation",
        _ => {
            crate::clipboard::copy_handoff(&window, &state, session)?;
            return Ok("copiedSession");
        }
    };
    crate::clipboard::copy_handoff(&window, &state, format!("{command} {session}"))?;
    Ok("copiedCommand")
}

fn open_codex_session(session: &str) -> bool {
    let url = format!("codex://threads/{session}");
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("/usr/bin/open")
        .arg(&url)
        .status();
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new(
        std::env::var_os("SystemRoot")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
            .join("System32")
            .join("rundll32.exe"),
    )
    .args(["url.dll,FileProtocolHandler", &url])
    .status();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let status: std::io::Result<std::process::ExitStatus> = Err(std::io::Error::other(url));
    status.is_ok_and(|exit| exit.success())
}

fn current_work(mut sessions: Vec<AgentEvent>, now: u64) -> (Vec<AgentEvent>, Option<AgentEvent>) {
    sessions.sort_by_key(|event| cue_priority(event, now));
    let cue = sessions
        .first()
        .filter(|event| cue_priority(event, now) < 4)
        .cloned();
    sessions.retain(|event| cue_priority(event, now) <= 1);
    sessions.truncate(40);
    (sessions, cue)
}

#[tauri::command]
pub fn agent_token_usage(window: WebviewWindow) -> Result<bool, String> {
    crate::settings::require_settings(&window)?;
    Ok(agent_usage::is_enabled(&data_dir()?))
}

#[tauri::command]
pub fn set_agent_token_usage(
    window: WebviewWindow,
    state: tauri::State<'_, AgentSetup>,
    enabled: bool,
) -> Result<bool, String> {
    crate::settings::require_settings(&window)?;
    let _guard = state.0.lock().map_err(|error| error.to_string())?;
    let path = data_dir()?.join(OPT_IN_FILE);
    if enabled {
        crate::clipboard::private_write(&path, b"enabled")?;
    } else if let Err(error) = fs::remove_file(path)
        && error.kind() != std::io::ErrorKind::NotFound
    {
        return Err(error.to_string());
    }
    Ok(enabled)
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

fn cue_priority(event: &AgentEvent, now: u64) -> usize {
    if now.saturating_sub(event.updated_at) >= STALE_MS {
        return 4;
    }
    match event.status.as_str() {
        "needsInput" => 0,
        "working" => 1,
        "error" => 2,
        "done" => 3,
        _ => 4,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handoffs_keep_fresh_responses_and_prioritize_agent_questions() {
        let event = |name, at| {
            let raw = serde_json::to_vec(&json!({
                "hook_event_name": name,
                "session_id": "sample",
                "cwd": "/workspace/project",
            }))
            .unwrap();
            parse_event("codex", &raw, at).unwrap()
        };
        let now = STALE_MS + 10;
        let events = [
            event("Stop", now),
            event("UserPromptSubmit", now - 1),
            event("PermissionRequest", now - 2),
            event("Stop", 1),
        ];
        let handoffs = recent_handoffs(&events, now);
        assert_eq!(handoffs.len(), 2);
        assert_eq!(handoffs[0].status, "needsInput");
        assert_eq!(handoffs[1].status, "done");
    }

    #[test]
    fn new_integrations_preserve_existing_hooks_and_use_provider_formats() {
        for (agent, original) in [
            (
                "gemini",
                json!({"hooks": {"BeforeAgent": [{"hooks": [{"name": "other", "type": "command", "command": "keep"}]}]}}),
            ),
            (
                "antigravity",
                json!({"formatter": {"PostToolUse": [{"hooks": [{"command": "keep"}]}]}}),
            ),
            (
                "cursor",
                json!({"version": 1, "hooks": {"beforeSubmitPrompt": [{"command": "keep"}]}}),
            ),
        ] {
            let command = format!("'/app' --buddy-agent-hook {agent}");
            let mut value = original.clone();
            edit_hooks(&mut value, agent, &command, true).unwrap();
            let first = value.clone();
            edit_hooks(&mut value, agent, &command, true).unwrap();
            assert_eq!(value, first);
            assert!(installed(&value, agent, &command));
            match agent {
                "gemini" => assert_eq!(
                    value["hooks"]["BeforeModel"][0]["hooks"][0]["timeout"],
                    2000
                ),
                "antigravity" => assert_eq!(
                    value[ANTIGRAVITY_HOOK]["PreInvocation"][0]["command"],
                    format!("{command} PreInvocation")
                ),
                "cursor" => assert_eq!(
                    value["hooks"]["beforeSubmitPrompt"][1]["command"],
                    format!("{command} beforeSubmitPrompt")
                ),
                _ => unreachable!(),
            }
            edit_hooks(&mut value, agent, &command, false).unwrap();
            assert_eq!(value, original);
        }
    }

    #[test]
    fn live_projects_exclude_completed_sessions_but_keep_their_usage() {
        let start = |name, at| {
            let raw = serde_json::to_vec(&json!({
                "hook_event_name": name, "conversation_id": "cursor-1",
                "workspace_roots": ["/work/private/demo"], "model_id": "example",
                "prompt": "discard me"
            }))
            .unwrap();
            parse_event("cursor", &raw, at).unwrap()
        };
        let mut active = start("beforeSubmitPrompt", 10);
        assert_eq!(active.project, "demo");
        assert_eq!(active.requests, 1);
        assert_eq!(active.model.as_deref(), Some("example"));
        assert!(!serde_json::to_string(&active).unwrap().contains("discard"));
        let done = start("stop", 20);
        active.session = "cursor-2".into();
        let all = vec![done, active];
        assert_eq!(summarize_usage("cursor", &all).sessions, 2);
        let (live, cue) = current_work(all, 20);
        assert_eq!(live.len(), 1);
        assert_eq!(cue.unwrap().session, "cursor-2");

        let data = json!({
            "conversationId": "ag-1", "workspacePaths": ["/work/agent"],
            "modelName": "example", "fullyIdle": false
        });
        assert_eq!(
            parse_signal("antigravity", &data, Some("Stop"), 30)
                .unwrap()
                .status,
            "working"
        );
        let mut finished = data;
        finished["fullyIdle"] = json!(true);
        assert_eq!(
            parse_signal("antigravity", &finished, Some("Stop"), 40)
                .unwrap()
                .status,
            "done"
        );
    }

    #[test]
    fn gemini_counts_each_model_response_once_across_streaming_chunks() {
        let folder =
            std::env::temp_dir().join(format!("buddy-gemini-stream-{}", std::process::id()));
        let write = |name, count, at| {
            let data = json!({
                "hook_event_name": name, "session_id": "gemini-1", "cwd": "/work/demo",
                "llm_request": {"model": "gemini-example"},
                "llm_response": {"usageMetadata": {"totalTokenCount": count}},
            });
            write_event(&folder, parse_signal("gemini", &data, None, at).unwrap()).unwrap();
        };
        write("BeforeAgent", 0, 1);
        write("BeforeModel", 0, 2);
        write("AfterModel", 10, 3);
        write("AfterModel", 10, 4);
        write("AfterModel", 12, 5);
        write("BeforeModel", 0, 6);
        write("AfterModel", 20, 7);
        let saved = &sessions(&folder, 7)[0];
        assert_eq!(saved.usage.tokens.unwrap().total, 32);
        assert_eq!(saved.usage.model_calls, 2);
        assert_eq!(saved.requests, 1);
        fs::remove_dir_all(folder).unwrap();
    }

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
    fn usage_survives_tool_updates_and_starts_a_new_turn_on_request() {
        let dir = std::env::temp_dir().join(format!("buddy-usage-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("codex-existing.json"),
            br#"{"agent":"codex","session":"existing","project":"demo","status":"idle","activity":"Session started","updatedAt":1}"#,
        )
        .unwrap();
        let record = |name, at| {
            let raw = serde_json::to_vec(&json!({
                "hook_event_name": name,
                "session_id": "existing",
                "cwd": "/private/demo",
                "model": (name == "UserPromptSubmit").then_some("sample-model"),
            }))
            .unwrap();
            write_event(&dir, parse_event("codex", &raw, at).unwrap()).unwrap();
        };
        record("UserPromptSubmit", 10);
        record("PreToolUse", 20);
        record("PermissionRequest", 25);
        record("Stop", 30);
        record("PreToolUse", 22);
        let finished = &sessions(&dir, 30)[0];
        assert_eq!(finished.status, "done");
        assert_eq!(finished.requests, 1);
        assert_eq!(finished.turn_started_at, Some(10));
        assert_eq!(finished.model.as_deref(), Some("sample-model"));

        record("UserPromptSubmit", 40);
        let working = &sessions(&dir, 40)[0];
        assert_eq!(working.requests, 2);
        assert_eq!(working.turn_started_at, Some(40));
        fs::remove_dir_all(dir).unwrap();
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
                requests: 0,
                turn_started_at: None,
                model: None,
                usage: Usage::default(),
                last_model_sample: None,
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
            requests: 0,
            turn_started_at: None,
            model: None,
            usage: Usage::default(),
            last_model_sample: None,
        };
        write_event(&dir, working.clone()).unwrap();
        for index in 0..50 {
            let newer = AgentEvent {
                agent: "claude".into(),
                session: format!("done-{index}"),
                status: "done".into(),
                updated_at: index + 2,
                ..working.clone()
            };
            write_event(&dir, newer).unwrap();
        }
        let connected = connected_sessions(&dir, 60, &["codex"]);
        assert_eq!(connected.len(), 1);
        assert_eq!(connected[0].status, "working");
        let mut all_connected = connected_sessions(&dir, 60, &["codex", "claude"]);
        assert_eq!(all_connected.len(), 51);
        all_connected.sort_by_key(|event| cue_priority(event, 60));
        assert_eq!(all_connected[0].status, "working");
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
                requests: 0,
                turn_started_at: None,
                model: None,
                usage: Usage::default(),
                last_model_sample: None,
            };
            write_event(&dir, event).unwrap();
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
