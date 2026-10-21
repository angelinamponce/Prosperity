import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightOutlined,
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  CreditCardOutlined,
  DownOutlined,
  FlagOutlined,
  FormOutlined,
  MenuOutlined,
  RiseOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Legend,
  LineChart,
  LogoMark,
  Slider,
  StageIcon,
  Waterfall,
  money,
  moneyShort,
  pct,
  prefersReducedMotion,
  useReveal,
} from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import { addMonths, buildRecommendations, computeMetrics, monteCarlo, simulatePayoff } from "../dashboard/finance";
import { RecommendationList } from "../dashboard/components";
import { debtFreeSummary, humanDuration } from "../dashboard/summaries";
import HeroGarden from "./HeroGarden";
import { XP } from "../game/rules";
import { FoeSprite } from "../battle/sprites";
import { FOES } from "../battle/foes";
import Intro, { shouldPlayIntro } from "./Intro";
import { SproutChat, SproutLauncher, SproutMascot, SproutProvider, useSprout } from "../sprout";
import { HeroBackdrop } from "./HeroBackdrop";
import { PixelArt } from "../world/PixelArt";
import { SPROUT_FRONT, SPROUT_PALETTE } from "../world/sprites";
import "./landing.css";

const profile = sampleProfile;
// Visitors who haven't signed up talk to Sprout about the sample plan.
const DEMO_PLAN = { extraDebt: 300, strategy: "avalanche", trim: 0, monthlyInvest: 800, investYears: 30, stockShare: 0.8, retireAge: 60 };
const SPROUT_STARTERS = [
  "What's the debt-free date if I add $200 a month?",
  "How does Prosperity build a plan?",
  "Is this financial advice?",
];
const metrics = computeMetrics(profile);
const NOW = new Date();
const SLIDER_MAX = 1000;

function scrollToId(e, id) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

// ---------- Nav ----------

