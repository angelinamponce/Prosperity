import { debtFreeSummary, humanDuration } from "../summaries";
import { addMonths, simulatePayoff } from "../finance";
import { sampleProfile } from "../sampleProfile";

const now = new Date(2026, 9, 1);

describe("humanDuration", () => {
  test("months under a year, then whole and half years", () => {
    expect(humanDuration(0)).toBe("less than a month");
    expect(humanDuration(1)).toBe("1 month");
    expect(humanDuration(8)).toBe("8 months");
    expect(humanDuration(12)).toBe("1 year");
    expect(humanDuration(14)).toBe("1 year");
    expect(humanDuration(17)).toBe("1 and a half years");
    expect(humanDuration(37)).toBe("3 years");
    expect(humanDuration(40)).toBe("3 and a half years");
  });
});

describe("debtFreeSummary", () => {
  test("no debt: says so kindly, with no dates", () => {
    const s = debtFreeSummary([], { extra: 300, now });
    expect(s.hasDebt).toBe(false);
    expect(s.sentence).toMatch(/don't have any debt/i);
    expect(s.sentence).not.toMatch(/\d/);
    // Paid-off debts count as no debt too.
    expect(debtFreeSummary([{ name: "Card", balance: 0, apr: 0.2, minPayment: 50 }], { extra: 300, now }).hasDebt).toBe(false);
  });

  test("names which plan the date belongs to: the extra amount versus minimums only", () => {
    const s = debtFreeSummary(sampleProfile.debts, { extra: 300, now });
    expect(s.sentence).toMatch(/^With \$300 extra a month, you could be debt-free about .+ sooner than paying only the minimums\.$/);
    expect(s.detail).toBe(`That's ${s.plan.date} on this plan, instead of ${s.base.date} with minimums only.`);
  });

  test("the dates and savings match the Debt page's math", () => {
    const s = debtFreeSummary(sampleProfile.debts, { extra: 300, now });
    const base = simulatePayoff(sampleProfile.debts, { extra: 0, rollover: false });
    const plan = simulatePayoff(sampleProfile.debts, { extra: 300, strategy: "avalanche" });
    expect(s.plan.date).toBe(addMonths(now, plan.months));
    expect(s.base.date).toBe(addMonths(now, base.months));
    expect(s.monthsSooner).toBe(base.months - plan.months);
    expect(s.interestSaved).toBeCloseTo(base.interest - plan.interest);
    expect(s.sentence).toContain(humanDuration(base.months - plan.months));
  });

  test("with no extra, credits rolling payments over rather than an extra amount", () => {
    const s = debtFreeSummary(sampleProfile.debts, { extra: 0, now });
    expect(s.sentence).toMatch(/^Even with no extra, moving each paid-off debt's payment/);
    expect(s.sentence).not.toMatch(/\$0 extra/);
  });

  test("a single debt with no extra just gives the minimums date", () => {
    const s = debtFreeSummary([{ name: "Car", balance: 5000, apr: 0.06, minPayment: 200 }], { extra: 0, now });
    expect(s.sentence).toBe(`Paying the minimums, you could be debt-free by ${s.base.date}.`);
  });

  test("payments that never catch up are explained without blame", () => {
    const stuck = [{ name: "Card", balance: 10000, apr: 0.3, minPayment: 100 }]; // $250/mo interest
    const s = debtFreeSummary(stuck, { extra: 0, now });
    expect(s.sentence).toMatch(/wouldn't get paid off/);
    expect(s.plan.date).toBeNull();
    const helped = debtFreeSummary(stuck, { extra: 300, now });
    expect(helped.sentence).toBe(`With $300 extra a month, you could be debt-free by ${helped.plan.date}. Paying only the minimums, it might never be paid off.`);
  });
});
