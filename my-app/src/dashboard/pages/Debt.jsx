import { useMemo, useRef } from "react";
import { ArrowRightOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { Badge, Button, Card, ChartCard, Legend, LineChart, Segmented, Slider, money, duration, useCelebration, useMilestone } from "../../design";
import { HIGH_INTEREST_APR, addMonths, simulatePayoff } from "../finance";
import { EmptyState, PageHeader, StatTile } from "../components";
import { Explain } from "../glossary";

export default function Debt(props) {
  if (!props.profile.debts.length) {
    return (
      <>
        <PageHeader eyebrow="Debt" title="Your payoff plan" />
        <EmptyState
          title="No debts to pay off. Wonderful!"
          action={<Button iconRight={<ArrowRightOutlined />} onClick={() => props.go("invest")}>Explore ways to grow your money</Button>}
        >
          Being debt-free gives you lots of room to grow. If you take on a loan later, you can plan your payoff here.
        </EmptyState>
      </>
    );
  }
  return <DebtPlanner {...props} />;
}

function DebtPlanner({ profile, metrics: m, plan, setPlan, go }) {
  const { base, planned } = useMemo(
    () => ({
      base: simulatePayoff(profile.debts, { extra: 0, rollover: false }),
      planned: simulatePayoff(profile.debts, { extra: plan.extraDebt, strategy: plan.strategy }),
    }),
    [profile.debts, plan.extraDebt, plan.strategy]
  );

  const now = new Date();
  const len = Math.max(base.balances.length, planned.balances.length);
  const pad = (xs) => Array.from({ length: len }, (_, i) => xs[i] ?? 0);
  const labels = Array.from({ length: len }, (_, i) => addMonths(now, i));

  const statsRef = useRef(null);
  const { celebrate, celebration } = useCelebration();
  // Fewer months is better, so watch the negative.
  useMilestone(-planned.months, [-36, -24, -12], (t) =>
    celebrate({
      message: t === -12 ? "Debt-free within a year. That's a big deal." : `Debt-free in under ${-t / 12} years. Keep going!`,
      origin: statsRef.current?.firstElementChild,
    })
  );

  return (
    <>
      <PageHeader
        eyebrow="Debt"
        title="Your payoff plan"
        description={`You owe ${money(m.totalDebt)} across ${profile.debts.length} debts. That's a really common place to be! Every extra dollar shortens the climb, so try a few amounts and watch your debt-free date move closer.`}
        action={<Button iconRight={<ArrowRightOutlined />} onClick={() => go("invest")}>Compare investing options</Button>}
      />

      <Card className="ps-enter">
        <div className="db-controls">
          <div className="db-control-group">
            <span className="ps-label"><Explain k="payoffOrder">Which debt to pay first</Explain></span>
            <Segmented
              ariaLabel="Payoff strategy"
              value={plan.strategy}
              onChange={(v) => setPlan({ strategy: v })}
              options={[
                { value: "avalanche", label: "Highest interest first" },
                { value: "snowball", label: "Smallest balance first" },
              ]}
            />
          </div>
          <Slider
            label="Extra payment each month"
            value={plan.extraDebt}
            min={0}
            max={1500}
            step={25}
            format={money}
            onChange={(v) => setPlan({ extraDebt: v })}
          />
        </div>
      </Card>

      <div className="db-stats db-stats--3" style={{ marginTop: 20 }} ref={statsRef}>
        <StatTile index={1} label="Debt-free by" value={planned.months} format={(v) => addMonths(now, Math.round(v))} note={`in ${duration(planned.months)}`} />
        <StatTile index={2} label="Interest you'll save" value={Math.max(0, base.interest - planned.interest)} format={money} note={`vs ${money(base.interest)} on minimums`} />
        <StatTile index={3} label="Time you'll save" value={Math.max(0, base.months - planned.months)} format={(v) => duration(Math.round(v))} note={`vs ${duration(base.months)} on minimums`} />
      </div>

      <div className="db-grid">
        <ChartCard
          className="span-8 ps-enter"
          style={{ "--i": 4 }}
          title="Total balance over time"
          subtitle="Your plan compared with paying only the minimums"
          table={{
            columns: ["Month", "Your plan", "Minimums only"],
            rows: labels.map((l, i) => [l, money(pad(planned.balances)[i]), money(pad(base.balances)[i])]).filter((_, i) => i % 3 === 0),
          }}
        >
          <div style={{ marginBottom: 16 }}>
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
              { key: "plan", label: "Your plan", color: "var(--ps-brand-500)", values: pad(planned.balances) },
            ]}
            height={300}
            ariaLabel="Debt balance over time"
          />
        </ChartCard>

        <Card className="span-4 ps-enter" style={{ "--i": 5 }} title="Payoff order" subtitle={plan.strategy === "avalanche" ? "Paying the highest interest rate first saves the most money" : "Clearing the smallest balances first gives you quick wins"}>
          <ol className="db-list">
            {planned.payoffOrder.map((d, i) => {
              const debt = profile.debts.find((x) => x.name === d.name);
              return (
                <li key={d.name} className="db-step">
                  <span className="db-rec__num">{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div className="ps-small">{money(debt.balance)} at {(d.apr * 100).toFixed(1)}% <Explain k="apr">APR</Explain></div>
                    {d.apr >= HIGH_INTEREST_APR && (
                      <div style={{ marginTop: 6 }}>
                        <Badge tone="warning" icon={<ExclamationCircleFilled />}>High interest</Badge>
                      </div>
                    )}
                  </div>
                  <span className="ps-num ps-small" style={{ color: "var(--ps-ink)", fontWeight: 500 }}>{addMonths(now, d.month)}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
      {celebration}
    </>
  );
}
