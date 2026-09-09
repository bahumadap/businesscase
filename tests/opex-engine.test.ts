import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpexForecast, expenseAmountAt } from "../src/opex/engine";
import { OPEX_SEED } from "../src/opex/seed";

test("OPEX consolidates the nine Administración y Ventas categories", () => {
  assert.equal(OPEX_SEED.expenses.length, 9);
  assert.equal(OPEX_SEED.modelStartMonth, "2027-03");
  assert.equal(OPEX_SEED.ramp.baseTotalClp, 238_216_000);
  assert.equal(OPEX_SEED.ramp.targetTotalClp, 300_000_000);
});

test("OPEX ramps linearly and stays flat after twelve months with no category difference", () => {
  const forecast = calculateOpexForecast(OPEX_SEED);
  const march27 = forecast.months.find((month) => month.month === "2027-03")!;
  const march28 = forecast.months.find((month) => month.month === "2028-03")!;
  const january29 = forecast.months.find((month) => month.month === "2029-01")!;
  assert.equal(march27.totalClp, 238_216_000);
  assert.equal(march28.totalClp, 300_000_000);
  assert.equal(january29.totalClp, 300_000_000);
  assert.equal(Object.values(march28.byCategory).reduce((sum, value) => sum + value, 0), march28.totalClp);
});

test("monthly overrides replace the proportional distribution without changing adjacent months", () => {
  const plan = structuredClone(OPEX_SEED);
  plan.expenses[0].monthlyOverrides["2027-04"] = 1_000;
  const forecast = calculateOpexForecast(plan);
  const row = forecast.byExpense[0];
  assert.equal(row.values[1], 1_000);
  assert.notEqual(row.values[0], 1_000);
  assert.notEqual(row.values[2], 1_000);
});
