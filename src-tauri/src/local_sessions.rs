use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Debug, Serialize, Clone, Default)]
pub struct TodayLocalUsage {
    pub message_count: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub session_count_today: u64,
    pub tool_call_count_today: u64,
}

fn projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

fn stats_cache_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("stats-cache.json"))
}

/// Sums today's token usage from local Claude Code session transcripts
/// (`~/.claude/projects/**/*.jsonl`) and today's activity counts from
/// `~/.claude/stats-cache.json`. This is a detail/supplementary view —
/// the pet's mood is driven by the plan usage percentages, not this.
pub fn today_local_usage() -> TodayLocalUsage {
    let mut result = TodayLocalUsage::default();
    let today = Utc::now().date_naive();

    if let Some(dir) = projects_dir() {
        if let Ok(project_entries) = std::fs::read_dir(&dir) {
            for project in project_entries.flatten() {
                let project_path = project.path();
                if !project_path.is_dir() {
                    continue;
                }
                let Ok(session_entries) = std::fs::read_dir(&project_path) else {
                    continue;
                };
                for session in session_entries.flatten() {
                    let path = session.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                        continue;
                    }
                    // Cheap pre-filter: skip files that weren't touched today.
                    if let Ok(meta) = std::fs::metadata(&path) {
                        if let Ok(modified) = meta.modified() {
                            let modified: DateTime<Utc> = modified.into();
                            if modified.date_naive() != today {
                                continue;
                            }
                        }
                    }
                    let Ok(content) = std::fs::read_to_string(&path) else {
                        continue;
                    };
                    for line in content.lines() {
                        let Ok(entry) = serde_json::from_str::<Value>(line) else {
                            continue;
                        };
                        let Some(ts) = entry.get("timestamp").and_then(|v| v.as_str()) else {
                            continue;
                        };
                        let Ok(ts) = DateTime::parse_from_rfc3339(ts) else {
                            continue;
                        };
                        if ts.with_timezone(&Utc).date_naive() != today {
                            continue;
                        }
                        if entry.get("type").and_then(|v| v.as_str()) == Some("assistant") {
                            if let Some(usage) = entry.pointer("/message/usage") {
                                result.message_count += 1;
                                result.input_tokens +=
                                    usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                                result.output_tokens += usage
                                    .get("output_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                result.cache_creation_tokens += usage
                                    .get("cache_creation_input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                result.cache_read_tokens += usage
                                    .get("cache_read_input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(path) = stats_cache_path() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
                if let Some(days) = parsed.get("dailyActivity").and_then(|v| v.as_array()) {
                    let today_str = today.format("%Y-%m-%d").to_string();
                    if let Some(day) = days
                        .iter()
                        .find(|d| d.get("date").and_then(|v| v.as_str()) == Some(today_str.as_str()))
                    {
                        result.session_count_today =
                            day.get("sessionCount").and_then(|v| v.as_u64()).unwrap_or(0);
                        result.tool_call_count_today = day
                            .get("toolCallCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                    }
                }
            }
        }
    }

    result
}
