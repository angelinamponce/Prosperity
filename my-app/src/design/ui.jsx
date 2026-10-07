import { useId, useState } from "react";
import { ArrowDownOutlined, ArrowUpOutlined, BarChartOutlined, TableOutlined } from "@ant-design/icons";
import { useCountUp } from "./hooks";

const cx = (...xs) => xs.filter(Boolean).join(" ");

export function Button({ variant = "primary", size, block, loading, icon, iconRight, children, className, disabled, ...rest }) {
  return (
    <button
      type="button"
      className={cx("ps-btn", `ps-btn--${variant}`, size === "sm" && "ps-btn--sm", block && "ps-btn--block", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* Icons are decorative; antd's own aria-label ("arrow-right") would otherwise be read as part of the name. */}
      {loading ? <span className="ps-spinner" aria-hidden /> : icon && <span className="ps-btn__icon" aria-hidden>{icon}</span>}
      {children}
      {!loading && iconRight && <span className="ps-btn__icon" aria-hidden>{iconRight}</span>}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className, hover, as: Tag = "section", ...rest }) {
  return (
    <Tag className={cx("ps-card", hover && "ps-card--hover", className)} {...rest}>
      {(title || actions) && (
        <header className="ps-card__header">
          <div>
            {title && <h2 className="ps-card__title">{title}</h2>}
            {subtitle && <p className="ps-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ps-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

// A card that can switch between its chart and a plain table of the same numbers.
export function ChartCard({ title, subtitle, actions, table, children, ...rest }) {
  const [view, setView] = useState("chart");
  const toggle = table && (
    <Button
      variant="ghost"
      size="sm"
      icon={view === "chart" ? <TableOutlined /> : <BarChartOutlined />}
      onClick={() => setView(view === "chart" ? "table" : "chart")}
      aria-label={view === "chart" ? "Show as table" : "Show as chart"}
    >
      {view === "chart" ? "Table" : "Chart"}
    </Button>
  );
  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={(actions || toggle) && <>{actions}{toggle}</>}
      {...rest}
    >
      {view === "chart" || !table ? children : <DataTable {...table} />}
    </Card>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="ps-table-wrap">
      <table className="ps-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ tone, icon, children, className }) {
  return (
    <span className={cx("ps-badge", tone && `ps-badge--${tone}`, className)}>
      {icon}
      {children}
    </span>
  );
}

// Arrow badge for a change. `goodWhen` says which direction is good news.
export function Delta({ value, format, goodWhen = "up" }) {
  if (!value) return <Badge>No change</Badge>;
  const up = value > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <Badge tone={good ? "positive" : "negative"} icon={up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
      {format(Math.abs(value))}
    </Badge>
  );
}

export function AnimatedNumber({ value, format, duration, className }) {
  const shown = useCountUp(value, duration);
  return (
    <span className={cx("ps-num", className)} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}

export function Segmented({ options, value, onChange, ariaLabel }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="ps-segmented" role="group" aria-label={ariaLabel}>
      <span
        className="ps-segmented__thumb"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        aria-hidden
      />
      {options.map((o) => (
        <button key={o.value} type="button" className="ps-segmented__option" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, hint }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="ps-slider">
      <div className="ps-slider__top">
        <label className="ps-label" htmlFor={id}>{label}</label>
        <span className="ps-slider__value">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--pct": `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
      />
      <div className="ps-slider__range">
        <span>{format(min)}</span>
        {hint && <span>{hint}</span>}
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="ps-skeleton" style={{ height, width, ...style }} aria-hidden />;
}

export function LogoMark({ size = 28 }) {
  // Unique per instance: a gradient defined inside a hidden copy of the logo would not render.
  const gid = `ps-logo-${useId().replace(/:/g, "")}`;
  return (
    <svg className="ps-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden shapeRendering="geometricPrecision">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ps-brand-500)" />
          <stop offset="1" stopColor="var(--ps-brand-700)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <path d="M16 25V14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path className="ps-logo__leaf ps-logo__leaf--r" d="M16 16c0-4.6 3-7.2 7.6-7.2 0 4.6-3 7.2-7.6 7.2Z" fill="#fff" />
      <path className="ps-logo__leaf ps-logo__leaf--l" d="M16 19.5c0-3.7-2.4-5.8-6.1-5.8 0 3.7 2.4 5.8 6.1 5.8Z" fill="#fff" fillOpacity="0.72" />
    </svg>
  );
}
