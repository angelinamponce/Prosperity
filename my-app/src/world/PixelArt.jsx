import { memo } from "react";

/**
 * Draws pixel art written as text: one string per row, one character per pixel.
 * `palette` maps characters to colors; "." (or any unmapped character) is transparent.
 * Runs of the same color in a row become one rect, so a 32x32 sprite stays light.
 */
export const PixelArt = memo(function PixelArt({ rows, palette, size, label, className = "" }) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      if (palette[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={palette[ch]} />);
      x = end;
    }
  });
  return (
    <svg
      className={`px-art ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size ? (size * h) / w : undefined}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects}
    </svg>
  );
});
