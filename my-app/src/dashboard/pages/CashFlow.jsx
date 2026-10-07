import { useRef, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { AnimatedNumber, Button, Card, ChartCard, Donut, Slider, Waterfall, money, pct, useCelebration, useMilestone } from "../../design";
import { trimSpending } from "../finance";
import { PageHeader } from "../components";
import { Explain } from "../glossary";

export default function CashFlow({ profile, metrics: m, plan, setPlan, go }) {
  const [active, setActive] = useState(null);
  const trim = plan.trim;

  // Trimming only touches the flexible share of each category.
  const { expenses, saved, surplus, tenYearValue: tenYear } = trimSpending(profile, m, trim);

  const rateRef = useRef(null);
  const { celebrate, celebration } = useCelebration();
  const share = (v) => (m.income ? v / m.income : 0);
  useMilestone(share(surplus), [0.4, 0.45, 0.5], (t) =>
    celebrate({ message: `You just passed a ${pct(t)} savings rate. Future you says thank you.`, origin: rateRef.current })
  );

  const steps = [
    { key: "income", label: "Income", value: m.income, kind: "total", color: "var(--ps-ink-2)" },
    ...expenses.map((e) => ({ key: e.key, label: e.short, value: e.planned, kind: "out", color: `var(--ps-series-${e.slot})` })),
    { key: "debt", label: "Debt", value: m.minDebt, kind: "out", color: "var(--ps-series-muted)" },
    { key: "left", label: "Left over", value: surplus, kind: "result", color: "var(--ps-brand-700)" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Cash flow"
        title="Where your money goes"
        description={`Follow each dollar of your ${money(m.income)} monthly income, from paycheck to what's left over.`}
        action={<Button iconRight={<ArrowRightOutlined />} onClick={() => go("debt")}>Plan your debt payoff</Button>}
      />

      <div className="db-grid">
        <ChartCard
          data-tour="cash-flow"
          className="span-12 ps-enter"
          title="Your month at a glance"
          subtitle={trim ? `Including your ${pct(trim)} trim to flexible spending` : "Start with your paycheck, take out each kind of spending, and see what's left for you"}
          table={{ columns: ["Step", "Amount", "Share of income"], rows: steps.map((s) => [s.label, money(s.value), m.income ? pct(share(s.value)) : "–"]) }}
        >
          <Waterfall steps={steps} base={m.income} height={320} ariaLabel="Monthly cash flow waterfall" />
        </ChartCard>
      </div>

      <div className="db-grid">
        <Card className="span-7 ps-enter" style={{ "--i": 1 }} title="Spending by category" subtitle="Point at a category to highlight it">
          {expenses.length === 0 ? (
            <p className="ps-body">No spending recorded yet. Once your survey includes rent, groceries or other expenses, they'll show up here.</p>
          ) : (
            <div className="db-split">
              <Donut
                data={expenses.map((e) => ({ key: e.key, label: e.name, value: e.planned, color: `var(--ps-series-${e.slot})` }))}
                active={active}
                onActive={setActive}
                centerTitle="Total spending"
                centerValue={money(m.expenses - saved)}
              />
              <ul className="db-list">
                {expenses.map((e) => (
                  <li
                    key={e.key}
                    className="db-step"
                    style={{ gridTemplateColumns: "10px minmax(0,1fr) auto", background: active === e.key ? "var(--ps-surface-sunken)" : undefined, borderRadius: "var(--ps-radius-sm)", padding: "10px 8px", margin: "0 -8px", transition: "background 140ms" }}
                    onPointerEnter={() => setActive(e.key)}
                    onPointerLeave={() => setActive(null)}
                  >
                    <span className="ps-legend__rect" style={{ background: `var(--ps-series-${e.slot})` }} />
                    <span style={{ color: "var(--ps-ink)" }}>{e.name}</span>
                    <span className="ps-num" style={{ fontWeight: 600 }}>{money(e.planned)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card data-tour="trim" className="span-5 ps-enter" style={{ "--i": 2 }} title={<Explain k="flexible">Try a trim</Explain>} subtitle="Shave a little off flexible spending and watch your savings grow">
          <Slider
            label="Trim flexible spending by"
            value={Math.round(trim * 100)}
            min={0}
            max={50}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => setPlan({ trim: v / 100 })}
          />
          <div style={{ marginTop: 24 }}>
            <div className="db-kv">
              <span className="ps-body">Freed up each month</span>
              <span className="db-kv__value"><AnimatedNumber value={saved} format={money} duration={500} /></span>
            </div>
            <div className="db-kv" ref={rateRef}>
              <span className="ps-body">New savings rate</span>
              <span className="db-kv__value"><AnimatedNumber value={share(surplus)} format={(v) => pct(v, 1)} duration={500} /></span>
            </div>
            <div className="db-kv">
              <span className="ps-body">If you invested it for 10 years</span>
              <span className="db-kv__value" style={{ color: "var(--ps-positive)" }}><AnimatedNumber value={tenYear} format={money} duration={500} /></span>
            </div>
          </div>
          <p className="ps-small" style={{ marginTop: 12 }}>This estimate assumes your money grows about 5.5% a year after inflation. Real results will vary.</p>
        </Card>
      </div>
      {celebration}
    </>
  );
}
