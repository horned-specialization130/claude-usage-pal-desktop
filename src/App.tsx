import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Pet } from "./Pet";
import { StatsPanel } from "./StatsPanel";
import { Settings } from "./Settings";
import { useUsage } from "./useUsage";
import type { AppSettings } from "./types";
import "./App.css";

type View = "closed" | "stats" | "settings";

// Extra room around the sprite for its drop-shadow/glow filters and click hit area.
const CLOSED_WINDOW_MARGIN = 40;
const OPEN_WINDOW_WIDTH = 260;
const OPEN_WINDOW_HEIGHT = 460;
const HOVER_WINDOW_WIDTH = 190;
const HOVER_WINDOW_EXTRA_HEIGHT = 90;

function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

function App() {
  const usage = useUsage();
  const [view, setView] = useState<View>("closed");
  const [petSize, setPetSize] = useState(40);
  const [hovering, setHovering] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then((s) => setPetSize(s.pet_size_px));
  }, []);

  useEffect(() => {
    // The window rarely has OS keyboard focus, so Shift state can't be read
    // from DOM key events — poll the backend's global key-state instead,
    // only while it's actually relevant (hovering the pet).
    if (!hovering) {
      setShiftHeld(false);
      return;
    }
    let cancelled = false;
    const poll = () => {
      invoke<boolean>("get_shift_held")
        .then((held) => {
          if (!cancelled) setShiftHeld(held);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 100);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hovering]);

  const showTooltip = view === "closed" && hovering && shiftHeld;

  useEffect(() => {
    // The window is transparent but still intercepts clicks over its whole
    // rectangle, so keep it sized to only what's actually visible right now.
    const width =
      view !== "closed" ? OPEN_WINDOW_WIDTH : showTooltip ? HOVER_WINDOW_WIDTH : petSize + CLOSED_WINDOW_MARGIN;
    const height =
      view !== "closed"
        ? OPEN_WINDOW_HEIGHT
        : showTooltip
          ? petSize + HOVER_WINDOW_EXTRA_HEIGHT
          : petSize + CLOSED_WINDOW_MARGIN;
    invoke("resize_pet_window", { width, height }).catch(() => {});
    invoke("set_panel_open", { open: view !== "closed" }).catch(() => {});
  }, [view, petSize, showTooltip]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onMoved(({ payload }) => {
        invoke("save_window_position", { x: payload.x, y: payload.y }).catch(() => {});
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  function onPetMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    function onMove(ev: MouseEvent) {
      if (dragging) return;
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
        dragging = true;
        cleanup();
        getCurrentWindow().startDragging();
      }
    }
    function onUp() {
      cleanup();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="app-root" style={{ ["--pet-size" as string]: `${petSize}px` }}>
      <Pet
        mood={usage.mood}
        onClick={() => setView((v) => (v === "stats" ? "closed" : "stats"))}
        onMouseDown={onPetMouseDown}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      />
      {showTooltip && (
        <div className="pet-tooltip">
          {usage.usage ? (
            <>
              <div className="pet-tooltip-row">
                <span>5h</span>
                <span>{formatPct(usage.usage.five_hour?.utilization)}</span>
              </div>
              <div className="pet-tooltip-row">
                <span>Weekly</span>
                <span>{formatPct(usage.usage.seven_day?.utilization)}</span>
              </div>
            </>
          ) : (
            <div className="pet-tooltip-row pet-tooltip-error">Usage unavailable</div>
          )}
        </div>
      )}
      {view === "stats" && (
        <StatsPanel
          data={usage}
          onClose={() => setView("closed")}
          onOpenSettings={() => setView("settings")}
        />
      )}
      {view === "settings" && <Settings onClose={() => setView("closed")} onPetSizeChange={setPetSize} />}
    </div>
  );
}

export default App;
