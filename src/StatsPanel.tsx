import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, UsageUpdatedPayload } from "./types";

function formatResetsAt(resetsAt: string | null): string {
  if (!resetsAt) return "unknown";
  const target = new Date(resetsAt).getTime();
  const diffMs = target - Date.now();
  if (Number.isNaN(target)) return "unknown";
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

interface StatsPanelProps {
  data: UsageUpdatedPayload;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function StatsPanel({ data, onClose, onOpenSettings }: StatsPanelProps) {
  const [adminSummary, setAdminSummary] = useState<unknown>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [hasAdminKey, setHasAdminKey] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then((s) => {
      setHasAdminKey(Boolean(s.admin_api_key));
    });
  }, []);

  useEffect(() => {
    if (!hasAdminKey) return;
    invoke("get_admin_usage")
      .then((res) => setAdminSummary(res))
      .catch((err) => setAdminError(String(err)));
  }, [hasAdminKey]);

  const { usage, usageError, local } = data;

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <span>Claude Usage</span>
        <div className="stats-header-actions">
          <button onClick={onOpenSettings}>⚙</button>
          <button onClick={onClose}>×</button>
        </div>
      </div>

      {usageError && !usage && (
        <div className="stats-error">Usage unavailable: {usageError}</div>
      )}

      {usage && (
        <div className="stats-section">
          <div className="stats-row">
            <span>5-hour window</span>
            <span>{formatPercent(usage.five_hour?.utilization)}</span>
          </div>
          <div className="stats-subrow">resets in {formatResetsAt(usage.five_hour?.resets_at ?? null)}</div>

          <div className="stats-row">
            <span>Weekly</span>
            <span>{formatPercent(usage.seven_day?.utilization)}</span>
          </div>
          <div className="stats-subrow">resets in {formatResetsAt(usage.seven_day?.resets_at ?? null)}</div>
        </div>
      )}

      <div className="stats-section">
        <div className="stats-row">
          <span>Today's messages</span>
          <span>{local.message_count}</span>
        </div>
        <div className="stats-row">
          <span>Today's tokens</span>
          <span>{(local.input_tokens + local.output_tokens).toLocaleString()}</span>
        </div>
        <div className="stats-row">
          <span>Sessions today</span>
          <span>{local.session_count_today}</span>
        </div>
      </div>

      {hasAdminKey && (
        <div className="stats-section">
          <div className="stats-row">
            <span>Org cost (Admin API)</span>
          </div>
          {adminError && <div className="stats-error">{adminError}</div>}
          {!adminError && adminSummary ? (
            <pre className="stats-raw">{JSON.stringify(adminSummary, null, 2).slice(0, 400)}</pre>
          ) : null}
        </div>
      )}
    </div>
  );
}
