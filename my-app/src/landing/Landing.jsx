import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightOutlined,
  BulbOutlined,
  CalculatorOutlined,
  CheckOutlined,
  CloseOutlined,
  CommentOutlined,
  CreditCardOutlined,
  DownOutlined,
  FormOutlined,
  MenuOutlined,
  RiseOutlined,
  SafetyOutlined,
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
  prefersReducedMotion,
  useReveal,
} from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import { addMonths, buildRecommendations, computeMetrics, monteCarlo, simulatePayoff } from "../dashboard/finance";
import { RecommendationList } from "../dashboard/components";
import { debtFreeSummary, humanDuration } from "../dashboard/summaries";
import HeroGarden from "./HeroGarden";
import Intro, { shouldPlayIntro } from "./Intro";
import { SproutChat, SproutLauncher, SproutMascot, SproutProvider, SuggestedQuestions } from "../sprout";
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

const TRUST = [
  { icon: <SafetyOutlined />, text: "No bank connection needed" },
  { icon: <CalculatorOutlined />, text: "Advice that shows its work" },
  { icon: <CommentOutlined />, text: "Plain English, no jargon" },
];

function Hero({ ready }) {
  return (
    <section className="lp-hero">
      <div className="lp-hero__copy">
        <Badge tone="brand" className="lp-enter" >Built at HackMIT 2025</Badge>
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
            <li key={t.text}><span aria-hidden>{t.icon}</span> {t.text}</li>
          ))}
        </ul>
        <div className="lp-ask lp-enter" style={{ "--i": 5 }}>
          <SproutMascot variant="full" size={68} mood="wave" />
          <div className="lp-ask__body">
            <p className="lp-ask__bubble">
              Hi, I'm <strong>Sprout</strong>! Money stuff can feel like a lot. Let's take it one small step at a time.
            </p>
            <SuggestedQuestions questions={SPROUT_STARTERS.slice(0, 2)} label="Try asking Sprout about the sample plan" />
          </div>
        </div>
      </div>
      <div className="lp-enter" style={{ "--i": 2 }}>
        <HeroPreview key={ready ? "ready" : "waiting"} />
      </div>
    </section>
  );
}

// ---------- Feature showcase (auto-advancing tabs) ----------

const ROTATE_MS = 7000;

function ShowcasePreview({ which }) {
  const recs = useMemo(() => buildRecommendations(profile, metrics, { extraDebt: 300 }), []);
  const [openId, setOpenId] = useState(recs[0]?.id);

  if (which === "cash") {
    const steps = [
      { key: "income", label: "Income", value: metrics.income, kind: "total", color: "var(--ps-ink-2)" },
      ...profile.expenses.map((e) => ({ key: e.key, label: e.short, value: e.monthly, kind: "out", color: `var(--ps-series-${e.slot})` })),
      { key: "debt", label: "Debt", value: metrics.minDebt, kind: "out", color: "var(--ps-series-muted)" },
      { key: "left", label: "Left over", value: metrics.surplus, kind: "result", color: "var(--ps-brand-700)" },
    ];
    return <Waterfall steps={steps} base={metrics.income} height={300} ariaLabel="Sample monthly cash flow" />;
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
        height={300}
        ariaLabel="Sample debt payoff comparison"
      />
    );
  }
  if (which === "future") {
    const sim = monteCarlo({ start: metrics.invested, monthly: 800, stockShare: 0.8, years: 34, goal: metrics.fiNumber });
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
        height={300}
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

function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (paused || touched || prefersReducedMotion()) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [active, paused, touched]);

  const f = FEATURES[active];
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
              type="button"
              role="tab"
              aria-selected={i === active}
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
        <div className="ps-card lp-showcase__panel" role="tabpanel" aria-label={f.title}>
          <div className="lp-showcase__panel-head">
            <span className="ps-h3">{f.title}</span>
            <Badge>Sample</Badge>
          </div>
          <div key={f.key} className="lp-showcase__swap">
            <ShowcasePreview which={f.key} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- How it works ----------

// A three-stop path: each step grows Sprout a little, the same way the app does.
function HowItWorks() {
  const steps = [
    { stage: "seed", icon: <FormOutlined />, tag: "A few minutes", title: "Plant a seed", body: "Tell us about your income, spending, savings and debts. About five short pages, no bank login." },
    { stage: "sprout", icon: <SwapOutlined />, tag: "Instant", title: "Watch it sprout", body: "We do the math: your cash flow, health score, debt-free date and long-term outlook." },
    { stage: "tree", icon: <BulbOutlined />, tag: "At your pace", title: "Grow your plan", body: "Follow ranked next steps, learn the money words as you go, and watch Sprout grow with you." },
  ];
  return (
    <section className="lp-section" id="how-it-works">
      <div className="lp-section__head ps-reveal">
        <p className="ps-eyebrow">How it works</p>
        <h2 className="lp-h2">Three small steps to your plan</h2>
        <p className="lp-section__lede">Every step is short, and you can stop and pick up again anytime.</p>
      </div>
      <div className="lp-quest">
        <svg className="lp-quest__path" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden>
          <path d="M100 40 C 200 40, 200 88, 300 88 S 400 40, 500 40" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol className="lp-quest__list">
          {steps.map((s, i) => (
            <li key={s.title} className="lp-quest__stop ps-reveal" style={{ "--i": i }}>
              <span className="lp-quest__node">
                <StageIcon stage={s.stage} size={44} />
              </span>
              <div className="lp-quest__text">
                <p className="lp-quest__meta">
                  <span className="ps-eyebrow">Step {i + 1}</span>
                  <span className="lp-quest__tag">{s.icon} {s.tag}</span>
                </p>
                <h3 className="ps-h3">{s.title}</h3>
                <p className="ps-body">{s.body}</p>
              </div>
            </li>
          ))}
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
  return (
    <SproutProvider scope="landing" getContext={() => ({ profile, plan: DEMO_PLAN, demo: true })}>
      <div className="ps-root lp" ref={revealRef} data-intro={introPhase}>
        {introPhase !== "done" && <Intro phase={introPhase} onPhase={setIntroPhase} targetRef={logoRef} />}
        <Nav logoRef={logoRef} />
        <main>
          <Hero ready={introPhase !== "playing"} />
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
        {introPhase === "done" && <SproutLauncher greeting="Hi! I'm Sprout. Want to see how a plan works?" />}
        <SproutChat starters={SPROUT_STARTERS} />
      </div>
    </SproutProvider>
  );
}
