import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";

interface SettingsProps {
  onClose: () => void;
  onPetSizeChange: (sizePx: number) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  poll_interval_secs: 60,
  admin_api_key: null,
  pet_size_px: 40,
  shy_mode_enabled: true,
};

export function Settings({ onClose, onPetSizeChange }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then((s) => {
      setSettings(s);
      onPetSizeChange(s.pet_size_px);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        Pet size ({settings.pet_size_px}px)
        <input
          type="range"
          min={20}
          max={96}
          step={2}
          value={settings.pet_size_px}
          onChange={(e) => {
            const size = Number(e.target.value);
            setSettings((s) => ({ ...s, pet_size_px: size }));
            onPetSizeChange(size);
          }}
        />
      </label>

      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={settings.shy_mode_enabled}
          onChange={(e) => setSettings((s) => ({ ...s, shy_mode_enabled: e.target.checked }))}
        />
        Shy mode (dodge the cursor unless Shift is held)
      </label>

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
