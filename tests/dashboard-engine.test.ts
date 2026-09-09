import assert from "node:assert/strict";
import test from "node:test";
import { B2C_SEED } from "../src/b2c/seed";
import { calculateDashboardForecast } from "../src/dashboard/engine";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import { OPEX_SEED } from "../src/opex/seed";
import { SMB_SEED } from "../src/smb/seed";
import { calculateSmbForecast } from "../src/smb/engine";
import { compactUsd } from "../src/components/DashboardPlanner";
import { TRANSVERSAL_SEED } from "../src/transversal/seed";

test("dashboard uses the real 36-month Enterprise horizon", () => {
  const dashboard = calculateDashboardForecast(ENTERPRISE_SEED, B2C_SEED, SMB_SEED, OPEX_SEED);
  assert.equal(dashboard.months.length, 36);
  assert.equal(dashboard.months[0].month, ENTERPRISE_SEED.modelStartMonth);
  assert.equal(dashboard.annual.length, 3);
});

test("dashboard reconciles revenue, direct costs, OPEX and operating result", () => {
  const dashboard = calculateDashboardForecast(ENTERPRISE_SEED, B2C_SEED, SMB_SEED, OPEX_SEED);
  const annualRevenue = dashboard.annual.reduce((sum, year) => sum + year.revenue, 0);
  const annualResult = dashboard.annual.reduce((sum, year) => sum + year.operatingResult, 0);
  assert.ok(Math.abs(annualRevenue - dashboard.totals.revenue) < 0.01);
  assert.ok(Math.abs(annualResult - dashboard.totals.operatingResult) < 0.01);
  assert.ok(Math.abs(dashboard.totals.revenue - dashboard.totals.directCosts - dashboard.totals.opexTotal - dashboard.totals.operatingResult) < 0.01);
});

test("SMB is visible and contributes the received 24-month source", () => {
  const dashboard = calculateDashboardForecast(ENTERPRISE_SEED, B2C_SEED, SMB_SEED, OPEX_SEED);
  const smb = dashboard.verticals.find((vertical) => vertical.id === "smb");
  assert.equal(smb?.status, "Parcial");
  const expectedRevenue = calculateSmbForecast(SMB_SEED).months.slice(0, 30).reduce((sum, month) => sum + month.revenue, 0) / ENTERPRISE_SEED.clpPerUsd;
  assert.ok(Math.abs((smb?.revenue ?? 0) - expectedRevenue) < 0.01);
  assert.equal(smb?.href, "/smb");
});

test("compact USD formatting is deterministic across server and browser", () => {
  assert.equal(compactUsd(-318_400), "-US$318,4 k");
  assert.equal(compactUsd(6_118_970), "US$6,1 M");
});

test("Transversal se integra al consolidado en USD", () => {
  const dashboard = calculateDashboardForecast(ENTERPRISE_SEED, B2C_SEED, SMB_SEED, OPEX_SEED, TRANSVERSAL_SEED);
  const transversal = dashboard.verticals.find((vertical) => vertical.id === "transversal");
  assert.equal(transversal?.href, "/transversal");
  assert.ok((transversal?.margin ?? 0) < 0);
  assert.ok(dashboard.months.find((month) => month.month === "2027-08")?.transversalCost);
});
