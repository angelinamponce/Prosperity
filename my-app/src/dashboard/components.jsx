import { useState } from "react";
import { DownOutlined } from "@ant-design/icons";
import { AnimatedNumber, Badge, Button, Delta, Skeleton, Sparkline, Sprout } from "../design";

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="db-header">
      <div>
        {eyebrow && <p className="ps-eyebrow">{eyebrow}</p>}
        <h1 className="ps-h1">{title}</h1>
        {description && <p className="ps-body db-header__desc">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatTile({ label, value, format, delta, deltaFormat, goodWhen, note, trend, index = 0 }) {
  return (
    <div className="ps-card ps-card--hover db-stat ps-enter" style={{ "--i": index }}>
      <p className="ps-label">{label}</p>
      <div className="db-stat__value">
        <AnimatedNumber value={value} format={format} />
      </div>
      <div className="db-stat__meta">
        {delta !== undefined && <Delta value={delta} format={deltaFormat ?? format} goodWhen={goodWhen} />}
        {note && <span className="ps-small">{note}</span>}
      </div>
      {trend && (
        <div className="db-stat__spark">
          <Sparkline values={trend} />
        </div>
      )}
    </div>
  );
}

// Accordion of recommendations. One open at a time; the height animates.
export function RecommendationList({ recs, openId, onToggle, go }) {
  return (
    <ol className="db-recs">
      {recs.map((r, i) => {
        const open = r.id === openId;
        return (
          <li key={r.id} className={`db-rec${open ? " is-open" : ""}`}>
            <button type="button" className="db-rec__head" aria-expanded={open} onClick={() => onToggle(open ? null : r.id)}>
              <span className="db-rec__num">{i + 1}</span>
              <span className="db-rec__title">{r.title}</span>
              <Badge tone="brand" className="db-rec__impact">{r.impact}</Badge>
              <DownOutlined className="db-rec__chevron" />
            </button>
            <div className="db-rec__body" aria-hidden={!open}>
              <div>
                <p className="ps-body">{r.because}</p>
                <Button variant="secondary" size="sm" onClick={() => go(r.page)} tabIndex={open ? 0 : -1}>
                  Open planner
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const LOADING_LINES = ["Gathering your numbers…", "Planting the seeds of your plan…", "Tidying up your charts…"];

export function PageSkeleton() {
  const [line] = useState(() => LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)]);
  return (
    <div aria-busy="true">
      <p className="db-loading" role="status">
        <Sprout size={28} className="ps-sprout--sway" />
        {line}
      </p>
      <Skeleton height={14} width={120} />
      <Skeleton height={36} width={320} style={{ marginTop: 12 }} />
      <Skeleton height={16} width={420} style={{ marginTop: 12, maxWidth: "100%" }} />
      <div className="db-grid" style={{ marginTop: 32 }}>
        <div className="span-8"><Skeleton height={320} /></div>
        <div className="span-4"><Skeleton height={320} /></div>
      </div>
    </div>
  );
}

// Friendly placeholder for a section with nothing to show yet.
export function EmptyState({ title, children, action }) {
  return (
    <div className="db-empty ps-enter">
      <Sprout size={56} className="ps-sprout--sway" />
      <h2 className="ps-h2">{title}</h2>
      {children && <p className="ps-body">{children}</p>}
      {action}
    </div>
  );
}
