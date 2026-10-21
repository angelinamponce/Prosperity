import { brighten, forecast, forecastText } from "../weather";
import { computeMetrics, monteCarlo } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";

const m = computeMetrics(sampleProfile);
const plan = { monthlyInvest: 800, stockShare: 0.8, retireAge: 60 };

test("the three skies add up to all 500 futures and match the Future page's chance of reaching the goal", () => {
  const f = forecast(sampleProfile, m, plan);
  expect(f.sunny + f.mixed + f.stormy).toBeCloseTo(1, 10);
  const sim = monteCarlo({ start: m.invested, monthly: 800, stockShare: 0.8, years: 60 - sampleProfile.age, goal: m.fiNumber });
  expect(f.sunny).toBe(sim.successRate);
  expect(["sunny", "mixed", "stormy"]).toContain(f.sky);
  expect(forecast(sampleProfile, m, plan)).toEqual(f); // seeded: the same answer every time
});

test("investing more or retiring later never makes it stormier, and the text names the goal and age", () => {
  const f = forecast(sampleProfile, m, plan);
  for (const o of brighten(sampleProfile, m, plan)) {
    expect(o.sunny).toBeGreaterThanOrEqual(f.sunny);
    expect(o.stormy).toBeLessThanOrEqual(f.stormy);
  }
  expect(forecastText(f)).toMatch(/to age 60/);
  expect(forecastText(f)).toMatch(/of 500/);
});

test("no spending recorded means no forecast, not a made-up one", () => {
  const f = forecast(sampleProfile, { ...m, fiNumber: 0 }, plan);
  expect(f.none).toBe(true);
  expect(forecastText(f)).toMatch(/no goal to forecast/);
  expect(brighten(sampleProfile, { ...m, fiNumber: 0 }, plan)).toEqual([]);
});

test("a handful of futures is never rounded to 0%, nor nearly all to 100%", () => {
  const { sharePct } = require("../weather");
  expect(sharePct(1 / 500)).toBe("under 1%");
  expect(sharePct(499 / 500)).toBe("over 99%");
  expect(sharePct(0)).toBe("0%");
  expect(sharePct(1)).toBe("100%");
  expect(sharePct(0.24)).toBe("24%");
});
