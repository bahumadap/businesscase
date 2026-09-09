import assert from "node:assert/strict";
import test from "node:test";
import { calculateB2CForecast } from "../src/b2c/engine";
import { B2C_SEED } from "../src/b2c/seed";

test("B2C Año 1 reconcilia con el Excel base", () => {
  const forecast = calculateB2CForecast(structuredClone(B2C_SEED));
  const year = forecast.months.slice(0, 12);
  const revenue = year.reduce((sum, month) => sum + month.revenue, 0);
  const directCost = year.reduce((sum, month) => sum + month.directCost, 0);
  assert.ok(Math.abs(revenue - 215_158_623.5465359) < 0.01);
  assert.ok(Math.abs(directCost - 126_561_114.56283718) < 0.01);
});

test("un producto no reinicia su Go Live en Año 2", () => {
  const forecast = calculateB2CForecast(structuredClone(B2C_SEED));
  const january2028 = forecast.productForecasts.find((month) => month.productId === "closed-loop" && month.month === "2028-01");
  assert.ok((january2028?.revenue ?? 0) > 0);
});

test("el crecimiento anual de MAU se aplica como driver visible", () => {
  const forecast = calculateB2CForecast(structuredClone(B2C_SEED));
  const year2 = forecast.months.slice(12, 24).reduce((sum, month) => sum + month.revenue, 0);
  const year3 = forecast.months.slice(24, 36).reduce((sum, month) => sum + month.revenue, 0);
  assert.ok(Math.abs(year3 / year2 - 1.10) < 1e-10);
});

test("Transferencias conserva margen negativo mientras no tenga revenue", () => {
  const forecast = calculateB2CForecast(structuredClone(B2C_SEED));
  const rows = forecast.productForecasts.filter((month) => month.productId === "transferencias");
  assert.equal(rows.reduce((sum, month) => sum + month.revenue, 0), 0);
  assert.ok(rows.reduce((sum, month) => sum + month.contributionMargin, 0) < 0);
});
