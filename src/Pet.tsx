import type { Mood } from "./types";

interface PetProps {
  mood: Mood;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const MOOD_EYES: Record<Mood, string> = {
  happy: "^  ^",
  alert: "o  o",
  tired: "-  -",
  unavailable: "x  x",
};

export function Pet({ mood, onClick, onMouseDown }: PetProps) {
  return (
    <div
      className={`pet pet-${mood}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      title="Click for usage details"
    >
      <div className="pet-ear pet-ear-left" />
      <div className="pet-ear pet-ear-right" />
      <div className="pet-body">
        <div className="pet-face">{MOOD_EYES[mood]}</div>
      </div>
      <div className="pet-tail" />
    </div>
  );
}
