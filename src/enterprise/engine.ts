import { addMonths, monthDifference } from "../forecast-engine";
import type { EnterpriseClient, EnterpriseForecastMonth, EnterprisePlan, EnterpriseProductId } from "./types";

export type ClientForecastMonth = {
  month: string;
  clientId: string;
  productId: EnterpriseProductId;
  monthSinceGoLive: number;
  volume: number;
  revenue: number;
  directCost: number;
  contributionMargin: number;
  pending: boolean;
};

function volumeAt(plan: EnterprisePlan, clientId: string, monthSinceGoLive: number) {
  if (monthSinceGoLive < 0) return { volume: 0, pending: false };
  const segment = plan.volumeSegments.find((item) => item.clientId === clientId && monthSinceGoLive >= item.fromMonth && monthSinceGoLive <= item.toMonth);
  if (!segment) return { volume: 0, pending: true };
  if (segment.volume === null) {
    const lastValidated = plan.volumeSegments
      .filter((item) => item.clientId === clientId && item.volume !== null && item.fromMonth <= monthSinceGoLive)
      .sort((left, right) => right.toMonth - left.toMonth)[0];
    return { volume: lastValidated?.volume ?? 0, pending: true };
  }
  return { volume: segment.volume, pending: segment.status === "Por validar" };
}

function cvfxDirectCost(plan: EnterprisePlan, client: EnterpriseClient, volume: number, monthSinceGoLive: number) {
  const provider = plan.assumptions.cvfxProviders.find((item) => item.country === client.country) ?? plan.assumptions.cvfxProviders[0];
  if (!provider || volume === 0) return 0;
  const swiftTicket = client.country === "Perú" && monthSinceGoLive < 6
    ? 1_500_000
    : client.country === "Chile" && monthSinceGoLive < 3
      ? 1_500_000
      : provider.steadySwiftTicketUsd;
  const swift = (volume / swiftTicket) * provider.swiftCostUsd;
  const localRail = (volume / provider.localTicketUsd) * provider.localRailCostUsd;
  const payout = (volume / 1_000_000) * provider.payoutsPerMillionTpv * provider.payoutCostUsd;
  return swift + localRail + payout;
}

function economics(plan: EnterprisePlan, client: EnterpriseClient, volume: number, monthSinceGoLive: number) {
  if (client.productId === "cvfx") {
    const revenue = volume * (client.spread ?? plan.assumptions.cvfxDefaultSpread);
    const directCost = cvfxDirectCost(plan, client, volume, monthSinceGoLive);
    return { revenue, directCost };
  }
  if (client.productId === "payment-initiation") {
    return {
      revenue: volume * (client.priceClp ?? plan.assumptions.paymentInitiationPriceClp) / plan.clpPerUsd,
      directCost: volume * plan.assumptions.paymentInitiationProviderCostClp / plan.clpPerUsd,
    };
  }
  if (client.productId === "payouts") {
    const mix = client.bancoEstadoMix ?? plan.assumptions.payoutDefaultBancoEstadoMix;
    const priceClp = mix * plan.assumptions.payoutPriceBancoEstadoClp + (1 - mix) * plan.assumptions.payoutPriceOtherBanksClp;
    const apiCostClp = plan.assumptions.payoutApiCostClp ?? 10;
    return { revenue: volume * priceClp / plan.clpPerUsd, directCost: volume * apiCostClp / plan.clpPerUsd };
  }
  const product = plan.products.find((item) => item.id === client.productId);
  return {
    revenue: volume * (product?.customPriceUsdPerUnit ?? 0),
    directCost: volume * (product?.customCostUsdPerUnit ?? 0),
  };
}

export function calculateEnterpriseForecast(plan: EnterprisePlan) {
  const calendar = Array.from({ length: plan.horizonMonths }, (_, index) => addMonths(plan.modelStartMonth, index));
  const clientForecasts = plan.clients.flatMap((client) => calendar.map<ClientForecastMonth>((month) => {
    const monthSinceGoLive = monthDifference(client.goLiveMonth, month);
    const driver = volumeAt(plan, client.id, monthSinceGoLive);
    const result = economics(plan, client, driver.volume, monthSinceGoLive);
    return { month, clientId: client.id, productId: client.productId, monthSinceGoLive, volume: driver.volume, revenue: result.revenue, directCost: result.directCost, contributionMargin: result.revenue - result.directCost, pending: driver.pending };
  }));

  let enterpriseEndingCash = plan.enterpriseStartingCashUsd;
  let consolidatedEndingCash = plan.consolidatedStartingCashUsd;
  const months: EnterpriseForecastMonth[] = calendar.map((month) => {
    const rows = clientForecasts.filter((item) => item.month === month);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const directCost = rows.reduce((sum, item) => sum + item.directCost, 0);
    const contributionMargin = revenue - directCost;
    const activeCosts = plan.costs.filter((cost) => monthDifference(cost.startMonth, month) >= 0 && (!cost.endMonth || monthDifference(month, cost.endMonth) >= 0) && (cost.frequency === "monthly" || cost.startMonth === month));
    const enterpriseCosts = activeCosts.filter((cost) => cost.scope !== "consolidated").reduce((sum, cost) => sum + cost.amountUsd, 0);
    const consolidatedCosts = activeCosts.reduce((sum, cost) => sum + cost.amountUsd, 0);
    const enterpriseCashFlow = contributionMargin - enterpriseCosts;
    const consolidatedCashFlow = contributionMargin - consolidatedCosts;
    enterpriseEndingCash += enterpriseCashFlow;
    consolidatedEndingCash += consolidatedCashFlow;
    return { month, revenue, directCost, contributionMargin, enterpriseCosts, consolidatedCosts, enterpriseCashFlow, consolidatedCashFlow, enterpriseEndingCash, consolidatedEndingCash, pending: rows.some((item) => item.pending) };
  });

  const byProduct = plan.products.map((product) => {
    const rows = clientForecasts.filter((item) => item.productId === product.id);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const margin = rows.reduce((sum, item) => sum + item.contributionMargin, 0);
    const annualRevenue = [0, 1, 2].map((year) => rows.filter((item) => calendar.indexOf(item.month) >= year * 12 && calendar.indexOf(item.month) < year * 12 + 12).reduce((sum, item) => sum + item.revenue, 0));
    const pendingYears = [0, 1, 2].map((year) => rows.some((item) => calendar.indexOf(item.month) >= year * 12 && calendar.indexOf(item.month) < year * 12 + 12 && item.pending));
    const goLive = plan.clients.filter((client) => client.productId === product.id).map((client) => client.goLiveMonth).sort()[0] ?? "—";
    return { ...product, goLive, annualRevenue, pendingYears, revenue, margin, marginPercent: revenue ? margin / revenue : 0 };
  });
  const totalRevenue = byProduct.reduce((sum, item) => sum + item.revenue, 0);
  const totalMargin = byProduct.reduce((sum, item) => sum + item.margin, 0);
  return { calendar, clientForecasts, months, byProduct: byProduct.map((item) => ({ ...item, revenueShare: totalRevenue ? item.revenue / totalRevenue : 0, marginShare: totalMargin ? item.margin / totalMargin : 0 })), pendingAssumptions: plan.volumeSegments.filter((item) => item.status === "Por validar" || item.volume === null).length };
}
