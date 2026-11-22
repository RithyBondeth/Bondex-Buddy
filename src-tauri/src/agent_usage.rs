use std::{
    collections::HashMap,
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::Path,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;
pub const OPT_IN_FILE: &str = ".session-token-usage";

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tokens {
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub total: u64,
}

impl Tokens {
    pub fn add(self, other: Self) -> Self {
        fn optional_add(a: Option<u64>, b: Option<u64>) -> Option<u64> {
            Some(a?.saturating_add(b?))
        }
        Self {
            input: optional_add(self.input, other.input),
            output: optional_add(self.output, other.output),
            total: self.total.saturating_add(other.total),
        }
    }

    pub fn max(self, other: Self) -> Self {
        Self {
            input: self.input.max(other.input),
            output: self.output.max(other.output),
            total: self.total.max(other.total),
        }
    }

    pub fn delta(self, previous: Self) -> Self {
        Self {
            input: self
                .input
                .map(|a| a.saturating_sub(previous.input.unwrap_or(0))),
            output: self
                .output
                .map(|a| a.saturating_sub(previous.output.unwrap_or(0))),
            total: self.total.saturating_sub(previous.total),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub tool_calls: u32,
    pub tool_failures: u32,
    pub model_calls: u32,
    pub thinking_ms: u64,
    pub tokens: Option<Tokens>,
    pub recent_tokens_only: bool,
    #[serde(default)]
    pub token_signal_at: Option<u64>,
}

pub fn is_enabled(folder: &Path) -> bool {
    folder.join(OPT_IN_FILE).is_file()
}

pub fn gemini_tokens(value: &Value) -> Option<Tokens> {
    let usage = &value["llm_response"]["usageMetadata"];
    Some(Tokens {
        input: usage["promptTokenCount"].as_u64(),
        output: usage["candidatesTokenCount"].as_u64(),
        total: usage["totalTokenCount"].as_u64()?,
    })
}

/// Read only the current provider/session JSONL below its canonical log root.
pub fn log_tokens(agent: &str, root: &Path, path: &Path, session: &str) -> Option<(Tokens, bool)> {
    let root = fs::canonicalize(root).ok()?;
    let path = fs::canonicalize(path).ok()?;
    let name = path.file_stem()?.to_str()?;
    let expected = if agent == "codex" {
        name.starts_with("rollout-")
            && name
                .strip_suffix(session)
                .is_some_and(|prefix| prefix.ends_with('-'))
    } else {
        name == session
    };
    if !expected
        || !path.starts_with(root)
        || path.extension()? != "jsonl"
        || !fs::metadata(&path).ok()?.is_file()
    {
        return None;
    }
    let mut file = File::open(path).ok()?;
    let start = file.metadata().ok()?.len().saturating_sub(MAX_LOG_BYTES);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    file.take(MAX_LOG_BYTES).read_to_end(&mut bytes).ok()?;
    let mut lines = bytes.split(|byte| *byte == b'\n');
    if start > 0 {
        lines.next();
    }
    if agent == "codex" {
        let latest = lines.rev().find_map(|line| {
            if !line
                .windows(b"\"token_count\"".len())
                .any(|part| part == b"\"token_count\"")
            {
                return None;
            }
            let value: Value = serde_json::from_slice(line).ok()?;
            let payload = &value["payload"];
            if value["type"] != "event_msg" || payload["type"] != "token_count" {
                return None;
            }
            let counts = &payload["info"]["total_token_usage"];
            Some(Tokens {
                input: counts["input_tokens"].as_u64(),
                output: counts["output_tokens"].as_u64(),
                total: counts["total_tokens"].as_u64()?,
            })
        })?;
        return Some((latest, false));
    }
    let mut messages = HashMap::new();
    for line in lines {
        if !line
            .windows(b"\"usage\"".len())
            .any(|part| part == b"\"usage\"")
        {
            continue;
        }
        let Ok(value) = serde_json::from_slice::<Value>(line) else {
            continue;
        };
        let message = &value["message"];
        if value["type"] != "assistant" || message["model"] == "<synthetic>" {
            continue;
        }
        let usage = &message["usage"];
        let (Some(id), Some(input), Some(output)) = (
            message["id"].as_str(),
            usage["input_tokens"].as_u64(),
            usage["output_tokens"].as_u64(),
        ) else {
            continue;
        };
        let input = input
            .saturating_add(usage["cache_creation_input_tokens"].as_u64().unwrap_or(0))
            .saturating_add(usage["cache_read_input_tokens"].as_u64().unwrap_or(0));
        let tokens = Tokens {
            input: Some(input),
            output: Some(output),
            total: input.saturating_add(output),
        };
        let existing = messages.entry(id.to_owned()).or_insert(tokens);
        if existing.total <= tokens.total {
            *existing = tokens;
        }
    }
    messages
        .into_values()
        .reduce(Tokens::add)
        .map(|tokens| (tokens, start > 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_extraction_uses_only_scoped_numeric_records() {
        let root = std::env::temp_dir().join(format!("buddy-usage-log-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let codex = root.join("rollout-example-sample.jsonl");
        let claude = root.join("sample.jsonl");
        fs::write(&codex, concat!(
            "{\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"total_tokens\":10}}}}\n",
            "{\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":{\"total_token_usage\":{\"total_tokens\":31}}}}\n",
            "{\"type\":\"event_msg\",\"payload\":{\"type\":\"token_count\",\"info\":null}}\n",
        )).unwrap();
        let response = "{\"type\":\"assistant\",\"message\":{\"id\":\"msg_1\",\"usage\":{\"input_tokens\":2,\"cache_read_input_tokens\":4,\"output_tokens\":5},\"content\":\"private\"}}\n";
        fs::write(&claude, response.repeat(2)).unwrap();
        assert_eq!(
            log_tokens("codex", &root, &codex, "sample")
                .unwrap()
                .0
                .total,
            31
        );
        assert_eq!(
            log_tokens("claude", &root, &claude, "sample")
                .unwrap()
                .0
                .total,
            11
        );
        assert!(log_tokens("claude", &root, &claude, "different").is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
