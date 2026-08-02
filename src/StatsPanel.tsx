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

function levelFor(pct: number | null | undefined): "ok" | "warn" | "hot" | "unknown" {
  if (pct === null || pct === undefined) return "unknown";
  if (pct >= 80) return "hot";
  if (pct >= 50) return "warn";
  return "ok";
}

interface UsageMeterProps {
  label: string;
  pct: number | null | undefined;
  resetsAt: string | null | undefined;
  size: "lg" | "sm";
}

function UsageMeter({ label, pct, resetsAt, size }: UsageMeterProps) {
  const level = levelFor(pct);
  const width = pct === null || pct === undefined ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className={`usage-meter usage-meter-${size} level-${level}`}>
      <div className="usage-meter-top">
        <span className="usage-meter-label">{label}</span>
        <span className="usage-meter-pct">{pct === null || pct === undefined ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="usage-meter-track">
        <div className="usage-meter-fill" style={{ width: `${width}%` }} />
      </div>
      <div className="usage-meter-reset">resets in {formatResetsAt(resetsAt ?? null)}</div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="detail-stat">
      <span className="detail-stat-label">{label}</span>
      <span className="detail-stat-value">{value}</span>
    </div>
  );
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then((s) => {
      setHasAdminKey(Boolean(s.admin_api_key));
    });
  }, []);

  useEffect(() => {
    if (!hasAdminKey || !detailsOpen) return;
    invoke("get_admin_usage")
      .then((res) => setAdminSummary(res))
      .catch((err) => setAdminError(String(err)));
  }, [hasAdminKey, detailsOpen]);

  const { usage, usageError, local } = data;
  const weeklyPct = usage?.seven_day?.utilization ?? null;
  const weeklyIsPrimary = weeklyPct !== null && weeklyPct >= 50;

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <span>Claude Usage</span>
        <div className="stats-header-actions">
          <button onClick={onOpenSettings}>⚙</button>
          <button onClick={onClose}>×</button>
        </div>
      </div>

      {usageError && !usage && <div className="stats-error">Usage unavailable: {usageError}</div>}

      {usage && (
        <div className="usage-primary">
          <UsageMeter
            label="5-hour window"
            pct={usage.five_hour?.utilization}
            resetsAt={usage.five_hour?.resets_at}
            size="lg"
          />
          {weeklyIsPrimary && (
            <UsageMeter label="Weekly" pct={weeklyPct} resetsAt={usage.seven_day?.resets_at} size="lg" />
          )}
        </div>
      )}

      {usage && !weeklyIsPrimary && (
        <div className="usage-inline">
          <span>Weekly</span>
          <span className="usage-inline-pct">{weeklyPct === null ? "—" : `${Math.round(weeklyPct)}%`}</span>
          <span className="usage-inline-reset">resets in {formatResetsAt(usage.seven_day?.resets_at ?? null)}</span>
        </div>
      )}

      <button className="details-toggle" onClick={() => setDetailsOpen((v) => !v)}>
        {detailsOpen ? "Hide details ▲" : "Show details ▼"}
      </button>

      {detailsOpen && (
        <>
          <div className="detail-stats">
            <DetailStat label="Messages today" value={local.message_count} />
            <DetailStat
              label="Tokens today"
              value={(local.input_tokens + local.output_tokens).toLocaleString()}
            />
          </div>

          {hasAdminKey && (
            <div className="detail-stats">
              <div className="detail-stat-label detail-stats-title">Org cost (Admin API)</div>
              {adminError && <div className="stats-error">{adminError}</div>}
              {!adminError && adminSummary ? (
                <pre className="stats-raw">{JSON.stringify(adminSummary, null, 2).slice(0, 400)}</pre>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
