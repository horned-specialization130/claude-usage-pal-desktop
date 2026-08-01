use serde::{Deserialize, Serialize};

/// Mirrors the shape of the (undocumented) endpoint Claude Code itself calls
/// for the `/usage` command: `GET https://api.anthropic.com/api/oauth/usage`.
/// Unknown/absent fields are tolerated since this is not a public, versioned API.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageWindow {
    pub utilization: Option<f64>,
    pub resets_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UsageLimit {
    pub kind: String,
    pub group: Option<String>,
    pub percent: Option<f64>,
    pub severity: Option<String>,
    pub resets_at: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UsageReport {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
    #[serde(default)]
    pub limits: Vec<UsageLimit>,
}

pub async fn fetch_usage(access_token: &str) -> Result<UsageReport, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .bearer_auth(access_token)
        .header("anthropic-beta", "oauth-2025-04-20")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("usage endpoint returned {}", resp.status()));
    }

    resp.json::<UsageReport>()
        .await
        .map_err(|e| format!("failed to parse usage response: {e}"))
}
