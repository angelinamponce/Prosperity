import { useEffect, useId, useMemo, useState } from "react";
import { prefersReducedMotion, useSize } from "./hooks";
import { money, moneyShort } from "./format";

// ---------- scale helpers ----------

function niceStep(raw) {
  const exp = Math.floor(Math.log10(raw || 1));
  const f = raw / 10 ** exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

function niceScale(min, max, count = 4) {
  const step = niceStep((max - min) / count || 1);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { min: lo, max: hi === lo ? lo + step : hi, ticks };
}

const pathFrom = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

// Spread end-of-line labels so they never overlap.
function spreadLabels(items, minGap, top, bottom) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap;
  }
  const overflow = sorted.length ? sorted[sorted.length - 1].y - bottom : 0;
  if (overflow > 0) sorted.forEach((s) => (s.y = Math.max(top, s.y - overflow)));
  return sorted;
}

function Tooltip({ x, y, width, title, rows }) {
  const flip = x > width - 190;
  return (
    <div className="ps-tooltip" style={{ left: flip ? x - 12 : x + 12, top: y, transform: flip ? "translateX(-100%)" : undefined }} role="status">
      <div className="ps-tooltip__title">{title}</div>
      {rows.map((r) => (
        <div className="ps-tooltip__row" key={r.label}>
          {r.color && <span className="ps-tooltip__key" style={{ background: r.color }} />}
          <span className="ps-tooltip__value">{r.value}</span>
          <span className="ps-tooltip__name">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="ps-legend">
      {items.map((it) => (
        <span className="ps-legend__item" key={it.label}>
          <span
            className={it.shape === "rect" ? "ps-legend__rect" : `ps-legend__line${it.dashed ? " ps-legend__line--dashed" : ""}`}
            style={{ background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------- Line / area chart with crosshair ----------

/**
 * x:        labels for each point (tooltip title + axis)
 * series:   [{ key, label, color, values, dashed? }]
 * bands:    [{ key, lo, hi, color, opacity }] shaded ranges drawn under the lines
 * ghosts:   [[values]] faint background paths (e.g. simulation samples)
 * refLines: [{ y, label }] horizontal reference lines
 */
export function LineChart({
  x,
  series,
  bands = [],
  ghosts = [],
  refLines = [],
  height = 280,
  yFormat = moneyShort,
  valueFormat = money,
  area = false,
  endLabels = false,
  tooltipRows,
  ariaLabel,
}) {
  const [ref, width] = useSize();
  const [hover, setHover] = useState(null);
  const gradId = useId().replace(/:/g, "");
  const n = x.length;
  const margin = { top: 12, right: endLabels ? 120 : 12, bottom: 28, left: 48 };
  const iw = Math.max(10, width - margin.left - margin.right);
  const ih = height - margin.top - margin.bottom;

  const all = [...series.flatMap((s) => s.values), ...bands.flatMap((b) => [...b.lo, ...b.hi]), ...refLines.map((r) => r.y)];
  const { min, max, ticks } = niceScale(Math.min(0, ...all), Math.max(1, ...all));
  const sx = (i) => margin.left + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const sy = (v) => margin.top + ih - ((v - min) / (max - min)) * ih;
  const linePath = (vals) => pathFrom(vals.map((v, i) => [sx(i), sy(v)]));
  // About one label per 95px so dates never collide.
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 95))));

  const pick = (clientX, rect) => {
    const i = Math.round(((clientX - rect.left - margin.left) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === "Escape") setHover(null);
  };

  const rows =
    hover == null
      ? []
      : tooltipRows
      ? tooltipRows(hover)
      : series.map((s) => ({ label: s.label, color: s.color, value: valueFormat(s.values[hover]) }));

  const ends = endLabels
    ? spreadLabels(
        series.map((s) => ({ key: s.key, label: s.label, value: s.values[n - 1], y: sy(s.values[n - 1]) })),
        30,
        margin.top + 8,
        margin.top + ih
      )
    : [];

  return (
    <div className="ps-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`g${gradId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={series[0]?.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={series[0]?.color} stopOpacity="0" />
            </linearGradient>
            <clipPath id={`c${gradId}`}>
              <rect x={margin.left} y={margin.top} width={iw} height={ih} />
            </clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={margin.left + iw} y1={sy(t)} y2={sy(t)} stroke="var(--ps-grid)" />
              <text className="ps-axis-label" x={margin.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
            </g>
          ))}
          {x.map((label, i) =>
            (i % tickEvery === 0 && n - 1 - i >= tickEvery * 0.8) || i === n - 1 ? (
              <text key={i} className="ps-axis-label" x={sx(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {label}
              </text>
            ) : null
          )}

          <g clipPath={`url(#c${gradId})`}>
            {ghosts.map((g, i) => (
              <path key={i} d={linePath(g)} fill="none" stroke="var(--ps-brand-400)" strokeOpacity="0.16" strokeWidth="1" className="ps-fade-in" />
            ))}
          </g>
          {bands.map((b) => (
            <path
              key={b.key}
              className="ps-fade-in ps-line"
              d={`${linePath(b.hi)}${pathFrom(b.lo.map((v, i) => [sx(i), sy(v)]).reverse()).replace("M", "L")}Z`}
              fill={b.color}
              fillOpacity={b.opacity ?? 0.2}
            />
          ))}
          {area && series[0] && (
            <path
              className="ps-fade-in ps-line"
              d={`${linePath(series[0].values)}L${sx(n - 1)},${sy(Math.max(min, 0))}L${sx(0)},${sy(Math.max(min, 0))}Z`}
              fill={`url(#g${gradId})`}
            />
          )}
          {refLines.map((r) => (
            <g key={r.label}>
              <line x1={margin.left} x2={margin.left + iw} y1={sy(r.y)} y2={sy(r.y)} stroke="var(--ps-ink-3)" strokeDasharray="4 4" />
              <text className="ps-direct-label" x={margin.left + 6} y={sy(r.y) - 6}>{r.label}</text>
            </g>
          ))}
          {series.map((s) => (
            <path
              key={s.key}
              className={`ps-line ${s.dashed ? "ps-fade-in" : "ps-draw"}`}
              pathLength={s.dashed ? undefined : 1}
              d={linePath(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeDasharray={s.dashed ? "5 5" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {ends.map((e) => (
            <text key={e.key} className="ps-direct-label ps-fade-in" x={margin.left + iw + 10} y={e.y}>
              <tspan x={margin.left + iw + 10} dy="-0.15em" fontWeight="600" fill="var(--ps-ink)">{moneyShort(e.value)}</tspan>
              <tspan x={margin.left + iw + 10} dy="1.25em">{e.label}</tspan>
            </text>
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line x1={sx(hover)} x2={sx(hover)} y1={margin.top} y2={margin.top + ih} stroke="var(--ps-ink-3)" strokeOpacity="0.5" />
              {series.map((s) => (
                <circle key={s.key} cx={sx(hover)} cy={sy(s.values[hover])} r="4.5" fill={s.color} stroke="var(--ps-surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && width > 0 && <Tooltip x={sx(hover)} y={margin.top} width={width} title={x[hover]} rows={rows} />}
    </div>
  );
}

// ---------- Waterfall ----------

/** steps: [{ key, label, value, kind: "total" | "out" | "result", color? }] */
export function Waterfall({ steps, height = 300, base, ariaLabel }) {
  const [ref, width] = useSize();
  const [hover, setHover] = useState(null);
  const narrow = width < 520;
  const margin = { top: 24, right: 8, bottom: narrow ? 52 : 32, left: 48 };
  const iw = Math.max(10, width - margin.left - margin.right);
  const ih = height - margin.top - margin.bottom;

  const bars = useMemo(() => {
    let running = 0;
    return steps.map((s) => {
      if (s.kind === "total") {
        running = s.value;
        return { ...s, y0: 0, y1: s.value };
      }
      if (s.kind === "out") {
        const b = { ...s, y0: running - s.value, y1: running };
        running -= s.value;
        return b;
      }
      return { ...s, y0: 0, y1: s.value };
    });
  }, [steps]);

  const { max, ticks } = niceScale(0, Math.max(1, ...bars.map((b) => b.y1)));
  const band = iw / bars.length;
  const bw = Math.min(56, band * 0.64);
  const sy = (v) => margin.top + ih - (v / max) * ih;
  const bx = (i) => margin.left + band * i + (band - bw) / 2;

  return (
    <div className="ps-chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={margin.left + iw} y1={sy(t)} y2={sy(t)} stroke="var(--ps-grid)" />
              <text className="ps-axis-label" x={margin.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">{moneyShort(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const next = bars[i + 1];
            const level = b.kind === "out" ? b.y0 : b.y1;
            return (
              <g
                key={b.key}
                tabIndex={0}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: "none", cursor: "default" }}
                aria-label={`${b.label}: ${money(b.value)}`}
              >
                <rect x={margin.left + band * i} y={margin.top} width={band} height={ih} fill="transparent" />
                <rect
                  className="ps-grow-y"
                  style={{ "--i": i, transition: "opacity 140ms" }}
                  x={bx(i)}
                  y={sy(b.y1)}
                  width={bw}
                  height={Math.max(2, sy(b.y0) - sy(b.y1))}
                  rx="4"
                  fill={b.color || (b.kind === "out" ? "var(--ps-series-3)" : "var(--ps-ink-2)")}
                  opacity={hover == null || hover === i ? 1 : 0.4}
                />
                {next && next.kind !== "result" && (
                  <line x1={bx(i) + bw} x2={bx(i + 1)} y1={sy(level)} y2={sy(level)} stroke="var(--ps-border-strong)" strokeDasharray="3 3" />
                )}
                {!narrow && (
                  <text className="ps-axis-label ps-fade-in" x={bx(i) + bw / 2} y={sy(b.y1) - 7} textAnchor="middle" fill="var(--ps-ink-2)">
                    {b.kind === "out" ? `−${moneyShort(b.value)}` : moneyShort(b.value)}
                  </text>
                )}
                <text
                  className="ps-axis-label"
                  x={bx(i) + bw / 2}
                  y={height - (narrow ? 40 : 10)}
                  textAnchor={narrow ? "end" : "middle"}
                  transform={narrow ? `rotate(-40 ${bx(i) + bw / 2} ${height - 40})` : undefined}
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && width > 0 && (
        <Tooltip
          x={bx(hover) + bw / 2}
          y={margin.top}
          width={width}
          title={bars[hover].label}
          rows={[
            { label: "per month", value: money(bars[hover].value), color: bars[hover].color },
            ...(base ? [{ label: "of income", value: `${((bars[hover].value / base) * 100).toFixed(0)}%` }] : []),
          ]}
        />
      )}
    </div>
  );
}

// ---------- Donut ----------

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/** data: [{ key, label, value, color }]. `active`/`onActive` let a legend list share the hover. */
export function Donut({ data, size = 220, active, onActive, centerTitle, centerValue }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const c = size / 2;
  const r1 = c - 6;
  const r0 = r1 - 26;
  let angle = -Math.PI / 2;
  const gap = 0.018;
  const segs = data.map((d) => {
    const span = (d.value / total) * Math.PI * 2;
    const s = { ...d, a0: angle + gap / 2, a1: angle + span - gap / 2 };
    angle += span;
    return s;
  });
  const hovered = segs.find((s) => s.key === active);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerTitle} style={{ maxWidth: "100%", height: "auto" }}>
      <g className="ps-donut-spin" style={{ transformOrigin: "center", transformBox: "fill-box" }}>
        {segs.map((s, i) => (
          <path
            key={s.key}
            d={arc(c, c, r0, s.key === active ? r1 + 4 : r1, s.a0, s.a1)}
            fill={s.color}
            opacity={active == null || s.key === active ? 1 : 0.35}
            style={{ transition: "opacity 160ms, d 160ms", cursor: "default", animationDelay: `${i * 60}ms` }}
            className="ps-fade-in"
            onPointerEnter={() => onActive?.(s.key)}
            onPointerLeave={() => onActive?.(null)}
          />
        ))}
      </g>
      <text x={c} y={c - 8} textAnchor="middle" className="ps-axis-label" style={{ fontSize: 12 }}>
        {hovered ? hovered.label : centerTitle}
      </text>
      <text x={c} y={c + 18} textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: "var(--ps-ink)" }} className="ps-num">
        {hovered ? money(hovered.value) : centerValue}
      </text>
    </svg>
  );
}

// ---------- Progress ring ----------

export function Ring({ value, size = 120, stroke = 10, color = "var(--ps-brand-500)", track = "var(--ps-brand-100)", children, label }) {
  const target = Math.max(0, Math.min(1, value));
  const [shown, setShown] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    // A short timeout (not requestAnimationFrame) so the arc still fills in background tabs.
    const id = setTimeout(() => setShown(target), 30);
    return () => clearTimeout(id);
  }, [target]);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} role="img" aria-label={label}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown)}
          style={{ transition: "stroke-dashoffset 1100ms var(--ps-ease)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

// ---------- Sparkline ----------

export function Sparkline({ values, color = "var(--ps-brand-500)", height = 40 }) {
  const [ref, width] = useSize();
  const id = useId().replace(/:/g, "");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = (i) => 2 + (i / (values.length - 1)) * (width - 4);
  const sy = (v) => 3 + (1 - (v - min) / (max - min || 1)) * (height - 6);
  const d = pathFrom(values.map((v, i) => [sx(i), sy(v)]));
  return (
    <div ref={ref} style={{ height }} aria-hidden>
      {width > 0 && (
        <svg width={width} height={height}>
          <defs>
            <linearGradient id={`s${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d}L${sx(values.length - 1)},${height}L${sx(0)},${height}Z`} fill={`url(#s${id})`} className="ps-fade-in" />
          <path d={d} fill="none" stroke={color} strokeWidth="1.75" pathLength={1} className="ps-draw" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={sx(values.length - 1)} cy={sy(values[values.length - 1])} r="3" fill={color} className="ps-fade-in" />
        </svg>
      )}
    </div>
  );
}

// ---------- 100% stacked bar with a legend list ----------

export function StackedBar({ data, format = money }) {
  const [active, setActive] = useState(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 14, borderRadius: 7, overflow: "hidden" }} onPointerLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <div
            key={d.key}
            className="ps-grow-x"
            onPointerEnter={() => setActive(d.key)}
            title={`${d.label}: ${format(d.value)}`}
            style={{
              flex: `${d.value} 0 0`,
              background: d.color,
              opacity: active == null || active === d.key ? 1 : 0.35,
              transition: "opacity 160ms",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 4 }}>
        {data.map((d) => (
          <li
            key={d.key}
            onPointerEnter={() => setActive(d.key)}
            onPointerLeave={() => setActive(null)}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr auto auto",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              margin: "0 -8px",
              borderRadius: "var(--ps-radius-sm)",
              background: active === d.key ? "var(--ps-surface-sunken)" : "transparent",
              transition: "background 140ms",
            }}
          >
            <span className="ps-legend__rect" style={{ background: d.color }} />
            <span className="ps-body" style={{ color: "var(--ps-ink)" }}>{d.label}</span>
            <span className="ps-num" style={{ fontWeight: 600 }}>{format(d.value)}</span>
            <span className="ps-small ps-num" style={{ width: 40, textAlign: "right" }}>{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
