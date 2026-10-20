// Sprout's town sprite, as text-grid pixel art (see PixelArt): four directions, each standing plus two
// walking steps. Facing right is facing left, mirrored. All original art.

export const SPROUT_PALETTE = {
  k: "#1f3326", // outline
  l: "#9fdcb2", // leaf, light
  L: "#3d8a5a", // leaf, dark
  s: "#2f6b48", // stem
  b: "#6fbf87", // body
  B: "#4f9d6a", // body shade
  h: "#b6e5c3", // highlight
  e: "#173322", // eyes
  c: "#f4a38c", // cheeks
};

// Head and body, shared by every direction. Rows 8 to 10 (the face) and 14 to 15 (the feet) change.
const BODY = [
  "....kk....kk....",
  "...kLlk..klLk...",
  "...kLLLkkLLLk...",
  "....kkksskkk....",
  ".......ss.......",
  ".....kkkkkk.....",
  "....khbbbbbk....",
  "...khbbbbbbbk...",
  null,
  null,
  null,
  "....kbbbbbbbk...",
  "....kBBBBBBBk...",
  ".....kkkkkkk....",
  null,
  null,
];

const FACES = {
  down: ["...kbbebbbebbk..", "...kbcbbbbbcbk..", "...kbbbkkkbbbk.."],
  up: ["...kbbbbbbbbbk..", "...kbbbbbbbbbk..", "...kbbbbbbbbbk.."],
  left: ["...kebbbbbbbbk..", "...kcbbbbbbbbk..", "...kbkbbbbbbbk.."],
};

const FEET = [
  [".....kBk.kBk....", ".....kkk.kkk...."], // standing
  ["....kBk...kBk...", "....kkk...kkk..."], // step: feet apart
  ["......kBkkBk....", "......kkkkkk...."], // step: feet together
];

const build = (face, feet) => BODY.map((row, i) => row ?? (i >= 8 && i <= 10 ? face[i - 8] : feet[i - 14]));

/** SPROUT_FRAMES[direction][frame]: frame 0 is standing, 1 and 2 are the walking steps. */
export const SPROUT_FRAMES = Object.fromEntries(Object.entries(FACES).map(([dir, face]) => [dir, FEET.map((feet) => build(face, feet))]));

// The standing, front-facing Sprout (used on the dashboard switch).
export const SPROUT_FRONT = SPROUT_FRAMES.down[0];

// Battle poses, seen from behind: standing, mid-step (for the lunge), and a wilt with drooping leaves.
// The wilt is cosmetic and brief: Sprout perks right back up.
const DROOP = ["................", "................", ".kkk...ss...kkk.", "kLlLkkksskkkLlLk"];
export const SPROUT_BATTLE = {
  idle: SPROUT_FRAMES.up[0],
  step: SPROUT_FRAMES.up[1],
  wilt: [...DROOP, ...SPROUT_FRAMES.up[0].slice(4)],
};
