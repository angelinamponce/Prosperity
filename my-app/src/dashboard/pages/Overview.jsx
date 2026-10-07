import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { AnimatedNumber, Button, Card, ChartCard, Delta, LineChart, Ring, Sprout, StackedBar, money, moneyShort, pct, useCelebration } from "../../design";
import { buildRecommendations, gradeBreakdown } from "../finance";
import { EmptyState, PageHeader, RecommendationList, StatTile } from "../components";
import { SuggestedQuestions } from "../../sprout";
import { Explain } from "../glossary";

const MILESTONE_KEY = "prosperity.celebrated.emergency";

// Shows the biggest emergency-fund milestone reached, with a leaf burst the first time per session.
function MilestoneBanner({ months, celebrate }) {
  const ref = useRef(null);
  const reached = [6, 3, 1].find((t) => months >= t);
  useEffect(() => {
    if (!reached) return undefined;
    let seen = true;
    try {
      seen = sessionStorage.getItem(MILESTONE_KEY) === String(reached);
    } catch {
      // No storage: skip the automatic burst rather than repeat it on every visit.
    }
    if (seen) return undefined;
    // Marked as seen only when it actually fires, so React's dev double-run can't swallow it.
    const id = setTimeout(() => {
      try {
        sessionStorage.setItem(MILESTONE_KEY, String(reached));
      } catch {
        // ignore
      }
      celebrate({ message: `Milestone reached: ${reached} months of essentials saved.`, origin: ref.current });
    }, 900);
    return () => clearTimeout(id);
  }, [reached, celebrate]);
  if (!reached) return null;
  const nextGoal = reached < 6 ? `You're ${Math.round((months / 6) * 100)}% of the way to a full six-month cushion.` : "You've built a full six-month cushion.";
  return (
    <div className="db-milestone ps-enter" ref={ref}>
      <Sprout size={52} className="ps-sprout--sway" />
      <div className="db-milestone__text">
        <p className="db-milestone__title">
          You've saved {reached} {reached === 1 ? "month" : "months"} of essentials
        </p>
        <p className="ps-small">That's a real safety net. {nextGoal}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => celebrate({ message: "Every dollar saved is a seed planted.", origin: ref.current })}>
        Celebrate
      </Button>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Overview({ profile, metrics: m, plan, go }) {
  const grade = useMemo(() => gradeBreakdown(m), [m]);
  const recs = useMemo(() => buildRecommendations(profile, m, plan), [profile, m, plan]);
  const [openId, setOpenId] = useState(recs[0]?.id ?? null);
  const { celebrate, celebration } = useCelebration();
  const h = profile.history;
  const last = h.months.length - 1;
  // Real survey data is a single snapshot, so month-over-month changes only show once there's history.
  const hasHistory = h.months.length >= 2;
  const change = (series) => (hasHistory ? series[last] - series[last - 1] : undefined);
  const changeNote = hasHistory ? "vs last month" : "from your survey answers";
  const savingsRates = h.income.map((inc, i) => (inc ? (inc - h.spending[i] - m.minDebt) / inc : 0));
  const askQuestions = [
    profile.retirement.unknown ? "What should I focus on first?" : "Why is the 401(k) match first?",
    profile.debts.length ? "What if I pay $300 extra on my debt?" : "How big should my emergency fund be?",
    "Explain my health score",
  ];
  const lowest = [...grade.parts].sort((a, b) => a.score - b.score).slice(0, 2).map((p) => p.key);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const showNextStep = () => {
    setOpenId(recs[0]?.id ?? null);
    document.getElementById("next-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={profile.name ? `${greeting()}, ${profile.name.split(" ")[0]}` : `${greeting()}!`}
        description="Here's a friendly look at where you stand, plus a few small steps that will make the biggest difference."
        action={<Button iconRight={<ArrowRightOutlined />} onClick={showNextStep}>Show me my next step</Button>}
      />

      <MilestoneBanner months={m.emergencyMonths} celebrate={celebrate} />

      <div className="db-grid">
        <ChartCard
          className="span-8 ps-enter"
          title={<Explain k="netWorth" />}
          subtitle="Everything you own, minus everything you owe"
          table={{ columns: ["Month", "Net worth"], rows: h.months.map((mo, i) => [mo, money(h.netWorth[i])]) }}
        >
          <div className="db-hero__value ps-display">
            <AnimatedNumber value={m.netWorth} format={money} duration={1400} />
          </div>
          {hasHistory ? (
            <>
              <div className="db-hero__meta">
                <Delta value={h.netWorth[last] - h.netWorth[0]} format={money} />
                <span className="ps-small">over the past {h.months.length} months</span>
              </div>
              <LineChart
                x={h.months}
                series={[{ key: "nw", label: "Net worth", color: "var(--ps-brand-500)", values: h.netWorth }]}
                area
                height={250}
                ariaLabel={`Net worth over the past ${h.months.length} months`}
              />
            </>
          ) : (
            <p className="ps-body db-hero__meta">
              This is your starting point. As your numbers change month to month, your net worth line will grow right here.
            </p>
          )}
        </ChartCard>

        <Card data-tour="grade" className="span-4 ps-enter" style={{ "--i": 1 }} title={<Explain k="healthScore">Financial health</Explain>} subtitle="A quick check-up on six healthy money habits">
          <div className="db-health">
            <div className="db-health__top">
              <Ring value={grade.score / 100} size={108} stroke={9} label={`Score ${Math.round(grade.score)} out of 100`}>
                <div>
                  <div className="db-health__letter">{grade.letter}</div>
                </div>
              </Ring>
              <div>
                <div className="db-big">
                  <AnimatedNumber value={grade.score} format={(v) => Math.round(v).toString()} />
                  <span className="ps-small" style={{ fontSize: 16, fontWeight: 500 }}> / 100</span>
                </div>
                <p className="ps-small" style={{ marginTop: 4 }}>You're doing well! A little progress on the two amber areas would bump you up a grade.</p>
              </div>
            </div>
            <ul className="db-health__parts">
              {grade.parts.map((p, i) => (
                <li key={p.key} className="db-part">
                  <span style={{ color: "var(--ps-ink)" }}>{p.label}</span>
                  <span className="ps-num ps-small">{Math.round(p.score)}</span>
                  <div className="db-part__bar">
                    <div
                      className={`db-part__fill${lowest.includes(p.key) ? " is-low" : ""}`}
                      style={{ width: `${Math.max(2, p.score)}%`, animationDelay: `${300 + i * 70}ms` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="db-stats">
        <StatTile
          index={2}
          label="Monthly income"
          value={m.income}
          format={money}
          delta={change(h.income)}
          note={changeNote}
          trend={hasHistory ? h.income : undefined}
        />
        <StatTile
          index={3}
          label="Monthly spending"
          value={m.expenses}
          format={money}
          delta={change(h.spending)}
          goodWhen="down"
          note={changeNote}
          trend={hasHistory ? h.spending : undefined}
        />
        <StatTile
          index={4}
          label={<Explain k="savingsRate" />}
          value={m.savingsRate}
          format={(v) => pct(v, 1)}
          delta={change(savingsRates)}
          deltaFormat={(v) => `${(v * 100).toFixed(1)} pts`}
          note={changeNote}
          trend={hasHistory ? savingsRates : undefined}
        />
        <StatTile
          index={5}
          label={<Explain k="emergencyFund" />}
          value={m.emergencyMonths}
          format={(v) => `${v.toFixed(1)} mo`}
          note={`${money(m.emergencyBalance)} saved · goal is 6 months`}
          trend={hasHistory ? h.emergencyMonths : undefined}
        />
      </div>

      <div className="db-grid">
        <Card id="next-steps" className="span-7 ps-enter" style={{ "--i": 6, scrollMarginTop: 80 }} title="Your next steps" subtitle="Small, doable moves, starting with the one that helps most">
          {recs.length ? (
            <RecommendationList recs={recs} openId={openId} onToggle={setOpenId} go={go} />
          ) : (
            <EmptyState title="You're in great shape">Nothing urgent to work on right now. Keep doing what you're doing!</EmptyState>
          )}
          <div className="db-ask">
            <p className="ps-small">Not sure where to start? Ask Sprout:</p>
            <SuggestedQuestions
              questions={askQuestions}
              label="Questions for Sprout about your next steps"
            />
          </div>
        </Card>
        <Card
          className="span-5 ps-enter"
          style={{ "--i": 7 }}
          title={<Explain k="surplus">Where your extra money goes</Explain>}
          subtitle={
            m.surplus > 0
              ? `You have ${money(m.surplus)} left each month after bills and minimum debt payments. ${
                  profile.allocationSuggested ? "Here's a suggested split to start with." : "Here's how it's split."
                }`
              : "Right now your bills and payments use up all of your income."
          }
        >
          {profile.allocation.length ? (
            <StackedBar
              data={profile.allocation.map((a) => ({ key: a.key, label: a.name, value: a.monthly, color: `var(--ps-series-${a.slot})` }))}
              format={(v) => `${moneyShort(v)}/mo`}
            />
          ) : (
            <div>
              <p className="ps-body">That's more common than you'd think, and small changes add up fast. The Cash flow page shows where each dollar goes and lets you try a trim.</p>
              <Button variant="secondary" size="sm" iconRight={<ArrowRightOutlined />} onClick={() => go("cash-flow")} style={{ marginTop: 12 }}>
                See my cash flow
              </Button>
            </div>
          )}
        </Card>
      </div>
      {celebration}
    </>
  );
}
