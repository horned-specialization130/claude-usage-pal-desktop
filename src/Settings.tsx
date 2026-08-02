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

      <div className="settings-group">
        <div className="settings-group-title">Pet</div>

        <div className="settings-row">
          <span>Size</span>
          <span className="settings-row-value">{settings.pet_size_px}px</span>
        </div>
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

        <label className="toggle-row">
          <div className="toggle-row-text">
            <span className="toggle-row-title">Shy mode</span>
            <span className="settings-hint">Dodges the cursor unless Shift is held</span>
          </div>
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.shy_mode_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, shy_mode_enabled: e.target.checked }))}
            />
            <span className="toggle-switch-track" />
          </span>
        </label>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Data</div>

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
      </div>

      <button className="settings-save" onClick={save}>
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