function Nav({ logoRef }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    ["features", "Features"],
    ["how-it-works", "How it works"],
    ["about", "About"],
  ];
  return (
    <header className={`lp-nav${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
      <div className="lp-nav__inner">
        <Link to="/" className="lp-logo">
          <span className="lp-logo__mark" ref={logoRef}>
            <LogoMark />
          </span>
          Prosperity
        </Link>
        <nav className="lp-nav__links" aria-label="Main">
          {links.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { scrollToId(e, id); setOpen(false); }}>
              {label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__actions">
          <Link to="/login" className="ps-btn ps-btn--ghost">Log in</Link>
          <Link to="/signup" className="ps-btn ps-btn--primary">Get started</Link>
        </div>
        <button type="button" className="lp-nav__toggle ps-btn ps-btn--ghost" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>
      <div className="lp-nav__sheet">
        {links.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { scrollToId(e, id); setOpen(false); }}>
            {label}
          </a>
        ))}
        <Link to="/login" className="ps-btn ps-btn--secondary ps-btn--block">Log in</Link>
        <Link to="/signup" className="ps-btn ps-btn--primary ps-btn--block">Get started</Link>
      </div>
    </header>
  );
}

// ---------- Hero ----------

// What Sprout says as the slider moves. Encourages any extra amount, and reminds people not to overstretch.
function sproutLine(extra, monthsSaved) {
  if (extra === 0) return { tier: 0, mood: "idle", text: "Minimums still get you there. Slide to see what a little extra does." };
  const sooner = monthsSaved > 0 ? `about ${humanDuration(monthsSaved)} sooner` : "sooner";
  if (extra < 300) return { tier: 1, mood: "cheer", text: `Even ${money(extra)} a month gets you there ${sooner}. Small steps count!` };
  if (extra < 700) return { tier: 2, mood: "cheer", text: "Look at that garden grow. Nice momentum!" };
  return { tier: 3, mood: "cheer", text: "Big jump! Only add what fits your budget comfortably, though." };
}

// Repeats `text` to screen readers once the slider settles, instead of on every step.
function useSettledAnnouncement(text, delay = 800) {
  const [spoken, setSpoken] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const id = setTimeout(() => setSpoken(text), delay);
    return () => clearTimeout(id);
  }, [text, delay]);
  return spoken;
}

// One plain sentence first; the exact dates, interest and chart are one tap away.
function HeroPreview() {
  const [extra, setExtra] = useState(300);
  const [showNumbers, setShowNumbers] = useState(false);
  const numbersId = useId();
  const summary = useMemo(() => debtFreeSummary(profile.debts, { extra, now: NOW }), [extra]);
  const base = useMemo(() => simulatePayoff(profile.debts, { extra: 0, rollover: false }), []);
  const plan = useMemo(() => simulatePayoff(profile.debts, { extra }), [extra]);
  const len = base.balances.length;
  const pad = (xs) => Array.from({ length: len }, (_, i) => xs[i] ?? 0);
  const labels = Array.from({ length: len }, (_, i) => addMonths(NOW, i));
  const sooner = summary.monthsSooner ?? 0;
  const line = sproutLine(extra, sooner);
  const spoken = useSettledAnnouncement(`${summary.sentence} ${line.text}`);
  // The patch shows the time the extra payment saves: bare seeds at $0 extra, fully grown at the slider's maximum.
  const range = useMemo(
    () => [0, SLIDER_MAX].map((e) => base.months - simulatePayoff(profile.debts, { extra: e }).months),
    [base]
  );
  const growth = Math.max(0, Math.min(1, (sooner - range[0]) / (range[1] - range[0] || 1)));

  return (
    <div className="lp-preview">
      <div className="ps-card lp-preview__main">
        <div className="lp-preview__head">
          <Badge>Sample plan</Badge>
          <span className="ps-small">{money(metrics.totalDebt)} of debt across {profile.debts.length} loans</span>
        </div>
        <p className="lp-preview__sentence">{summary.sentence}</p>
        <HeroGarden growth={growth} />
        <Slider label="Extra payment each month" value={extra} min={0} max={SLIDER_MAX} step={25} format={money} onChange={setExtra} />
        <div className="lp-react">
          {/* Remounting on a new tier replays the cheer. */}
          <SproutMascot key={line.tier} variant="head" size={44} mood={line.mood} />
          <p className="lp-react__bubble" aria-hidden>{line.text}</p>
          <span className="ps-sr-only" aria-live="polite">{spoken}</span>
        </div>
        <button type="button" className="lp-numbers-btn" aria-expanded={showNumbers} aria-controls={numbersId} onClick={() => setShowNumbers((v) => !v)}>
          {showNumbers ? "Hide the numbers" : "Show the numbers"}
          <DownOutlined aria-hidden className="lp-numbers-btn__icon" />
        </button>
        <div id={numbersId} className="lp-numbers" hidden={!showNumbers}>
          {showNumbers && (
            <>
              <dl className="lp-numbers__list">
                <div><dt>Debt-free on this plan</dt><dd>{summary.plan.date}</dd></div>
                <div><dt>With minimums only</dt><dd>{summary.base.date}</dd></div>
                <div><dt>Interest saved</dt><dd>{money(summary.interestSaved)}</dd></div>
              </dl>
              <p className="ps-small">
                “This plan” pays every minimum plus {money(extra)} extra a month, highest interest first, and moves each paid-off debt's payment to the next one.
              </p>
              <Legend
                items={[
                  { label: "This plan", color: "var(--ps-brand-500)" },
                  { label: "Minimums only", color: "var(--ps-series-muted)", dashed: true },
                ]}
              />
              <LineChart
                x={labels}
                series={[
                  { key: "base", label: "Minimums only", color: "var(--ps-series-muted)", values: pad(base.balances), dashed: true },
                  { key: "plan", label: "This plan", color: "var(--ps-brand-500)", values: pad(plan.balances) },
                ]}
                height={170}
                ariaLabel="Sample debt balance over time"
              />
            </>
          )}
        </div>
      </div>
      <p className="ps-small lp-preview__note">Sample numbers, not yours. Drag the slider to try it.</p>
    </div>
  );
}

const TRUST = ["No bank connection needed", "Advice that shows its work", "Plain English, no jargon"];

/**
 * Sprout, standing in the meadow: the page's one way into the chat while the hero is on screen.
 * Reports whether it's visible so the floating chat button can wait until it scrolls away.
 */
function MeadowSprout({ onVisible }) {
  const { open, setOpen, launcherRef } = useSprout();
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => onVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);
  return (
    <div className="lp-sprout" ref={ref}>
      <button
        type="button"
        className="lp-sprout__btn"
        ref={(el) => {
          // While it's on screen, the chat hands focus back here when it closes.
          if (el) launcherRef.current = el;
        }}
        aria-label="Talk to Sprout, your money guide"
        aria-expanded={open}
        aria-controls="sprout-panel"
        onClick={() => setOpen(!open)}
      >
        <PixelArt rows={SPROUT_FRONT} palette={SPROUT_PALETTE} size={64} />
      </button>
      <p className="lp-sprout__bubble">Hi, I'm Sprout! Let's take it one small step at a time.</p>
    </div>
  );
}

function Hero({ ready, onSproutVisible }) {
  return (
    <section className="lp-hero">
      <HeroBackdrop />
      <div className="lp-hero__inner">
        <div className="lp-hero__copy">
          <h1 className="lp-hero__title lp-enter" style={{ "--i": 1 }}>
            Your money,<br />
            <span className="lp-accent">finally clear.</span>
          </h1>
          <p className="lp-hero__lede lp-enter" style={{ "--i": 2 }}>
            Answer a short survey and Prosperity turns your numbers into a plan: where your money goes, the fastest way out of debt, and what your future could look like.
          </p>
          <div className="lp-hero__ctas lp-enter" style={{ "--i": 3 }}>
            <Link to="/signup" className="ps-btn ps-btn--primary lp-btn-lg">
              Plant your first seed <ArrowRightOutlined />
            </Link>
            <a href="#how-it-works" className="ps-btn ps-btn--secondary lp-btn-lg" onClick={(e) => scrollToId(e, "how-it-works")}>
              See how it works
            </a>
          </div>
          <ul className="lp-trust lp-enter" style={{ "--i": 4 }} aria-label="Why people trust Prosperity">
            {TRUST.map((t) => (
              <li key={t}>
                <CheckOutlined aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-enter" style={{ "--i": 2 }}>
          <HeroPreview key={ready ? "ready" : "waiting"} />
        </div>
      </div>
      <MeadowSprout onVisible={onSproutVisible} />
    </section>
  );
}

// ---------- Feature showcase (auto-advancing tabs) ----------

const ROTATE_MS = 7000;
const FUTURE = { monthly: 800, stockShare: 0.8, toAge: 60 };

// The simulation is the heaviest thing on the page, so it runs once, the first time the Future tab shows.
let futureSim = null;
function getFutureSim() {
  futureSim ??= monteCarlo({
    start: metrics.invested,
    monthly: FUTURE.monthly,
    stockShare: FUTURE.stockShare,
    years: FUTURE.toAge - profile.age,
    goal: metrics.fiNumber,
  });
  return futureSim;
}

const roundTo = (v, step) => Math.round(v / step) * step;

// Kept versus spent, as one bar with both numbers written on it.
function KeepBar() {
  const spent = metrics.income - metrics.surplus;
  const keptShare = metrics.surplus / metrics.income;
  return (
    <div className="lp-keep" role="img" aria-label={`Of ${money(metrics.income)} a month, about ${money(spent)} is spent and ${money(metrics.surplus)} is kept.`}>
      <span className="lp-keep__spent" style={{ flexGrow: 1 - keptShare }}>Spent {money(spent)}</span>
      <span className="lp-keep__kept" style={{ flexGrow: keptShare }}>Kept {money(metrics.surplus)}</span>
    </div>
  );
}

// Each debt as a flag on the path, in the order this plan pays them off.
function PayoffFlags() {
  const order = useMemo(() => simulatePayoff(profile.debts, { extra: 300 }).payoffOrder, []);
  return (
    <ol className="lp-flags" aria-label="Payoff order with $300 extra a month">
      {order.map((d) => (
        <li key={d.name}>
          <FlagOutlined aria-hidden />
          <span className="lp-flags__name">{d.name}</span>
          <span className="lp-flags__date">paid off {addMonths(NOW, d.month)}</span>
        </li>
      ))}
    </ol>
  );
}

// Cautious, typical and optimistic results from the simulation, on one line.
function FutureRange() {
  const { bands } = getFutureSim();
  const last = bands.p50.length - 1;
  const lo = bands.p10[last];
  const mid = bands.p50[last];
  const hi = bands.p90[last];
  const at = (v) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <div className="lp-range" role="img" aria-label={`By age ${FUTURE.toAge}: cautious ${moneyShort(lo)}, typical ${moneyShort(mid)}, optimistic ${moneyShort(hi)}.`}>
      <div className="lp-range__track">
        <span className="lp-range__dot" style={{ left: at(lo) }} />
        <span className="lp-range__dot lp-range__dot--mid" style={{ left: at(mid) }} />
        <span className="lp-range__dot" style={{ left: at(hi) }} />
      </div>
      <div className="lp-range__labels" aria-hidden>
        <span>Cautious<br /><strong>{moneyShort(lo)}</strong></span>
        <span className="lp-range__mid" style={{ left: `clamp(70px, ${at(mid)}, calc(100% - 70px))` }}>Typical<br /><strong>{moneyShort(mid)}</strong></span>
        <span>Optimistic<br /><strong>{moneyShort(hi)}</strong></span>
      </div>
    </div>
  );
}

// A one-line promise in plain English, worked out from the sample numbers, and a simple picture of it.
function featurePromise(which, recs) {
  if (which === "cash") {
    return {
      line: `You keep about ${money(roundTo(metrics.surplus, 50))} of the ${money(metrics.income)} that comes in each month.`,
      visual: <KeepBar />,
    };
  }
  if (which === "debt") {
    return { line: debtFreeSummary(profile.debts, { extra: 300, now: NOW }).sentence, visual: <PayoffFlags /> };
  }
  if (which === "future") {
    const sim = getFutureSim();
    const typical = sim.bands.p50[sim.bands.p50.length - 1];
    return {
      line: `Investing ${money(FUTURE.monthly)} a month until ${FUTURE.toAge}, a typical result is about ${moneyShort(typical)}. Some futures land lower, some higher.`,
      visual: <FutureRange />,
      note: `Assumes about ${pct(sim.expectedReturn, 1)} average yearly growth after inflation for a mix of ${pct(FUTURE.stockShare)} stocks, with ups and downs. Not a promise.`,
    };
  }
  return { line: `Start with one small move: ${recs[0].title.replace(/ \(.*\)$/, "").toLowerCase()}.`, visual: null };
}

function ShowcasePreview({ which, recs }) {
  const [openId, setOpenId] = useState(recs[0]?.id);

  if (which === "cash") {
    const steps = [
      { key: "income", label: "Income", value: metrics.income, kind: "total", color: "var(--ps-ink-2)" },
      ...profile.expenses.map((e) => ({ key: e.key, label: e.short, value: e.monthly, kind: "out", color: `var(--ps-series-${e.slot})` })),
      { key: "debt", label: "Debt", value: metrics.minDebt, kind: "out", color: "var(--ps-series-muted)" },
      { key: "left", label: "Left over", value: metrics.surplus, kind: "result", color: "var(--ps-brand-700)" },
    ];
    return <Waterfall steps={steps} base={metrics.income} height={260} ariaLabel="Sample monthly cash flow" />;
  }
  if (which === "debt") {
    const base = simulatePayoff(profile.debts, { extra: 0, rollover: false });
    const plan = simulatePayoff(profile.debts, { extra: 300 });
    const pad = (xs) => Array.from({ length: base.balances.length }, (_, i) => xs[i] ?? 0);
    return (
      <LineChart
        x={base.balances.map((_, i) => addMonths(NOW, i))}
        series={[
          { key: "base", label: "Minimums only", color: "var(--ps-series-muted)", values: pad(base.balances), dashed: true },
          { key: "plan", label: "With $300 extra", color: "var(--ps-brand-500)", values: pad(plan.balances) },
        ]}
        height={240}
        ariaLabel="Sample debt payoff comparison"
      />
    );
  }
  if (which === "future") {
    const sim = getFutureSim();
    const { p10, p25, p50, p75, p90 } = sim.bands;
    return (
      <LineChart
        x={p50.map((_, i) => `Age ${profile.age + i}`)}
        series={[{ key: "p50", label: "Typical", color: "var(--ps-brand-600)", values: p50 }]}
        bands={[
          { key: "o", lo: p10, hi: p90, color: "var(--ps-brand-300)", opacity: 0.28 },
          { key: "i", lo: p25, hi: p75, color: "var(--ps-brand-400)", opacity: 0.3 },
        ]}
        ghosts={sim.paths}
        refLines={[{ y: metrics.fiNumber, label: `Financial independence · ${moneyShort(metrics.fiNumber)}` }]}
        height={240}
        ariaLabel="Sample simulated investment outcomes"
        tooltipRows={(i) => [
          { label: "optimistic", value: money(p90[i]) },
          { label: "typical", value: money(p50[i]), color: "var(--ps-brand-600)" },
          { label: "cautious", value: money(p10[i]) },
        ]}
      />
    );
  }
  return <RecommendationList recs={recs} openId={openId} onToggle={setOpenId} go={() => {}} />;
}

const FEATURES = [
  { key: "cash", icon: <SwapOutlined />, title: "See where every dollar goes", body: "Your paycheck, each spending category, and what's left over, in one picture." },
  { key: "debt", icon: <CreditCardOutlined />, title: "Find the fastest way out of debt", body: "Compare payoff strategies and see the date you'll be debt-free change as you adjust." },
  { key: "future", icon: <RiseOutlined />, title: "Explore a range of futures", body: "500 simulated markets show what could happen, not one optimistic guess." },
  { key: "steps", icon: <BulbOutlined />, title: "Get your next best move", body: "Recommendations ranked by impact, each one showing the numbers behind it." },
];

// A one-question practice battle that anyone can try, no account needed.
function BattleTeaser() {
  const foe = FOES.find((f) => f.id === "minimum-mite");
  return (
    <div className="ps-card lp-teaser ps-reveal" style={{ "--i": 2 }}>
      <div className="lp-teaser__scene" aria-hidden>
        <span className="lp-teaser__sprout"><SproutMascot variant="full" size={64} mood="wave" /></span>
        <span className="lp-teaser__vs">VS</span>
        <span className="lp-teaser__foe"><FoeSprite foe={foe} size={64} /></span>
      </div>
      <div className="lp-teaser__text">
        <p className="ps-eyebrow">Quiz Battles</p>
        <h3 className="ps-h3">Try a Quiz Battle</h3>
        <p className="ps-body">
          Help Sprout answer one quick money question and befriend a {foe.name}. No account needed, and wrong answers are just part of learning.
        </p>
      </div>
      <Link to="/app/individual/battle?demo=1" className="ps-btn ps-btn--primary lp-teaser__btn">
        Start a 1-question battle <ArrowRightOutlined />
      </Link>
    </div>
  );
}

function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);
  const recs = useMemo(() => buildRecommendations(profile, metrics, { extraDebt: 300 }), []);
  const baseId = useId();

  useEffect(() => {
    if (paused || touched || prefersReducedMotion()) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [active, paused, touched]);

  const f = FEATURES[active];
  const promise = featurePromise(f.key, recs);
  return (
    <section className="lp-section" id="features">
      <div className="lp-section__head ps-reveal">
        <p className="ps-eyebrow">Features</p>
        <h2 className="lp-h2">Everything about your money, in one calm place</h2>
        <p className="lp-section__lede">Pick a feature to see it working with sample numbers.</p>
      </div>
      <div className="lp-showcase ps-reveal" style={{ "--i": 1 }} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
        <div className="lp-showcase__list" role="tablist" aria-label="Features">
          {FEATURES.map((item, i) => (
            <button
              key={item.key}
              id={`${baseId}-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={`${baseId}-panel`}
              className={`lp-feature${i === active ? " is-active" : ""}`}
              onClick={() => { setActive(i); setTouched(true); }}
            >
              <span className="lp-feature__icon">{item.icon}</span>
              <span>
                <span className="lp-feature__title">{item.title}</span>
                <span className="lp-feature__body">{item.body}</span>
              </span>
              {i === active && !touched && (
                <span
                  key={active}
                  className={`lp-feature__progress${paused ? " is-paused" : ""}`}
                  style={{ animationDuration: `${ROTATE_MS}ms` }}
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>
        <div id={`${baseId}-panel`} className="ps-card lp-showcase__panel" role="tabpanel" aria-labelledby={`${baseId}-tab-${f.key}`}>
          <div className="lp-showcase__panel-head">
            <span className="ps-h3">{f.title}</span>
            <Badge>Sample</Badge>
          </div>
          <div key={f.key} className="lp-showcase__swap">
            <p className="lp-promise">{promise.line}</p>
            {promise.visual}
            {promise.note && <p className="ps-small lp-promise__note">{promise.note}</p>}
            <div className="lp-showcase__chart">
              <ShowcasePreview which={f.key} recs={recs} />
            </div>
          </div>
        </div>
      </div>
      <BattleTeaser />
    </section>
  );
}

// ---------- How it works ----------

// A three-stop path: each step grows Sprout a little, the same way the app does.
// The XP hints are the app's real rewards. Each stop opens to a short description.
const QUEST = [
  { stage: "seed", icon: <FormOutlined />, tag: "A few minutes", xp: `+${XP.surveyDone} XP`, title: "Plant a seed", body: "Tell us about your income, spending, savings and debts. About five short pages, no bank login." },
  { stage: "sprout", icon: <SwapOutlined />, tag: "Instant", xp: `+${XP.tourDone} XP for the tour`, title: "Watch it sprout", body: "We do the math: where your money goes, your health score, your debt-free date and what your future could look like." },
  { stage: "tree", icon: <BulbOutlined />, tag: "At your pace", xp: `+${XP.termLearned} XP per money word`, title: "Grow your plan", body: "Take small steps, learn money words with quick quizzes, and watch Sprout grow with you." },
];

function HowItWorks() {
  const [open, setOpen] = useState(0);
  const baseId = useId();
  return (
    <section className="lp-section" id="how-it-works">
      <div className="lp-section__head ps-reveal">
        <p className="ps-eyebrow">How it works</p>
        <h2 className="lp-h2">Three small steps to your plan</h2>
        <p className="lp-section__lede">Every step is short, and you can stop and pick up again anytime. Tap a step to learn more.</p>
      </div>
      <div className="lp-quest">
        <svg className="lp-quest__path" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden>
          <path d="M100 40 C 200 40, 200 88, 300 88 S 400 40, 500 40" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol className="lp-quest__list">
          {QUEST.map((s, i) => {
            const isOpen = open === i;
            const panel = `${baseId}-step-${i}`;
            return (
              <li key={s.title} className={`lp-quest__stop ps-reveal${isOpen ? " is-open" : ""}`} style={{ "--i": i }}>
                {i === 0 && (
                  <span className="lp-quest__sprout" aria-hidden>
                    <SproutMascot variant="full" size={52} mood="wave" />
                  </span>
                )}
                <button type="button" className="lp-quest__toggle" aria-expanded={isOpen} aria-controls={panel} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span className="lp-quest__node">
                    <StageIcon stage={s.stage} size={44} />
                  </span>
                  <span className="lp-quest__text">
                    <span className="lp-quest__meta">
                      <span className="ps-eyebrow">Step {i + 1}</span>
                      <span className="lp-quest__tag">{s.icon} {s.tag}</span>
                    </span>
                    <span className="ps-h3 lp-quest__title">
                      {s.title}
                      <DownOutlined aria-hidden className="lp-quest__chev" />
                    </span>
                    <span className="lp-quest__xp">{s.xp}</span>
                  </span>
                </button>
                <p id={panel} className="ps-body lp-quest__body" hidden={!isOpen}>{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ---------- About + CTA ----------

function About() {
  const points = [
    ["Advice that shows its work", "Every recommendation cites the numbers it came from, so you can judge it yourself."],
    ["Honest about uncertainty", "Projections show a range of outcomes and say which assumptions they rely on."],
    ["Made for real budgets", "Built for people starting out, paying down loans and figuring out what comes next."],
  ];
  return (
    <section className="lp-section lp-about" id="about">
      <div className="ps-reveal">
        <p className="ps-eyebrow">About</p>
        <Badge tone="brand" className="lp-about__tag">Built at HackMIT 2025</Badge>
        <h2 className="lp-h2">Built at HackMIT to make financial planning feel possible</h2>
        <p className="lp-section__lede" style={{ marginTop: 16 }}>
          Most money advice is generic. Prosperity starts from your own income, spending and goals, and turns them into clear charts and specific next steps.
        </p>
      </div>
      <ul className="lp-points">
        {points.map(([title, body], i) => (
          <li key={title} className="ps-reveal" style={{ "--i": i + 1 }}>
            <span className="lp-points__check"><CheckOutlined /></span>
            <div>
              <h3 className="ps-h3">{title}</h3>
              <p className="ps-body">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="lp-cta ps-reveal">
      <span className="lp-cta__peek" aria-hidden>
        <SproutMascot variant="head" size={72} mood="wave" />
      </span>
      <h2 className="lp-cta__title">Your garden is waiting</h2>
      <p className="lp-cta__lede">Plant your first seed in a few minutes. You can change any answer later.</p>
      <Link to="/signup" className="ps-btn lp-btn-lg lp-cta__btn">
        Plant your first seed <ArrowRightOutlined />
      </Link>
    </section>
  );
}

export default function Landing() {
  const revealRef = useReveal();
  const logoRef = useRef(null);
  const [introPhase, setIntroPhase] = useState(() => (shouldPlayIntro() ? "playing" : "done"));
  // One chat entry point at a time: the floating button waits until the meadow Sprout scrolls away.
  const [sproutInView, setSproutInView] = useState(true);
  const onSproutVisible = useCallback((v) => setSproutInView(v), []);
  return (
    <SproutProvider scope="landing" getContext={() => ({ profile, plan: DEMO_PLAN, demo: true })}>
      <div className="ps-root lp" ref={revealRef} data-intro={introPhase}>
        {introPhase !== "done" && <Intro phase={introPhase} onPhase={setIntroPhase} targetRef={logoRef} />}
        <Nav logoRef={logoRef} />
        <main>
          <Hero ready={introPhase !== "playing"} onSproutVisible={onSproutVisible} />
          <Showcase />
          <HowItWorks />
          <About />
          <CtaBand />
        </main>
        <footer className="lp-footer">
          <Link to="/" className="lp-logo">
            <LogoMark size={24} />
            Prosperity
          </Link>
          <p className="ps-small">© 2025 Prosperity. Built at HackMIT.</p>
          <div className="lp-footer__links">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        </footer>
        {introPhase === "done" && !sproutInView && <SproutLauncher greeting="Hi! I'm Sprout. Want to see how a plan works?" />}
        <SproutChat starters={SPROUT_STARTERS} />
      </div>
    </SproutProvider>
  );
}
