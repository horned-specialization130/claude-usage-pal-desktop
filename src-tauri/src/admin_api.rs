use serde::{Deserialize, Serialize};

/// Optional: only used when the user configures an Admin API key in Settings.
/// The schema of the cost report response isn't fully modeled here — we pass
/// the raw JSON through and let the frontend render a best-effort summary.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AdminUsageSummary {
    pub raw: Option<serde_json::Value>,
}

pub async fn fetch_cost_report(admin_key: &str) -> Result<AdminUsageSummary, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.anthropic.com/v1/organizations/cost_report")
        .header("x-api-key", admin_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("cost_report endpoint returned {}", resp.status()));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("failed to parse cost report response: {e}"))?;

    Ok(AdminUsageSummary { raw: Some(raw) })
}
