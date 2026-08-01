use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Clone)]
pub struct ClaudeAiOauth {
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

#[derive(Debug, Deserialize, Clone)]
struct CredentialsFile {
    #[serde(rename = "claudeAiOauth")]
    claude_ai_oauth: Option<ClaudeAiOauth>,
}

fn credentials_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude").join(".credentials.json"))
}

/// Reads the OAuth access token Claude Code already stores locally after `claude` login.
/// We only ever read this file and send the token to Anthropic's own usage endpoint.
pub fn read_access_token() -> Result<ClaudeAiOauth, String> {
    let path = credentials_path().ok_or("could not resolve home directory")?;
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("could not read {}: {e}", path.display()))?;
    let parsed: CredentialsFile = serde_json::from_str(&raw)
        .map_err(|e| format!("could not parse credentials file: {e}"))?;
    parsed
        .claude_ai_oauth
        .ok_or_else(|| "no claudeAiOauth entry found — run `claude` to log in".to_string())
}
