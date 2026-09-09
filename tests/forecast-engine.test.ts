import assert from "node:assert/strict";
import test from "node:test";
import { calculateCostForecast, calculateProductForecast } from "../src/forecast-engine/index";

test("Go Live posterior al período deja revenue y costo variable en cero", () => {
  const [month] = calculateProductForecast({ id: "a", name: "Caso A", verticalId: "enterprise", goLiveMonth: "2027-02", driverCurve: [100], pricing: { kind: "fee_per_unit", fee: 2 }, directCost: { kind: "per_unit", fee: 0.5 } }, "2027-01", 1);
  assert.equal(month.driver, 0);
  assert.equal(month.revenue, 0);
  assert.equal(month.directCost, 0);
});

test("TPV 1.000.000 con spread 0,20% genera revenue 2.000", () => {
  const [month] = calculateProductForecast({ id: "b", name: "Caso B", verticalId: "enterprise", goLiveMonth: "2027-01", driverCurve: [1_000_000], pricing: { kind: "take_rate", rate: 0.002 }, directCost: { kind: "rate", rate: 0 } }, "2027-01", 1);
  assert.equal(month.revenue, 2_000);
});

test("Revenue 2.000 menos costos directos 500 genera margen 1.500", () => {
  const [month] = calculateProductForecast({ id: "c", name: "Caso C", verticalId: "enterprise", goLiveMonth: "2027-01", driverCurve: [1_000], pricing: { kind: "fee_per_unit", fee: 2 }, directCost: { kind: "per_unit", fee: 0.5 } }, "2027-01", 1);
  assert.equal(month.contributionMargin, 1_500);
});

test("Costo mensual desde enero afecta todos los meses posteriores", () => {
  const months = calculateCostForecast({ id: "d", name: "Oficina", startMonth: "2027-01", amount: 10_000, frequency: "monthly" }, "2027-01", 4);
  assert.deepEqual(months.map((month) => month.amount), [10_000, 10_000, 10_000, 10_000]);
});

test("Mover el Go Live desplaza la curva sin modificarla", () => {
  const base = { id: "e", name: "Ramp", verticalId: "enterprise", driverCurve: [10, 20, 30], pricing: { kind: "fee_per_unit" as const, fee: 1 }, directCost: { kind: "per_unit" as const, fee: 0 } };
  const january = calculateProductForecast({ ...base, goLiveMonth: "2027-01" }, "2027-01", 4);
  const march = calculateProductForecast({ ...base, goLiveMonth: "2027-03" }, "2027-01", 4);
  assert.deepEqual(january.slice(0, 3).map((month) => month.driver), [10, 20, 30]);
  assert.deepEqual(march.map((month) => month.driver), [0, 0, 10, 20]);
});
