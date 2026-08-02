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

function App() {
  const usage = useUsage();
  const [view, setView] = useState<View>("closed");
  const [petSize, setPetSize] = useState(40);

  useEffect(() => {
    invoke<AppSettings>("get_settings").then((s) => setPetSize(s.pet_size_px));
  }, []);

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
      />
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
