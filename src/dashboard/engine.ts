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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function calculateDashboardForecast(enterprisePlan: EnterprisePlan, b2cPlan: B2CPlan, smbPlan: SmbPlan, opexPlan: OpexPlan, transversalPlan?: TransversalPlan) {
  const enterprise = calculateEnterpriseForecast(enterprisePlan);
  const b2c = calculateB2CForecast(b2cPlan);
  const smb = calculateSmbForecast(smbPlan);
  const opex = calculateOpexForecast(opexPlan, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths);
  const transversal = transversalPlan ? calculateTransversalForecast({ ...transversalPlan, modelStartMonth: enterprisePlan.modelStartMonth, horizonMonths: enterprisePlan.horizonMonths }, enterprise.clientForecasts, enterprisePlan.clpPerUsd) : null;
  const b2cByMonth = new Map(b2c.months.map((month) => [month.month, month]));
  const smbByMonth = new Map(smb.months.map((month) => [month.month, month]));
  const opexByMonth = new Map(opex.months.map((month) => [month.month, month]));
  const fx = enterprisePlan.clpPerUsd;
  let endingCash = enterprisePlan.consolidatedStartingCashUsd + b2cPlan.consolidatedStartingCashClp / fx;

  const months = enterprise.calendar.map((month, index) => {
    const enterpriseMonth = enterprise.months[index];
    const b2cMonth = b2cByMonth.get(month);
    const opexMonth = opexByMonth.get(month);
    const enterpriseRevenue = enterpriseMonth.revenue;
    const b2cRevenue = (b2cMonth?.revenue ?? 0) / fx;
    const smbMonth = smbByMonth.get(month);
    const smbRevenue = (smbMonth?.revenue ?? 0) / fx;
    const transversalMonth = transversal?.months[index];
    const transversalRevenue = transversalMonth?.revenueUsd ?? 0;
    const transversalCost = transversalMonth?.costUsd ?? 0;
    const revenue = enterpriseRevenue + b2cRevenue + smbRevenue + transversalRevenue;
    const directCosts = enterpriseMonth.directCost + (b2cMonth?.directCost ?? 0) / fx + (smbMonth?.directCost ?? 0) / fx + transversalCost;
    const contributionMargin = revenue - directCosts;
    const corporateOpex = (opexMonth?.totalClp ?? 0) / fx;
    const verticalOpex = enterpriseMonth.consolidatedCosts + (b2cMonth?.consolidatedCosts ?? 0) / fx;
    const opexTotal = corporateOpex + verticalOpex;
    const totalCosts = directCosts + opexTotal;
    const operatingResult = revenue - totalCosts;
    endingCash += operatingResult;
    return { month, enterpriseRevenue, b2cRevenue, smbRevenue, transversalRevenue, transversalCost, revenue, directCosts, contributionMargin, corporateOpex, verticalOpex, opexTotal, totalCosts, operatingResult, endingCash, pending: enterpriseMonth.pending || Boolean(b2cMonth?.pending) || Boolean(smbMonth?.pending) || Boolean(transversalMonth?.pending) || Boolean(opexMonth?.pending) };
  });

  const annual = [0, 1, 2].map((year) => {
    const rows = months.slice(year * 12, year * 12 + 12);
    const revenue = sum(rows.map((month) => month.revenue));
    const directCosts = sum(rows.map((month) => month.directCosts));
    const contributionMargin = sum(rows.map((month) => month.contributionMargin));
    const opexTotal = sum(rows.map((month) => month.opexTotal));
    const operatingResult = sum(rows.map((month) => month.operatingResult));
    return { year: year + 1, revenue, directCosts, contributionMargin, opexTotal, operatingResult, marginPercent: revenue ? contributionMargin / revenue : 0 };
  });

  const revenue = sum(months.map((month) => month.revenue));
  const directCosts = sum(months.map((month) => month.directCosts));
  const contributionMargin = sum(months.map((month) => month.contributionMargin));
  const opexTotal = sum(months.map((month) => month.opexTotal));
  const operatingResult = sum(months.map((month) => month.operatingResult));
  const enterpriseRevenue = sum(months.map((month) => month.enterpriseRevenue));
  const b2cRevenue = sum(months.map((month) => month.b2cRevenue));
  const smbRevenue = sum(months.map((month) => month.smbRevenue));
  const transversalRevenue = sum(months.map((month) => month.transversalRevenue));
  const enterpriseMargin = sum(enterprise.months.map((month) => month.contributionMargin));
  const b2cMargin = sum(months.map((month) => (b2cByMonth.get(month.month)?.contributionMargin ?? 0) / fx));
  const smbMargin = sum(months.map((month) => (smbByMonth.get(month.month)?.contributionMargin ?? 0) / fx));
  const transversalMargin = transversal?.totals.contributionMarginUsd ?? 0;

  return {
    fx,
    calendar: enterprise.calendar,
    months,
    annual,
    totals: { revenue, directCosts, contributionMargin, opexTotal, operatingResult, endingCash: months.at(-1)?.endingCash ?? endingCash, marginPercent: revenue ? contributionMargin / revenue : 0 },
    verticals: [
      { id: "enterprise", name: "Enterprise", href: "/enterprise", revenue: enterpriseRevenue, margin: enterpriseMargin, share: revenue ? enterpriseRevenue / revenue : 0, color: "#80ef0c", status: enterprise.pendingAssumptions ? "Parcial" : "Completo" },
      { id: "b2c", name: "B2C / Personas", href: "/b2c", revenue: b2cRevenue, margin: b2cMargin, share: revenue ? b2cRevenue / revenue : 0, color: "#28b6be", status: b2c.pendingAssumptions ? "Parcial" : "Completo" },
      { id: "smb", name: "SMB", href: "/smb", revenue: smbRevenue, margin: smbMargin, share: revenue ? smbRevenue / revenue : 0, color: "#d8c996", status: smb.pendingAssumptions ? "Parcial" : "Completo" },
      { id: "transversal", name: "Transversal", href: "/transversal", revenue: transversalRevenue, margin: transversalMargin, share: revenue ? transversalRevenue / revenue : 0, color: "#d73169", status: transversal?.pendingAssumptions ? "Parcial" : "Completo" },
    ],
    firstPositiveMonth: months.find((month) => month.operatingResult > 0)?.month ?? null,
    pending: months.some((month) => month.pending),
  };
}
