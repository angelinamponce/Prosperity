import { useMemo } from "react";
import { ArrowRightOutlined, BulbOutlined } from "@ant-design/icons";
import { AnimatedNumber, Button, Card, ChartCard, Legend, LineChart, Slider, money, pct } from "../../design";
import { STRATEGIES, growthSeries } from "../finance";
import { PageHeader } from "../components";
import { Explain } from "../glossary";

export default function Invest({ profile, metrics: m, plan, setPlan, go }) {
  const years = plan.investYears;
  const start = m.invested;
  const contributed = start + plan.monthlyInvest * 12 * years;

  const results = useMemo(
    () =>
      STRATEGIES.map((s) => {
        const values = growthSeries(start, plan.monthlyInvest, s.rate, years);
        const end = values[values.length - 1];
        return { ...s, values, end, growth: end - contributed, color: `var(--ps-series-${s.slot})` };
      }),
    [start, plan.monthlyInvest, years, contributed]
  );
  const best = Math.max(...results.map((r) => r.end));
  const ages = Array.from({ length: years + 1 }, (_, i) => `Age ${profile.age + i}`);

  return (
    <>
      <PageHeader
        eyebrow="Invest"
        title="Ways to grow your money"
        description="Put the same amount in each month and see how it could grow in different places. No pressure, this is just for exploring."
        action={<Button iconRight={<ArrowRightOutlined />} onClick={() => go("future")}>See your range of outcomes</Button>}
      />

      <Card className="ps-enter">
        <div className="db-controls">
          <Slider
            label="Monthly investing (including 401(k))"
            value={plan.monthlyInvest}
            min={50}
            max={3000}
            step={50}
            format={money}
            onChange={(v) => setPlan({ monthlyInvest: v })}
          />
          <Slider label="Years invested" value={years} min={5} max={40} step={1} format={(v) => `${v} yrs`} onChange={(v) => setPlan({ investYears: v })} />
        </div>
      </Card>

      <div className="db-grid" style={{ marginTop: 20 }}>
        <ChartCard
          className="span-8 ps-enter"
          style={{ "--i": 1 }}
          title={<Explain k="investOptions">How each option could grow</Explain>}
          subtitle={`Starting from your ${money(start)} already invested`}
          table={{
            columns: ["Age", ...results.map((r) => r.name)],
            rows: ages.map((a, i) => [a, ...results.map((r) => money(r.values[i]))]).filter((_, i) => i % 5 === 0 || i === years),
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Legend items={results.map((r) => ({ label: r.name, color: r.color }))} />
          </div>
          <LineChart
            x={ages}
            series={results.map((r) => ({ key: r.key, label: r.name, color: r.color, values: r.values }))}
            endLabels
            height={320}
            ariaLabel="Projected growth for four investing strategies"
          />
        </ChartCard>

        <Card className="span-4 ps-enter" style={{ "--i": 2 }} title={`After ${years} years`} subtitle={`You put in ${money(contributed)}`}>
          <div className="db-list">
            {results.map((r) => (
              <div key={r.key} className="db-bar-row">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--ps-ink)", fontWeight: 500 }}>{r.name}</span>
                  <span className="ps-num" style={{ fontWeight: 600 }}><AnimatedNumber value={r.end} format={money} duration={500} /></span>
                </div>
                <div className="db-bar-row__track">
                  <div className="db-bar-row__fill" style={{ width: `${(r.end / best) * 100}%`, background: r.color }} />
                </div>
                <span className="ps-small">
                  {money(r.growth)} more than you put in · assumes about {pct(r.rate, 1)} growth a year
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {m.matchMissedAnnual > 0 && (
        <div className="db-callout ps-enter" style={{ marginTop: 20, "--i": 3 }}>
          <BulbOutlined />
          <span>
            Your employer adds up to {pct(profile.retirement.matchUpTo)} of your salary to your 401(k), but you contribute {pct(profile.retirement.contributionRate)}.
            Raising your contribution would add <strong>{money(m.matchMissedAnnual)} a year</strong> in free money before any growth.
          </span>
        </div>
      )}
      <p className="ps-small" style={{ marginTop: 16 }}>
        These are long-run averages after inflation, not promises. Real returns go up and down from year to year, and the Future page shows that range.
      </p>
    </>
  );
}
