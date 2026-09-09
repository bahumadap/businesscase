import assert from "node:assert/strict";
import test from "node:test";
import { calculateEnterpriseForecast } from "../src/enterprise/engine";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import { calculateTransversalForecast } from "../src/transversal/engine";
import { migrateTransversalPlan } from "../src/transversal/migrations";
import { TRANSVERSAL_SEED } from "../src/transversal/seed";

test("la UF se convierte a USD usando el FX corporativo", () => {
  const enterprise = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const forecast = calculateTransversalForecast(structuredClone(TRANSVERSAL_SEED), enterprise.clientForecasts, 930);
  assert.equal(forecast.ufUsd, 42_300 / 930);
});

test("ProntoPaga alimenta 900.000 salidas interbancarias sin duplicar el costo de Payouts", () => {
  const enterprise = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const transversal = calculateTransversalForecast(structuredClone(TRANSVERSAL_SEED), enterprise.clientForecasts, ENTERPRISE_SEED.clpPerUsd);
  const payout = enterprise.clientForecasts.find((row) => row.clientId === "prontopaga-payouts" && row.month === "2027-02");
  const network = transversal.months.find((month) => month.month === "2027-02");
  assert.equal(payout?.volume, 900_000);
  assert.equal(payout?.directCost, 900_000 * 10 / 930);
  assert.equal(network?.outboundTransactions, 900_000);
  const expectedNetworkCost = (900_000 * 0.6 * 0.01 + 900_000 * 0.4 * 0.0028) * (42_300 / 930);
  assert.ok(Math.abs((network?.interbankCostUsd ?? 0) - expectedNetworkCost) < 0.01);
});

test("XTransfer parte con 10.000 entradas mensuales desde septiembre de 2026", () => {
  const enterprise = calculateEnterpriseForecast(structuredClone(ENTERPRISE_SEED));
  const transversal = calculateTransversalForecast(structuredClone(TRANSVERSAL_SEED), enterprise.clientForecasts, ENTERPRISE_SEED.clpPerUsd);
  const first = transversal.months.find((month) => month.month === "2026-09");
  const xtransfer = transversal.byLink.find((link) => link.id === "xtransfer-interbank-inbound");
  assert.equal(first?.inboundTransactions, 10_000);
  assert.equal(transversal.totals.inboundTransactions, 360_000);
  assert.equal(xtransfer?.rows.reduce((sum, row) => sum + row.inboundTransactions, 0), 360_000);
  const expectedMonthlyRevenue = 10_000 * (0.6 * 0.01 + 0.4 * 0.0028) * (42_300 / 930);
  assert.ok(Math.abs((first?.interbankRevenueUsd ?? 0) - expectedMonthlyRevenue) < 0.01);
  assert.equal(xtransfer?.costUsd, 0);
});

test("Iniciación de Pagos no genera ingreso interbancario", () => {
  const enterprisePlan = structuredClone(ENTERPRISE_SEED);
  enterprisePlan.clients.push({ id: "nuevo-payin", name: "Nuevo Pay-in", country: "Chile", productId: "payment-initiation", goLiveMonth: "2026-09", status: "Planificado", owner: "Por asignar" });
  enterprisePlan.volumeSegments.push({ id: "nuevo-payin-vol", clientId: "nuevo-payin", fromMonth: 0, toMonth: 35, volume: 1_000_000, status: "Validado" });
  const enterprise = calculateEnterpriseForecast(enterprisePlan);
  const transversal = calculateTransversalForecast(structuredClone(TRANSVERSAL_SEED), enterprise.clientForecasts, enterprisePlan.clpPerUsd);
  assert.equal(transversal.months[0].inboundTransactions, 10_000);
});

test("el plan persistido anterior migra el vínculo inflado de Iniciación a XTransfer", () => {
  const legacy = structuredClone(TRANSVERSAL_SEED);
  legacy.links[0] = {
    id: "payment-initiation-payins-inbound",
    name: "Pay-ins · Iniciación de Pagos",
    sourceMode: "enterprise_product",
    enterpriseProductId: "payment-initiation",
    goLiveMonth: "2026-09",
    manualMonthlyTransactions: 0,
    inboundRatio: 1,
    outboundRatio: 0,
    bancoEstadoMix: 0.6,
    status: "Validado",
  };
  const migrated = migrateTransversalPlan(legacy);
  assert.notEqual(migrated, legacy);
  assert.deepEqual(migrated.links[0], {
    id: "xtransfer-interbank-inbound",
    name: "XTransfer · Entrada interbancaria",
    sourceMode: "manual",
    goLiveMonth: "2026-09",
    manualMonthlyTransactions: 10_000,
    inboundRatio: 1,
    outboundRatio: 0,
    bancoEstadoMix: 0.6,
    status: "Por validar",
  });
});

test("una transferencia entrante genera ingreso transversal en USD", () => {
  const plan = structuredClone(TRANSVERSAL_SEED);
  plan.links = [{ id: "entrada", name: "Entrada", sourceMode: "manual", goLiveMonth: plan.modelStartMonth, manualMonthlyTransactions: 1_000, inboundRatio: 1, outboundRatio: 0, bancoEstadoMix: 1, status: "Validado" }];
  const first = calculateTransversalForecast(plan, [], 930).months[0];
  assert.ok(Math.abs(first.interbankRevenueUsd - 1_000 * 0.01 * 42_300 / 930) < 1e-9);
  assert.equal(first.interbankCostUsd, 0);
});
