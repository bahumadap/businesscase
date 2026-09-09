import assert from "node:assert/strict";
import test from "node:test";
import { calculateEnterpriseForecast } from "../src/enterprise/engine";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";

test("Iniciación de Pagos mantiene 650.000 transacciones sin CAGR anual", () => {
  const forecast = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const rows = forecast.clientForecasts.filter((row) => row.clientId === "prontopaga-init");
  assert.equal(rows.length, 36);
  assert.deepEqual(new Set(rows.map((row) => row.volume)), new Set([650_000]));
  assert.equal(rows[0].revenue, 650_000 * 70 / 930);
  assert.equal(rows[24].revenue, rows[0].revenue);
});

test("Payouts no reinicia el ramp-up al cambiar de año", () => {
  const forecast = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const rows = forecast.clientForecasts.filter((row) => row.clientId === "prontopaga-payouts");
  assert.equal(rows.find((row) => row.month === "2027-07")?.volume, 0);
  assert.equal(rows.find((row) => row.month === "2027-08")?.volume, 900_000);
  assert.equal(rows.find((row) => row.month === "2028-07")?.volume, 900_000);
  assert.equal(rows.find((row) => row.month === "2029-07")?.volume, 900_000);
  assert.equal(rows.find((row) => row.month === "2027-08")?.directCost, 900_000 * 10 / 930);
});

test("CV+FX mantiene el último volumen validado después del Mes 11 y queda Por validar", () => {
  const forecast = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const peru = forecast.clientForecasts.filter((row) => row.clientId === "xtransfer-pe");
  assert.equal(peru[11].volume, 50_000_000);
  assert.equal(peru[11].pending, false);
  assert.equal(peru[12].volume, 50_000_000);
  assert.equal(peru[12].pending, true);
});

test("Mover el Go Live desplaza una curva única", () => {
  const plan = structuredClone(ENTERPRISE_SEED);
  plan.clients = plan.clients.map((client) => client.id === "xtransfer-pe" ? { ...client, goLiveMonth: "2027-05" } : client);
  const peru = calculateEnterpriseForecast(plan).clientForecasts.filter((row) => row.clientId === "xtransfer-pe");
  assert.deepEqual(peru.slice(0, 4).map((row) => row.volume), [0, 0, 5_000_000, 5_000_000]);
});

test("Un costo consolidado no reduce el flujo Enterprise", () => {
  const plan = structuredClone(ENTERPRISE_SEED);
  plan.costs.push({ id: "corporate", name: "Corporate", scope: "consolidated", startMonth: plan.modelStartMonth, amountUsd: 10_000, frequency: "monthly" });
  const first = calculateEnterpriseForecast(plan).months[0];
  assert.equal(first.enterpriseCosts, 0);
  assert.equal(first.consolidatedCosts, 10_000);
  assert.equal(first.enterpriseCashFlow - first.consolidatedCashFlow, 10_000);
});

test("un producto Enterprise nuevo usa su economía unitaria y no la fórmula de Payouts", () => {
  const plan = structuredClone(ENTERPRISE_SEED);
  plan.products.push({ id: "nuevo-producto", name: "Nuevo producto", driver: "Transacciones", unit: "tx", customPriceUsdPerUnit: 2, customCostUsdPerUnit: 0.5 });
  plan.clients.push({ id: "cliente-nuevo", name: "Cliente nuevo", country: "Chile", productId: "nuevo-producto", goLiveMonth: plan.modelStartMonth, status: "Planificado", owner: "Test" });
  plan.volumeSegments.push({ id: "curva-nueva", clientId: "cliente-nuevo", fromMonth: 0, toMonth: 35, volume: 100, status: "Validado" });
  const first = calculateEnterpriseForecast(plan).clientForecasts.find((row) => row.clientId === "cliente-nuevo");
  assert.equal(first?.revenue, 200);
  assert.equal(first?.directCost, 50);
});
