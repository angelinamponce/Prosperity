import { BED_TILES, BORDER_TILES, GARDEN, GARDEN_MAP, GARDEN_SPAWN, GATE, GREENHOUSE, SIGN, elementAt, layoutGarden } from "../gardenMap";
import { findPath, step } from "../movement";
import { deriveGarden } from "../../game/garden";
import { computeMetrics, gradeBreakdown } from "../../dashboard/finance";
import { sampleProfile } from "../../dashboard/sampleProfile";

const plan = { extraDebt: 300, strategy: "avalanche" };
const gardenFor = (profile, learned = 7) => {
  const m = computeMetrics(profile);
  return deriveGarden({ profile, m, plan, healthScore: gradeBreakdown(m).score, learned, wordTotal: 24, now: new Date(2026, 9, 1) });
};

test("the garden map is the same 24 x 15 shape as the town", () => {
  expect(GARDEN_MAP).toHaveLength(15);
  expect(GARDEN_MAP.every((r) => r.length === 24)).toBe(true);
  expect(BED_TILES).toHaveLength(60);
  expect(BORDER_TILES).toHaveLength(24);
  expect(BED_TILES.every(({ x, y }) => GARDEN_MAP[y][x] === "s")).toBe(true);
  expect(BORDER_TILES.every(({ x, y }) => GARDEN_MAP[y][x] === "s")).toBe(true);
});

test("Sprout can reach the gate, the greenhouse door and the sign from where it arrives", () => {
  expect(findPath(GARDEN, GARDEN_SPAWN, GATE)).toBeTruthy();
  expect(findPath(GARDEN, GARDEN_SPAWN, GREENHOUSE.door)).toBeTruthy();
  expect(findPath(GARDEN, GARDEN_SPAWN, { x: SIGN.x, y: SIGN.y + 1 })).toBeTruthy();
  // Beds, the greenhouse and the hedge are solid; walking up through the greenhouse door goes in.
  expect(step(GARDEN, { x: 8, y: 4 }, "up").moved).toBe(false);
  expect(step(GARDEN, GREENHOUSE.door, "up")).toMatchObject({ moved: false, enter: GREENHOUSE });
});

test("weeds follow the debts, one group per debt, and the rest of the beds grow crops", () => {
  const layout = layoutGarden(gardenFor(sampleProfile));
  expect(layout.weeds).toHaveLength(12); // 2 + 4 + 6 patches
  expect(layout.weeds.filter((w) => w.first)).toHaveLength(3);
  expect(layout.weeds.filter((w) => w.thorny)).toHaveLength(2); // the credit card
  expect(layout.crops).toHaveLength(48);
  expect(layout.flowers.filter((f) => f.bloom)).toHaveLength(7);
  const first = layout.weeds[0];
  expect(elementAt(layout, first.x, first.y)).toEqual({ id: "weeds", debt: 0 });
  const crop = layout.crops[0];
  expect(elementAt(layout, crop.x, crop.y)).toEqual({ id: "soil" });
});

test("a debt-free garden is still full: every bed grows crops, the border still has seedlings", () => {
  const layout = layoutGarden(gardenFor({ ...sampleProfile, debts: [] }, 0));
  expect(layout.weeds).toHaveLength(0);
  expect(layout.crops).toHaveLength(60);
  expect(layout.flowers).toHaveLength(24);
  expect(layout.flowers.every((f) => !f.bloom)).toBe(true);
});

test("plain-language whereabouts", () => {
  expect(GARDEN.describe(GATE)).toBe("at the gate back to town");
  expect(GARDEN.describe(GREENHOUSE.door)).toBe("at the greenhouse door");
});
