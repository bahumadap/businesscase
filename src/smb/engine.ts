import { addMonths, monthDifference } from "../forecast-engine";
import type { SgrProductId, SmbForecastMonth, SmbPlan, SmbProduct, SmbProductId } from "./types";

const SGR_PRODUCT_IDS = new Set<SgrProductId>(["sgr-seriedad", "sgr-fiel", "sgr-garantia", "sgr-anticipo"]);

export type SmbProductForecastMonth = {
  month: string;
  productId: SmbProductId;
  companies: number;
  driver: number;
  revenue: number;
  directCost: number;
  contributionMargin: number;
  pending: boolean;
  sourceCovered: boolean;
};

function factorVolumeMmClpAt(plan: SmbPlan, sourceMonthIndex: number) {
  if (sourceMonthIndex < 0) return 0;
  let volume = plan.factorPlace.initialVolumeMmClp;
  for (let index = 1; index <= sourceMonthIndex; index += 1) {
    volume *= 1 + (plan.factorPlace.monthlyGrowth24[index] ?? plan.factorPlace.monthlyGrowth24.at(-1) ?? 0);
  }
  return volume;
}

export function smbCompaniesAt(plan: SmbPlan, sourceMonthIndex: number) {
  if (sourceMonthIndex < 0) return 0;
  if (sourceMonthIndex < 12) return plan.commercial.companiesYear1[sourceMonthIndex] ?? 0;
  const year1End = plan.commercial.companiesYear1.at(-1) ?? 0;
  return year1End * Math.pow(1 + plan.commercial.monthlyCompanyGrowthYear2, sourceMonthIndex - 11);
}

function productEconomics(plan: SmbPlan, product: SmbProduct, sourceMonthIndex: number, month: string, companies: number) {
  const productId = product.id;
  if (sourceMonthIndex < 0) return { driver: 0, revenue: 0, directCost: 0 };
  if (productId === "factor-place") {
    const volume = factorVolumeMmClpAt(plan, sourceMonthIndex);
    return {
      driver: volume,
      revenue: volume * 1_000_000 * plan.factorPlace.effectiveCommissionRate,
      directCost: -plan.factorPlace.signedMonthlyServiceAdjustmentClp,
    };
  }
  const commercial = plan.commercial;
  if (productId === "remesas") {
    const operations = companies * commercial.remittanceActiveRate * commercial.remittancesPerCompanyYear / 12;
    const unitRevenue = commercial.remittanceFixedFeeClp + commercial.remittanceSpreadRate * commercial.remittanceTicketUsd * commercial.remittanceFxClpPerUsd;
    return { driver: operations, revenue: operations * unitRevenue, directCost: 0 };
  }
  if (productId === "plan-empresa") return { driver: companies, revenue: companies * commercial.planPriceUf * commercial.planUfClp, directCost: 0 };
  if (productId === "payroll") return { driver: companies, revenue: companies * commercial.payrollAdoptionRate * commercial.payrollRevenueClpPerMonth, directCost: 0 };
  if (productId === "tarjetas") return { driver: companies, revenue: companies * commercial.cardAdoptionRate * commercial.cardRevenueClpPerMonth, directCost: 0 };
  if (productId === "float") return { driver: companies, revenue: companies * commercial.floatAdoptionRate * commercial.floatRevenueClpPerMonth, directCost: 0 };
  if (!SGR_PRODUCT_IDS.has(productId as SgrProductId)) {
    if (monthDifference(product.goLiveMonth, month) < 0) return { driver: 0, revenue: 0, directCost: 0 };
    return {
      driver: companies,
      revenue: companies * (product.customRevenueClpPerCompany ?? 0),
      directCost: companies * (product.customCostClpPerCompany ?? 0),
    };
  }
  if (monthDifference(plan.sgr.startMonth, month) < 0) return { driver: 0, revenue: 0, directCost: 0 };
  const maximumPlacement = plan.sgr.capitalUf * plan.sgr.ufClp * plan.sgr.leverage * plan.sgr.utilizationRate;
  const placement = Math.min(maximumPlacement, maximumPlacement * companies / plan.sgr.companiesAtCapacity);
  const annualRate = plan.sgr.annualRates[productId as SgrProductId];
  const revenue = placement * plan.sgr.productShare * annualRate / 12;
  return { driver: placement, revenue, directCost: revenue * (1 - plan.sgr.targetOperatingMargin) };
}

export function calculateSmbForecast(plan: SmbPlan) {
  const calendar = Array.from({ length: plan.horizonMonths }, (_, index) => addMonths(plan.modelStartMonth, index));
  const productForecasts = plan.products.flatMap((product) => calendar.map<SmbProductForecastMonth>((month) => {
    const sourceMonthIndex = monthDifference(plan.modelStartMonth, month);
    const sourceCovered = sourceMonthIndex >= 0 && monthDifference(month, plan.sourceEndMonth) >= 0;
    const companies = smbCompaniesAt(plan, sourceMonthIndex);
    const economics = productEconomics(plan, product, sourceMonthIndex, month, companies);
    const pending = !sourceCovered || (economics.revenue !== 0 && product.sourceStatus === "Por validar");
    return { month, productId: product.id, companies, driver: economics.driver, revenue: economics.revenue, directCost: economics.directCost, contributionMargin: economics.revenue - economics.directCost, pending, sourceCovered };
  }));

  const months: SmbForecastMonth[] = calendar.map((month) => {
    const rows = productForecasts.filter((item) => item.month === month);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const directCost = rows.reduce((sum, item) => sum + item.directCost, 0);
    return {
      month,
      companies: rows[0]?.companies ?? 0,
      revenue,
      directCost,
      contributionMargin: revenue - directCost,
      pending: rows.some((item) => item.pending),
      sourceCovered: rows.every((item) => item.sourceCovered),
    };
  });

  const byProduct = plan.products.map((product) => {
    const rows = productForecasts.filter((item) => item.productId === product.id);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const directCost = rows.reduce((sum, item) => sum + item.directCost, 0);
    const margin = revenue - directCost;
    const annualRevenue = [0, 1, 2].map((year) => rows.slice(year * 12, year * 12 + 12).reduce((sum, item) => sum + item.revenue, 0));
    return { ...product, revenue, directCost, margin, marginPercent: revenue ? margin / revenue : 0, annualRevenue };
  });

  return {
    calendar,
    productForecasts,
    months,
    byProduct,
    pendingAssumptions: 3,
    warnings: [
      "Factor Place: confirmar signo y monto del ajuste mensual (CLP 5,0MM en consolidado vs CLP 1,1MM en detalle).",
      "SMB comercial: costos directos no informados; se mantienen en cero.",
      "Desde septiembre de 2029: proyección editable con la última tasa de Factor Place y crecimiento mensual de empresas.",
    ],
  };
}
