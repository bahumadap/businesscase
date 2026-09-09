import { calculateB2CForecast } from "../b2c/engine";
import type { B2CPlan } from "../b2c/types";
import { calculateEnterpriseForecast } from "../enterprise/engine";
import type { EnterprisePlan } from "../enterprise/types";
import { calculateOpexForecast } from "../opex/engine";
import type { OpexPlan } from "../opex/types";
import { calculateSmbForecast } from "../smb/engine";
import type { SmbPlan } from "../smb/types";
import { calculateTransversalForecast } from "../transversal/engine";
import type { TransversalPlan } from "../transversal/types";
import type { ActualRecord, BudgetRecord, FinancialCategory, TimeGrain } from "./types";

export type FinancialFilters = { area: string; country: string; provider: string; client: string; product: string; category: string };

export function buildBudgetRecords(enterprisePlan: EnterprisePlan, b2cPlan: B2CPlan, smbPlan: SmbPlan, opexPlan: OpexPlan, transversalPlan?: TransversalPlan): BudgetRecord[] {
  const enterprise = calculateEnterpriseForecast(enterprisePlan);
  const b2c = calculateB2CForecast(b2cPlan);
  const smb = calculateSmbForecast(smbPlan);
  const opex = calculateOpexForecast(opexPlan, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths);
  const transversal = transversalPlan ? calculateTransversalForecast(transversalPlan, enterprise.clientForecasts, enterprisePlan.clpPerUsd) : null;
  const fx = enterprisePlan.clpPerUsd;
  const productName = new Map(enterprisePlan.products.map((row) => [row.id, row.name]));
  const clientById = new Map(enterprisePlan.clients.map((row) => [row.id, row]));
  const enterpriseRows = enterprise.clientForecasts.flatMap<BudgetRecord>((row) => {
    const client = clientById.get(row.clientId);
    const provider = row.productId === "payment-initiation" ? "Floid" : row.productId === "payouts" ? "CSA / API Payouts" : "Riel CV+FX";
    const base = { date: `${row.month}-01`, area: "Enterprise" as const, country: client?.country ?? "", provider, client: client?.name ?? row.clientId, product: productName.get(row.productId) ?? row.productId };
    return [{ ...base, category: "Revenue", amountUsd: row.revenue, source: "Modelo Enterprise" }, { ...base, category: "Costo directo", amountUsd: row.directCost, source: "Modelo Enterprise" }];
  });
  const b2cProduct = new Map(b2cPlan.products.map((row) => [row.id, row]));
  const b2cRows = b2c.productForecasts.flatMap<BudgetRecord>((row) => {
    const product = b2cProduct.get(row.productId);
    const base = { date: `${row.month}-01`, area: "B2C" as const, country: "Chile", provider: product?.provider ?? "", client: "Personas", product: product?.line ?? row.productId };
    return [{ ...base, category: "Revenue", amountUsd: row.revenue / fx, source: "Modelo B2C" }, { ...base, category: "Costo directo", amountUsd: row.directCost / fx, source: "Modelo B2C" }];
  });
  const smbProduct = new Map(smbPlan.products.map((row) => [row.id, row]));
  const smbRows = smb.productForecasts.flatMap<BudgetRecord>((row) => {
    const product = smbProduct.get(row.productId);
    const provider = product?.category === "SGR" ? "SGR" : product?.category === "Factor Place" ? "Factor Place" : "Por definir";
    const base = { date: `${row.month}-01`, area: "SMB" as const, country: "Chile", provider, client: "PyME", product: product?.name ?? row.productId };
    return [{ ...base, category: "Revenue", amountUsd: row.revenue / fx, source: "Modelo SMB" }, { ...base, category: "Costo directo", amountUsd: row.directCost / fx, source: "Modelo SMB" }];
  });
  const opexRows = opex.byExpense.flatMap<BudgetRecord>((expense) => expense.values.map((value, index) => ({ date: `${opex.calendar[index]}-01`, area: "Corporativo", country: "Chile", provider: "", client: "", product: expense.name, category: "OPEX", amountUsd: value / fx, source: "Modelo OPEX" })));
  const transversalRows = transversal?.months.flatMap<BudgetRecord>((row) => [
    { date: `${row.month}-01`, area: "Transversal", country: "Chile", provider: "Red interbancaria", client: "YOL1", product: "Interbancaria y otros", category: "Revenue", amountUsd: row.revenueUsd, source: "Modelo Transversal" },
    { date: `${row.month}-01`, area: "Transversal", country: "Chile", provider: "Red interbancaria", client: "YOL1", product: "Interbancaria y otros", category: "Costo directo", amountUsd: row.costUsd, source: "Modelo Transversal" },
  ]) ?? [];
  return [...enterpriseRows, ...b2cRows, ...smbRows, ...transversalRows, ...opexRows].filter((row) => row.amountUsd !== 0);
}

export function periodKey(dateValue: string, grain: TimeGrain) {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (grain === "year") return String(year);
  if (grain === "quarter") return `${year}-T${Math.floor((month - 1) / 3) + 1}`;
  if (grain === "month") return `${year}-${String(month).padStart(2, "0")}`;
  if (grain === "day") return date.toISOString().slice(0, 10);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return `Sem ${date.toISOString().slice(0, 10)}`;
}

function matches(row: Pick<ActualRecord, "area" | "country" | "provider" | "client" | "product" | "category">, filters: FinancialFilters) {
  return (["area", "country", "provider", "client", "product", "category"] as const).every((key) => !filters[key] || row[key] === filters[key]);
}

export function compareBudgetActual(budget: BudgetRecord[], actuals: ActualRecord[], grain: TimeGrain, filters: FinancialFilters) {
  const rows = new Map<string, { period: string; category: FinancialCategory; budget: number; actual: number }>();
  function add(dataset: "budget" | "actual", row: BudgetRecord | ActualRecord) {
    if (!matches(row, filters)) return;
    const period = periodKey(row.date, grain);
    const key = `${period}|${row.category}`;
    const result = rows.get(key) ?? { period, category: row.category, budget: 0, actual: 0 };
    result[dataset] += row.amountUsd;
    rows.set(key, result);
  }
  budget.forEach((row) => add("budget", row));
  actuals.forEach((row) => add("actual", row));
  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period) || a.category.localeCompare(b.category)).map((row) => ({ ...row, variance: row.actual - row.budget, variancePercent: row.budget ? (row.actual - row.budget) / row.budget : null }));
}
