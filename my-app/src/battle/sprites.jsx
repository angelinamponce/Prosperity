import { PixelArt } from "../world/PixelArt";

// Placeholder battle art. Q3 replaces these with each Misconception's own sprite and Sprout's battle poses.

const BLOB = [
  "................",
  ".....oooooo.....",
  "...oobbbbbboo...",
  "..obbbbbbbbbbo..",
  ".obbhhbbbbbbbbo.",
  ".obhhbbbbbbbbbo.",
  "obbbwwbbbbwwbbbo",
  "obbbwkbbbbwkbbbo",
  "obbbbbbbbbbbbbbo",
  "obbbbbbkkbbbbbbo",
  ".obbbbbbbbbbbbo.",
  ".obbbbbbbbbbbbo.",
  "..oobbbbbbbbbo..",
  "....oooooooo....",
  "...oo......oo...",
  "................",
];

export function FoeSprite({ foe, size = 120 }) {
  return <PixelArt rows={BLOB} size={size} palette={{ o: "#2a3a2e", b: foe.color, h: "rgba(255,255,255,0.55)", w: "#ffffff", k: "#1d2a21" }} />;
}
