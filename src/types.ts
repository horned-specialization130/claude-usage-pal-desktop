export interface UsageWindow {
  utilization: number | null;
  resets_at: string | null;
}

export interface UsageLimit {
  kind: string;
  group: string | null;
  percent: number | null;
  severity: string | null;
  resets_at: string | null;
  is_active: boolean | null;
}

export interface UsageReport {
  five_hour: UsageWindow | null;
  seven_day: UsageWindow | null;
  limits: UsageLimit[];
}

export interface TodayLocalUsage {
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  session_count_today: number;
  tool_call_count_today: number;
}

export interface UsageUpdatedPayload {
  usage: UsageReport | null;
  usageError: string | null;
  local: TodayLocalUsage;
}

export interface AppSettings {
  poll_interval_secs: number;
  admin_api_key: string | null;
}

export type Mood = "happy" | "alert" | "tired" | "unavailable";
