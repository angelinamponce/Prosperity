import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightOutlined,
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  CreditCardOutlined,
  FormOutlined,
  MenuOutlined,
  RiseOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  AnimatedNumber,
  Badge,
  Legend,
  LineChart,
  LogoMark,
  Ring,
  Slider,
  Sparkline,
  Waterfall,
  money,
  moneyShort,
  pct,
  prefersReducedMotion,
  useReveal,
} from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import { addMonths, buildRecommendations, computeMetrics, gradeBreakdown, monteCarlo, simulatePayoff } from "../dashboard/finance";
import { RecommendationList } from "../dashboard/components";
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

function HeroPreview() {
  const [extra, setExtra] = useState(300);
  const stageRef = useRef(null);
  const base = useMemo(() => simulatePayoff(profile.debts, { extra: 0, rollover: false }), []);
  const plan = useMemo(() => simulatePayoff(profile.debts, { extra }), [extra]);
  const grade = useMemo(() => gradeBreakdown(metrics), []);
  const len = base.balances.length;
  const pad = (xs) => Array.from({ length: len }, (_, i) => xs[i] ?? 0);
  const labels = Array.from({ length: len }, (_, i) => addMonths(NOW, i));
  const h = profile.history;
  const rates = h.income.map((inc, i) => (inc - h.spending[i] - metrics.minDebt) / inc);

  // Floating cards drift a little slower than the page as you scroll.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => stageRef.current?.style.setProperty("--py", String(Math.min(window.scrollY, 800))));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Gentle 3D tilt that follows the pointer.
  const onMove = (e) => {
    if (prefersReducedMotion() || e.pointerType !== "mouse") return;
    const el = stageRef.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
  };
  const onLeave = () => {
    stageRef.current?.style.setProperty("--rx", "0deg");
    stageRef.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="lp-preview" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="lp-preview__stage" ref={stageRef}>
        <div className="ps-card lp-preview__main">
          <div className="lp-preview__head">
            <div>
              <p className="ps-eyebrow">Debt-free by</p>
              <div className="lp-preview__big">
                <AnimatedNumber value={plan.months} format={(v) => addMonths(NOW, Math.round(v))} duration={500} />
              </div>
            </div>
            <Badge tone="positive">Save {money(base.interest - plan.interest)}</Badge>
          </div>
          <div style={{ margin: "4px 0 8px" }}>
            <Legend
              items={[
                { label: "Your plan", color: "var(--ps-brand-500)" },
                { label: "Minimums only", color: "var(--ps-series-muted)", dashed: true },
              ]}
            />
          </div>
          <LineChart
            x={labels}
            series={[
              { key: "base", label: "Minimums only", color: "var(--ps-series-muted)", values: pad(base.balances), dashed: true },
              { key: "plan", label: "Your plan", color: "var(--ps-brand-500)", values: pad(plan.balances) },
            ]}
            height={170}
            ariaLabel="Sample debt balance over time"
          />
          <div style={{ marginTop: 16 }}>
            <Slider label="Extra payment each month" value={extra} min={0} max={1000} step={25} format={money} onChange={setExtra} />
          </div>
        </div>

        <div className="ps-card lp-float lp-float--a" aria-hidden>
          <Ring value={grade.score / 100} size={56} stroke={6}>
            <span style={{ fontWeight: 600 }}>{grade.letter}</span>
          </Ring>
          <div>
            <p className="ps-small">Financial health</p>
            <p className="lp-float__value"><AnimatedNumber value={grade.score} format={(v) => `${Math.round(v)} / 100`} /></p>
          </div>
        </div>

        <div className="ps-card lp-float lp-float--b" aria-hidden>
          <p className="ps-small">Savings rate</p>
          <p className="lp-float__value"><AnimatedNumber value={metrics.savingsRate} format={(v) => pct(v, 1)} /></p>
          <div style={{ width: 150 }}>
            <Sparkline values={rates} height={32} />
          </div>
        </div>
      </div>
      <p className="ps-small lp-preview__note">Live preview with sample numbers. Drag the slider.</p>
    </div>
  );
}

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
            Get started <ArrowRightOutlined />
          </Link>
          <a href="#how-it-works" className="ps-btn ps-btn--secondary lp-btn-lg" onClick={(e) => scrollToId(e, "how-it-works")}>
            See how it works
          </a>
        </div>
        <ul className="lp-checks lp-enter" style={{ "--i": 4 }}>
          {["No bank connection needed", "Advice in plain English", "Built on your own numbers"].map((t) => (
            <li key={t}><CheckOutlined /> {t}</li>
          ))}
        </ul>
        <div className="lp-ask lp-enter" style={{ "--i": 5 }}>
          <SproutMascot variant="full" size={68} mood="wave" />
          <div className="lp-ask__body">
            <p className="lp-ask__bubble">
              Hi, I'm <strong>Sprout</strong>, your AI money guide. Try me on a sample plan:
            </p>
            <SuggestedQuestions questions={SPROUT_STARTERS.slice(0, 2)} label="Try asking Sprout" />
          </div>
        </div>
      </div>
      <div className="lp-enter" style={{ "--i": 2 }}>
        {/* Remounts when the intro ends so the numbers count up and the line draws in view. */}
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

function HowItWorks() {
  const steps = [
    { icon: <FormOutlined />, title: "Tell us about your money", body: "Income, spending, savings and debts. About five short pages, no bank login." },
    { icon: <SwapOutlined />, title: "We do the math", body: "Prosperity calculates your cash flow, health score, payoff dates and long-term outlook." },
    { icon: <BulbOutlined />, title: "Follow your plan", body: "Get ranked next steps and adjust sliders to see how each choice changes your future." },
  ];
  return (
    <section className="lp-section" id="how-it-works">
      <div className="lp-section__head ps-reveal">
        <p className="ps-eyebrow">How it works</p>
        <h2 className="lp-h2">From numbers to a plan in three steps</h2>
      </div>
      <ol className="lp-steps">
        {steps.map((s, i) => (
          <li key={s.title} className="lp-step ps-reveal" style={{ "--i": i }}>
            <div className="lp-step__top">
              <span className="lp-step__icon">{s.icon}</span>
              <span className="lp-step__num">0{i + 1}</span>
            </div>
            <h3 className="ps-h3">{s.title}</h3>
            <p className="ps-body">{s.body}</p>
          </li>
        ))}
      </ol>
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
      <h2 className="lp-cta__title">See your own plan</h2>
      <p className="lp-cta__lede">It takes a few minutes, and you can change any answer later.</p>
      <Link to="/signup" className="ps-btn lp-btn-lg lp-cta__btn">
        Get started <ArrowRightOutlined />
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
