import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Mood, UsageUpdatedPayload } from "./types";

const EMPTY_LOCAL = {
  message_count: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_tokens: 0,
  cache_read_tokens: 0,
  session_count_today: 0,
  tool_call_count_today: 0,
};

export function moodFromUtilization(utilization: number | null): Mood {
  if (utilization === null) return "unavailable";
  if (utilization >= 80) return "tired";
  if (utilization >= 50) return "alert";
  return "happy";
}

export function useUsage() {
  const [state, setState] = useState<UsageUpdatedPayload>({
    usage: null,
    usageError: null,
    local: EMPTY_LOCAL,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    invoke<UsageUpdatedPayload["usage"]>("get_usage")
      .then((usage) => setState((prev) => ({ ...prev, usage, usageError: null })))
      .catch((err) => setState((prev) => ({ ...prev, usage: null, usageError: String(err) })))
      .finally(() => setLoaded(true));

    invoke<UsageUpdatedPayload["local"]>("get_local_usage")
      .then((local) => setState((prev) => ({ ...prev, local })))
      .catch(() => {});

    listen<UsageUpdatedPayload>("usage-updated", (event) => {
      setState(event.payload);
      setLoaded(true);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  const utilization = Math.max(
    state.usage?.five_hour?.utilization ?? -1,
    state.usage?.seven_day?.utilization ?? -1
  );
  const mood = moodFromUtilization(state.usage ? (utilization < 0 ? null : utilization) : null);

  return { ...state, mood, loaded };
}
