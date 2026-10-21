// Original 24 x 24 weather icons for the Weather Station forecast. Yellow appears only inside the art.

import { blank, ellipse, line, outline, px, shade, toRows } from "./paint";

export const WEATHER_PALETTE = {
  o: "#2a3a2e",
  y: "#f4cf55", Y: "#d9a93a", s: "#fbe7a1", // sun
  c: "#f4f6f2", C: "#cdd5d0", // light cloud
  g: "#a9b6bc", G: "#7d8c93", // rain cloud
  r: "#6fa8c9", // rain
};

const art = (draw) => {
  const g = blank(24, 24);
  draw(g);
  return toRows(g);
};

const sun = (g, cx, cy, r) => {
  for (let a = 0; a < 8; a += 1) {
    const ang = (a * Math.PI) / 4;
    line(g, Math.round(cx + Math.cos(ang) * (r + 2)), Math.round(cy + Math.sin(ang) * (r + 2)), Math.round(cx + Math.cos(ang) * (r + 4)), Math.round(cy + Math.sin(ang) * (r + 4)), "y");
  }
  ellipse(g, cx, cy, r, r, "y");
};

const cloud = (g, cx, cy, body) => {
  ellipse(g, cx - 4, cy + 1, 4, 3, body);
  ellipse(g, cx + 1, cy - 1, 5, 4, body);
  ellipse(g, cx + 5, cy + 1.5, 3.5, 2.8, body);
  ellipse(g, cx, cy + 2.5, 7.5, 2.4, body);
};

export const WEATHER_ART = {
  sunny: art((g) => {
    sun(g, 12, 12, 5);
    shade(g, { y: ["s", "Y"] });
    outline(g);
  }),
  mixed: art((g) => {
    sun(g, 9, 8, 4);
    shade(g, { y: ["s", "Y"] });
    cloud(g, 14, 15, "c");
    shade(g, { c: ["c", "C"] });
    outline(g);
  }),
  stormy: art((g) => {
    cloud(g, 12, 8, "g");
    shade(g, { g: ["g", "G"] });
    outline(g);
    [[7, 15], [11, 17], [15, 15], [19, 17], [9, 20], [13, 21], [17, 20]].forEach(([x, y]) => {
      px(g, x, y, "r");
      px(g, x - 1, y + 1, "r");
    });
  }),
};
