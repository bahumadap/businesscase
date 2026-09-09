import assert from "node:assert/strict";
import test from "node:test";
import { buildBudgetRecords, compareBudgetActual, periodKey } from "../src/actuals/engine";
import { B2C_SEED } from "../src/b2c/seed";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import { OPEX_SEED } from "../src/opex/seed";
import { SMB_SEED } from "../src/smb/seed";
import type { ActualRecord, BudgetRecord } from "../src/actuals/types";

const budget: BudgetRecord[] = [{ date: "2027-02-01", area: "Enterprise", country: "Chile", provider: "Floid", client: "ProntoPaga", product: "Iniciación de Pagos", category: "Revenue", amountUsd: 100, source: "test" }];
const actual: ActualRecord[] = [{ id: "a", date: "2027-02-15", area: "Enterprise", country: "Chile", provider: "Floid", client: "ProntoPaga", product: "Iniciación de Pagos", category: "Revenue", amountUsd: 120, notes: "" }];
const filters = { area: "", country: "", provider: "", client: "", product: "", category: "" };

test("Presupuesto vs Real calcula desviación absoluta y porcentual", () => {
  assert.deepEqual(compareBudgetActual(budget, actual, "month", filters)[0], { period: "2027-02", category: "Revenue", budget: 100, actual: 120, variance: 20, variancePercent: .2 });
});

test("los filtros permanecen compatibles con cualquier granularidad", () => {
  assert.equal(compareBudgetActual(budget, actual, "quarter", { ...filters, provider: "Radar" }).length, 0);
  assert.equal(periodKey("2027-02-15", "quarter"), "2027-T1");
  assert.match(periodKey("2027-02-15", "week"), /^Sem 2027-02-/);
});

test("el presupuesto incluye productos SMB en USD", () => {
  const records = buildBudgetRecords(ENTERPRISE_SEED, B2C_SEED, SMB_SEED, OPEX_SEED);
  const smb = records.filter((row) => row.area === "SMB" && row.category === "Revenue");
  assert.ok(smb.length > 0);
  assert.ok(Math.abs(smb.reduce((sum, row) => sum + row.amountUsd, 0) - 4_822_816_939.6188965 / ENTERPRISE_SEED.clpPerUsd) < 0.01);
});
