import { calculateDashboardForecast } from "../dashboard/engine";
import type { B2CPlan } from "../b2c/types";
import type { EnterprisePlan } from "../enterprise/types";
import type { OpexPlan } from "../opex/types";
import type { SmbPlan } from "../smb/types";
import type { TransversalPlan } from "../transversal/types";
import type { ScenarioOverride } from "./types";

export function applyScenarioToEnterprise(plan: EnterprisePlan, scenario: ScenarioOverride): EnterprisePlan {
  return { ...plan, clients: plan.clients.map((client) => client.productId === "payouts" ? { ...client, goLiveMonth: scenario.payoutsGoLiveMonth } : client) };
}

export function calculateScenarioForecast(enterprise: EnterprisePlan, b2c: B2CPlan, smb: SmbPlan, opex: OpexPlan, transversal: TransversalPlan, scenario: ScenarioOverride) {
  const base = calculateDashboardForecast(applyScenarioToEnterprise(enterprise, scenario), b2c, smb, opex, transversal);
  const months = base.months.map((row) => {
    const revenue = row.revenue * scenario.revenueMultiplier;
    const directCosts = row.directCosts * scenario.directCostMultiplier;
    const contributionMargin = revenue - directCosts;
    const totalCosts = directCosts + row.opexTotal;
    return { ...row, revenue, directCosts, contributionMargin, totalCosts, operatingResult: revenue - totalCosts };
  });
  const annual = [0, 1, 2].map((year) => {
    const rows = months.slice(year * 12, year * 12 + 12);
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const directCosts = rows.reduce((sum, row) => sum + row.directCosts, 0);
    const contributionMargin = rows.reduce((sum, row) => sum + row.contributionMargin, 0);
    const opexTotal = rows.reduce((sum, row) => sum + row.opexTotal, 0);
    const operatingResult = rows.reduce((sum, row) => sum + row.operatingResult, 0);
    return { year: year + 1, revenue, directCosts, contributionMargin, opexTotal, operatingResult, marginPercent: revenue ? contributionMargin / revenue : 0 };
  });
  const revenue = months.reduce((sum, row) => sum + row.revenue, 0);
  const directCosts = months.reduce((sum, row) => sum + row.directCosts, 0);
  const contributionMargin = months.reduce((sum, row) => sum + row.contributionMargin, 0);
  const opexTotal = months.reduce((sum, row) => sum + row.opexTotal, 0);
  const operatingResult = months.reduce((sum, row) => sum + row.operatingResult, 0);
  let cash = enterprise.consolidatedStartingCashUsd;
  const cashMonths = months.map((row) => { cash += row.operatingResult; return { ...row, endingCash: cash }; });
  return { ...base, months: cashMonths, annual, totals: { ...base.totals, revenue, directCosts, contributionMargin, opexTotal, operatingResult, endingCash: cash, marginPercent: revenue ? contributionMargin / revenue : 0 } };
}
