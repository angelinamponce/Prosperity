import { useDeferredValue, useMemo, useRef } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { AnimatedNumber, Button, Card, ChartCard, Legend, LineChart, Ring, Slider, money, moneyShort, pct, useCelebration, useMilestone } from "../../design";
import { monteCarlo } from "../finance";
import { PageHeader } from "../components";
import { Explain } from "../glossary";

export default function Future({ profile, metrics: m, plan, setPlan, go }) {
  const years = Math.max(1, plan.retireAge - profile.age);
  // Deferred so dragging a slider stays smooth while 500 simulations rerun.
  const monthly = useDeferredValue(plan.monthlyInvest);
  const stockShare = useDeferredValue(plan.stockShare);
  const simYears = useDeferredValue(years);
  const sim = useMemo(
    () => monteCarlo({ start: m.invested, monthly, stockShare, years: simYears, goal: m.fiNumber }),
    [m.invested, m.fiNumber, monthly, stockShare, simYears]
  );
  const { p10, p25, p50, p75, p90 } = sim.bands;
  const ages = p50.map((_, i) => `Age ${profile.age + i}`);
  const end = p50.length - 1;

  const ringRef = useRef(null);
  const { celebrate, celebration } = useCelebration();
  useMilestone(sim.successRate, [0.5, 0.75, 0.9], (t) =>
    celebrate({
      message: t >= 0.9 ? "Over 90% odds. Your future self is in great shape." : `Your odds just passed ${pct(t)}. Nice move.`,
      origin: ringRef.current,
    })
  );

  return (
    <>
      <PageHeader
        eyebrow="Future"
        title="What your future could look like"
        description={`Nobody can predict the markets, so we tried 500 different possible futures. Here's where your investments could land by age ${plan.retireAge}, from cautious to hopeful.`}
        action={<Button iconRight={<ArrowRightOutlined />} onClick={() => go("goals")}>Review your goals</Button>}
      />

      <Card data-tour="future-controls" className="ps-enter">
        <div className="db-controls">
          <Slider label="Monthly investing" value={plan.monthlyInvest} min={50} max={3000} step={50} format={money} onChange={(v) => setPlan({ monthlyInvest: v })} />
          <Slider
            label="Invested in stocks"
            value={Math.round(plan.stockShare * 100)}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            hint="rest in bonds"
            onChange={(v) => setPlan({ stockShare: v / 100 })}
          />
          <Slider label="Retire at" value={plan.retireAge} min={Math.max(40, profile.age + 5)} max={75} step={1} format={(v) => `${v}`} onChange={(v) => setPlan({ retireAge: v })} />
        </div>
      </Card>

      <div className="db-grid" style={{ marginTop: 20 }}>
        <ChartCard
          data-tour="projection"
          className="span-8 ps-enter"
          style={{ "--i": 1 }}
          title={<Explain k="simulation">What your investments could be worth</Explain>}
          subtitle="In today's dollars. Each faint line is one possible future, and the shading shows where most of them end up."
          table={{
            columns: ["Age", "Cautious (10th)", "Typical (median)", "Optimistic (90th)"],
            rows: ages.map((a, i) => [a, money(p10[i]), money(p50[i]), money(p90[i])]).filter((_, i) => i % 5 === 0 || i === end),
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Legend
              items={[
                { label: "Typical outcome", color: "var(--ps-brand-600)" },
                { label: "Middle 50%", color: "var(--ps-brand-300)", shape: "rect" },
                { label: "80% of outcomes", color: "var(--ps-brand-100)", shape: "rect" },
              ]}
            />
          </div>
          <LineChart
            x={ages}
            series={[{ key: "p50", label: "Typical", color: "var(--ps-brand-600)", values: p50 }]}
            bands={[
              { key: "outer", lo: p10, hi: p90, color: "var(--ps-brand-300)", opacity: 0.28 },
              { key: "inner", lo: p25, hi: p75, color: "var(--ps-brand-400)", opacity: 0.3 },
            ]}
            ghosts={sim.paths}
            refLines={[{ y: m.fiNumber, label: `Financial independence · ${moneyShort(m.fiNumber)}` }]}
            height={340}
            ariaLabel="Simulated range of portfolio outcomes"
            tooltipRows={(i) => [
              { label: "optimistic", value: money(p90[i]) },
              { label: "typical", value: money(p50[i]), color: "var(--ps-brand-600)" },
              { label: "cautious", value: money(p10[i]) },
            ]}
          />
        </ChartCard>

        <Card className="span-4 ps-enter" style={{ "--i": 2 }} title={<Explain k="fi">Chance of reaching your goal</Explain>} subtitle={`Your goal of ${money(m.fiNumber)} is 25 times what you spend in a year, enough to live off your investments`}>
          <div ref={ringRef} style={{ display: "flex", justifyContent: "center", margin: "8px 0 20px" }}>
            <Ring value={sim.successRate} size={148} stroke={12} label={`${pct(sim.successRate)} chance`}>
              <div>
                <div className="db-big"><AnimatedNumber value={sim.successRate * 100} format={(v) => `${Math.round(v)}%`} duration={600} /></div>
                <div className="ps-small">by age {plan.retireAge}</div>
              </div>
            </Ring>
          </div>
          <div className="db-kv">
            <span className="ps-body">Optimistic</span>
            <span className="db-kv__value"><AnimatedNumber value={p90[end]} format={money} duration={500} /></span>
          </div>
          <div className="db-kv">
            <span className="ps-body">Typical</span>
            <span className="db-kv__value"><AnimatedNumber value={p50[end]} format={money} duration={500} /></span>
          </div>
          <div className="db-kv">
            <span className="ps-body">Cautious</span>
            <span className="db-kv__value"><AnimatedNumber value={p10[end]} format={money} duration={500} /></span>
          </div>
          <p className="ps-small" style={{ marginTop: 12 }}>
            Assumes about {pct(sim.expectedReturn, 1)} growth a year after inflation, with ups and downs of around {pct(sim.volatility)} along the way.
          </p>
        </Card>
      </div>
      {celebration}
    </>
  );
}
