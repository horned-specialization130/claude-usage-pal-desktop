import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    poll_interval_secs: 60,
    admin_api_key: null,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then(setSettings);
  }, []);

  async function save() {
    await invoke("save_settings_cmd", { settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="settings-panel">
      <div className="stats-header">
        <span>Settings</span>
        <button onClick={onClose}>×</button>
      </div>

      <label className="settings-field">
        Poll interval (seconds)
        <input
          type="number"
          min={15}
          value={settings.poll_interval_secs}
          onChange={(e) =>
            setSettings((s) => ({ ...s, poll_interval_secs: Number(e.target.value) || 60 }))
          }
        />
      </label>

      <label className="settings-field">
        Admin API key (optional, org cost data)
        <input
          type="password"
          placeholder="sk-ant-admin..."
          value={settings.admin_api_key ?? ""}
          onChange={(e) =>
            setSettings((s) => ({ ...s, admin_api_key: e.target.value || null }))
          }
        />
      </label>

      <button className="settings-save" onClick={save}>
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
