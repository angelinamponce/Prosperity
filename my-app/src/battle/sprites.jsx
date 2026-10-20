import { PixelArt } from "../world/PixelArt";
import { foeArt } from "./foeArt";

/** A Misconception's pixel sprite. state: "idle", "hit" (eyes squeezed shut) or "happy" (befriended). */
export function FoeSprite({ foe, size = 120, state = "idle" }) {
  const { rows, palette } = foeArt(foe.id, state);
  return <PixelArt rows={rows} palette={palette} size={size} />;
}
