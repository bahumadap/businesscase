import assert from "node:assert/strict";
import test from "node:test";
import { applyProviderConditionsToEnterprise, conditionMonthlyBudgetUsd } from "../src/providers/engine";
import { PROVIDERS_SEED } from "../src/providers/seed";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";

test("Floid convierte costo unitario CLP a presupuesto mensual USD", () => {
  const row = PROVIDERS_SEED.conditions.find((item) => item.id === "floid-init")!;
  assert.equal(conditionMonthlyBudgetUsd(row), 720_000 * 40 / 930);
});

test("las condiciones validadas alimentan los costos del presupuesto Enterprise", () => {
  const applied = applyProviderConditionsToEnterprise(ENTERPRISE_SEED, { ...PROVIDERS_SEED, conditions: PROVIDERS_SEED.conditions.map((row) => row.id === "floid-init" ? { ...row, unitFee: 41 } : row) });
  assert.equal(applied.assumptions.paymentInitiationProviderCostClp, 41);
});

test("un escalón fuera de su rango no genera costo", () => {
  const row = { ...PROVIDERS_SEED.conditions[0], pricingModel: "Escalonado" as const, minVolume: 1_000_000, maxVolume: 2_000_000 };
  assert.equal(conditionMonthlyBudgetUsd(row), 0);
});

test("una condición porcentual usa el TPV supuesto", () => {
  const row = { ...PROVIDERS_SEED.conditions[0], pricingModel: "Porcentual" as const, currency: "USD" as const, fixedFee: 100, percentageRate: .002, assumedMonthlyTpv: 1_000_000 };
  assert.equal(conditionMonthlyBudgetUsd(row), 2_100);
});

test("una condición unitaria validada alimenta productos Enterprise nuevos", () => {
  const plan = {
    ...ENTERPRISE_SEED,
    products: [...ENTERPRISE_SEED.products, { id: "new-product", name: "Producto Nuevo", driver: "Transacciones" as const, unit: "tx" as const }],
    clients: [...ENTERPRISE_SEED.clients, { id: "new-client", name: "Cliente Nuevo", country: "Chile", productId: "new-product", goLiveMonth: "2026-09", status: "Planificado", owner: "Por asignar" }],
  };
  const providers = {
    ...PROVIDERS_SEED,
    conditions: [...PROVIDERS_SEED.conditions, { id: "new-product-cost", providerId: "floid", product: "Producto Nuevo", service: "API", pricingModel: "Por unidad" as const, fixedFee: 0, unitFee: 25, percentageRate: 0, minVolume: 0, maxVolume: null, assumedMonthlyVolume: 1, assumedMonthlyTpv: 0, currency: "CLP" as const, fxToUsd: 1_000, country: "Chile", validFrom: "2026-09-01", validTo: "2027-12-31", status: "Validado" as const }],
  };
  const applied = applyProviderConditionsToEnterprise(plan, providers);
  assert.equal(applied.products.find((product) => product.id === "new-product")?.customCostUsdPerUnit, 0.025);
});
