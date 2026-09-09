import assert from "node:assert/strict";
import test from "node:test";
import { calculateSmbForecast, smbCompaniesAt } from "../src/smb/engine";
import { SMB_SEED } from "../src/smb/seed";

test("SMB reconcilia los ingresos y el resultado fuente de 24 meses", () => {
  const forecast = calculateSmbForecast(structuredClone(SMB_SEED));
  const sourceMonths = forecast.months.slice(0, 24);
  const revenue = sourceMonths.reduce((sum, month) => sum + month.revenue, 0);
  const contribution = sourceMonths.reduce((sum, month) => sum + month.contributionMargin, 0);
  assert.ok(Math.abs(revenue - 4_822_816_939.6188965) < 0.01);
  assert.ok(Math.abs(contribution - 4_792_973_095.1586685) < 0.01);
});

test("SGR conserva el margen calibrado de 25%", () => {
  const forecast = calculateSmbForecast(structuredClone(SMB_SEED));
  const sgr = forecast.productForecasts.filter((month) => month.productId.startsWith("sgr-") && month.sourceCovered);
  const revenue = sgr.reduce((sum, month) => sum + month.revenue, 0);
  const margin = sgr.reduce((sum, month) => sum + month.contributionMargin, 0);
  assert.ok(Math.abs(revenue - 199_791_792.61363637) < 0.01);
  assert.ok(Math.abs(margin - 49_947_948.15340909) < 0.01);
});

test("las empresas crecen 3% mensual durante el segundo año", () => {
  assert.equal(smbCompaniesAt(SMB_SEED, 11), 5_500);
  assert.ok(Math.abs(smbCompaniesAt(SMB_SEED, 23) - 5_500 * Math.pow(1.03, 12)) < 1e-9);
});

test("desde septiembre de 2029 SMB continúa con drivers editables y queda Por validar", () => {
  const forecast = calculateSmbForecast(structuredClone(SMB_SEED));
  const september29 = forecast.months.find((month) => month.month === "2029-09");
  assert.ok(september29 && september29.revenue > 0);
  assert.equal(september29?.sourceCovered, false);
  assert.equal(september29?.pending, true);
});

test("un producto SMB nuevo respeta Go Live y unit economics por empresa", () => {
  const plan = structuredClone(SMB_SEED);
  plan.products.push({ id: "producto-nuevo", name: "Producto nuevo", category: "SMB comercial", goLiveMonth: "2027-11", sourceStatus: "Por validar", customRevenueClpPerCompany: 1_000, customCostClpPerCompany: 250 });
  const rows = calculateSmbForecast(plan).productForecasts.filter((month) => month.productId === "producto-nuevo");
  assert.equal(rows[1].revenue, 0);
  assert.equal(rows[2].revenue, rows[2].companies * 1_000);
  assert.equal(rows[2].directCost, rows[2].companies * 250);
});
