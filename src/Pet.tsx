import pandaSprite from "./assets/pet/panda.png";
import type { Mood } from "./types";

interface PetProps {
  mood: Mood;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function Pet({ mood, onClick, onMouseDown }: PetProps) {
  return (
    <div
      className={`pet pet-${mood}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
      title="Click for usage details"
    >
      <img src={pandaSprite} alt="pet" className="pet-sprite" draggable={false} />
      <span className="pet-mood-dot" />
    </div>
  );
}
