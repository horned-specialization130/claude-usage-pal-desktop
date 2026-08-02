import penguinSprite from "./assets/pet/penguin.png";
import type { Mood } from "./types";

interface PetProps {
  mood: Mood;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function Pet({ mood, onClick, onMouseDown, onMouseEnter, onMouseLeave }: PetProps) {
  return (
    <div
      className={`pet pet-${mood}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title="Click for usage details"
    >
      <img src={penguinSprite} alt="pet" className="pet-sprite" draggable={false} />
      <span className="pet-mood-dot" />
    </div>
  );
}
