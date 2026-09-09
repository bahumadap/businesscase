import { addMonths, monthDifference } from "../forecast-engine";
import type { B2CForecastMonth, B2CPlan } from "./types";

export type B2CProductForecastMonth = {
  month: string;
  productId: string;
  mau: number;
  users: number;
  txAttempted: number;
  txNet: number;
  tpvClp: number;
  revenue: number;
  providerCost: number;
  riskCost: number;
  addedDirectCost: number;
  directCost: number;
  contributionMargin: number;
  pending: boolean;
};

function costIsActive(startMonth: string, endMonth: string | undefined, month: string, frequency: "monthly" | "one_off") {
  const active = monthDifference(startMonth, month) >= 0 && (!endMonth || monthDifference(month, endMonth) >= 0);
  return active && (frequency === "monthly" || startMonth === month);
}

export function mauAt(plan: B2CPlan, monthIndex: number) {
  if (monthIndex < 0) return 0;
  if (monthIndex < 12) return plan.baseMau12[monthIndex] ?? 0;
  const finalBaseMau = plan.baseMau12[11] ?? 0;
  const monthsAfterBase = monthIndex - 11;
  return finalBaseMau * Math.pow(1 + plan.annualMauGrowthRate, monthsAfterBase / 12);
}

export function calculateB2CForecast(plan: B2CPlan) {
  const calendar = Array.from({ length: plan.horizonMonths }, (_, index) => addMonths(plan.modelStartMonth, index));
  const productForecasts = plan.products.flatMap((product) => calendar.map<B2CProductForecastMonth>((month, monthIndex) => {
    const active = product.active && monthDifference(product.goLiveMonth, month) >= 0;
    const mau = mauAt(plan, monthIndex);
    const users = active ? mau * product.adoptionRate : 0;
    const txAttempted = users * product.usesPerMonth;
    const txNet = txAttempted * product.completionRate * product.netRate;
    const tpvClp = txAttempted * product.completionRate * product.ticketClp;
    const revenue = txNet * (product.fixedRevenueClpPerTx + product.ticketClp * product.variableRevenueRate) * product.yol1Share;
    const providerCost = txNet * (product.fixedCostClpPerTx + product.ticketClp * product.variableCostRate) + users * product.costPerUserClp;
    const riskCost = tpvClp * product.riskRate;
    const addedDirectCost = plan.costs.filter((cost) => cost.category === "direct" && cost.scope === "product" && cost.productId === product.id && costIsActive(cost.startMonth, cost.endMonth, month, cost.frequency)).reduce((sum, cost) => sum + cost.amountClp, 0);
    const directCost = providerCost + riskCost + addedDirectCost;
    return { month, productId: product.id, mau, users, txAttempted, txNet, tpvClp, revenue, providerCost, riskCost, addedDirectCost, directCost, contributionMargin: revenue - directCost, pending: active && product.providerStatus === "Por validar" };
  }));

  let b2cEndingCash = plan.startingCashClp;
  let consolidatedEndingCash = plan.consolidatedStartingCashClp;
  const months: B2CForecastMonth[] = calendar.map((month, monthIndex) => {
    const rows = productForecasts.filter((item) => item.month === month);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const productDirectCost = rows.reduce((sum, item) => sum + item.directCost, 0);
    const sharedDirectCost = plan.costs.filter((cost) => cost.category === "direct" && cost.scope === "b2c" && costIsActive(cost.startMonth, cost.endMonth, month, cost.frequency)).reduce((sum, cost) => sum + cost.amountClp, 0);
    const directCost = productDirectCost + sharedDirectCost;
    const contributionMargin = revenue - directCost;
    const b2cCosts = plan.costs.filter((cost) => cost.category === "opex" && cost.scope !== "consolidated" && costIsActive(cost.startMonth, cost.endMonth, month, cost.frequency)).reduce((sum, cost) => sum + cost.amountClp, 0);
    const consolidatedOnlyCosts = plan.costs.filter((cost) => cost.scope === "consolidated" && costIsActive(cost.startMonth, cost.endMonth, month, cost.frequency)).reduce((sum, cost) => sum + cost.amountClp, 0);
    const consolidatedCosts = b2cCosts + consolidatedOnlyCosts;
    const b2cCashFlow = contributionMargin - b2cCosts;
    const consolidatedCashFlow = contributionMargin - consolidatedCosts;
    b2cEndingCash += b2cCashFlow;
    consolidatedEndingCash += consolidatedCashFlow;
    return { month, mau: mauAt(plan, monthIndex), revenue, directCost, contributionMargin, b2cCosts, consolidatedCosts, b2cCashFlow, consolidatedCashFlow, b2cEndingCash, consolidatedEndingCash, pending: rows.some((item) => item.pending) };
  });

  const byProduct = [...new Set(plan.products.map((product) => product.line))].map((line) => {
    const products = plan.products.filter((product) => product.line === line);
    const productIds = new Set(products.map((product) => product.id));
    const rows = productForecasts.filter((item) => productIds.has(item.productId));
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const margin = rows.reduce((sum, item) => sum + item.contributionMargin, 0);
    const annualRevenue = [0, 1, 2].map((year) => rows.filter((item) => {
      const index = calendar.indexOf(item.month);
      return index >= year * 12 && index < year * 12 + 12;
    }).reduce((sum, item) => sum + item.revenue, 0));
    const goLiveMonth = products.map((product) => product.goLiveMonth).sort()[0] ?? "—";
    return { id: line.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: line, goLiveMonth, revenue, margin, annualRevenue, marginPercent: revenue ? margin / revenue : 0 };
  });

  return { calendar, productForecasts, months, byProduct, pendingAssumptions: plan.products.filter((product) => product.providerStatus === "Por validar").length };
}
