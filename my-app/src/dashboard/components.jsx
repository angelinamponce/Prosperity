import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircleFilled, CheckOutlined, DownOutlined } from "@ant-design/icons";
import { AnimatedNumber, Badge, Button, Delta, Skeleton, Sparkline, Sprout } from "../design";
import { useGame } from "../game/store";
import { XP } from "../game/rules";

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

// "I did this" for a recommendation's habit. Honor system: +XP once, and undo takes it back.
// Visitors without an account can still use missions; they're told it's saved in this browser only.
function GuestNote({ tab }) {
  return (
    <p className="ps-small db-mission__guest">
      You're not signed in, so this is saved in this browser only.{" "}
      <Link to="/signup" tabIndex={tab}>Create a free account</Link> to keep your progress anywhere.
    </p>
  );
}

function MissionToggle({ rec, game, focusable }) {
  const done = game.progress.missions[rec.id]?.done;
  const tab = focusable ? 0 : -1;
  const guest = game.id === "guest";
  if (done) {
    return (
      <div className="db-mission is-done">
        <span className="db-mission__label">
          <CheckCircleFilled aria-hidden /> Done: “{rec.habit}”
        </span>
        <button type="button" className="db-mission__undo" tabIndex={tab} onClick={() => game.dispatch({ type: "undoMission", id: rec.id })}>
          Undo
        </button>
        {guest && <GuestNote tab={tab} />}
      </div>
    );
  }
  return (
    <div className="db-mission">
      <Button variant="secondary" size="sm" icon={<CheckOutlined />} tabIndex={tab} onClick={() => game.dispatch({ type: "completeMission", id: rec.id, title: rec.title })}>
        I did this
      </Button>
      <span className="ps-small">“{rec.habit}” · +{XP.mission} XP · honor system</span>
      {guest && <GuestNote tab={tab} />}
    </div>
  );
}

// Accordion of recommendations. One open at a time; the height animates.
// Inside the dashboard each one is also a mission the player can mark done.
export function RecommendationList({ recs, openId, onToggle, go }) {
  const game = useGame();
  return (
    <ol className="db-recs">
      {recs.map((r, i) => {
        const open = r.id === openId;
        return (
          <li key={r.id} className={`db-rec${open ? " is-open" : ""}`}>
            <button type="button" className="db-rec__head" aria-expanded={open} onClick={() => onToggle(open ? null : r.id)}>
              <span className="db-rec__num">{i + 1}</span>
              <span className="db-rec__title">{r.title}</span>
              {game?.ready && game.progress.missions[r.id]?.done && <Badge tone="positive" icon={<CheckOutlined />}>Done</Badge>}
              <Badge tone="brand" className="db-rec__impact">{r.impact}</Badge>
              <DownOutlined className="db-rec__chevron" />
            </button>
            <div className="db-rec__body" aria-hidden={!open}>
              <div>
                <p className="ps-body">{r.because}</p>
                <Button variant="secondary" size="sm" onClick={() => go(r.page)} tabIndex={open ? 0 : -1}>
                  Open planner
                </Button>
                {game?.ready && r.habit && <MissionToggle rec={r} game={game} focusable={open} />}
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
