import { addMonths, monthDifference } from "../forecast-engine";
import type { ClientForecastMonth } from "../enterprise/engine";
import { migrateTransversalPlan } from "./migrations";
import type { TransversalForecastMonth, TransversalPlan } from "./types";

type LinkMonth = {
  month: string;
  linkId: string;
  sourceTransactions: number;
  inboundTransactions: number;
  outboundTransactions: number;
  interbankRevenueUsd: number;
  interbankCostUsd: number;
  contributionMarginUsd: number;
  pending: boolean;
};

function isActive(month: string, startMonth: string, endMonth?: string) {
  return monthDifference(startMonth, month) >= 0 && (!endMonth || monthDifference(month, endMonth) >= 0);
}

export function calculateTransversalForecast(plan: TransversalPlan, enterpriseClientForecasts: ClientForecastMonth[], clpPerUsd: number) {
  const effectivePlan = migrateTransversalPlan(plan);
  const calendar = Array.from({ length: effectivePlan.horizonMonths }, (_, index) => addMonths(effectivePlan.modelStartMonth, index));
  const safeFx = clpPerUsd > 0 ? clpPerUsd : 1;
  const ufUsd = effectivePlan.ufClp / safeFx;
  const linkForecasts = effectivePlan.links.flatMap((link) => calendar.map<LinkMonth>((month) => {
    const linkedRows = link.sourceMode === "enterprise_client"
      ? enterpriseClientForecasts.filter((row) => row.clientId === link.enterpriseClientId && row.month === month)
      : link.sourceMode === "enterprise_product"
        ? enterpriseClientForecasts.filter((row) => row.productId === link.enterpriseProductId && row.month === month)
        : [];
    const sourceTransactions = link.sourceMode === "manual"
      ? isActive(month, link.goLiveMonth) ? link.manualMonthlyTransactions : 0
      : linkedRows.reduce((sum, row) => sum + row.volume, 0);
    const inboundTransactions = sourceTransactions * link.inboundRatio;
    const outboundTransactions = sourceTransactions * link.outboundRatio;
    const bancoEstadoInbound = inboundTransactions * link.bancoEstadoMix;
    const otherInbound = inboundTransactions - bancoEstadoInbound;
    const bancoEstadoOutbound = outboundTransactions * link.bancoEstadoMix;
    const otherOutbound = outboundTransactions - bancoEstadoOutbound;
    const interbankRevenueUsd = (bancoEstadoInbound * effectivePlan.interbankRates.bancoEstadoInboundUf + otherInbound * effectivePlan.interbankRates.otherBanksInboundUf) * ufUsd;
    const interbankCostUsd = (bancoEstadoOutbound * effectivePlan.interbankRates.bancoEstadoOutboundUf + otherOutbound * effectivePlan.interbankRates.otherBanksOutboundUf) * ufUsd;
    return {
      month,
      linkId: link.id,
      sourceTransactions,
      inboundTransactions,
      outboundTransactions,
      interbankRevenueUsd,
      interbankCostUsd,
      contributionMarginUsd: interbankRevenueUsd - interbankCostUsd,
      pending: link.status === "Por validar" || linkedRows.some((row) => row.pending),
    };
  }));

  const months: TransversalForecastMonth[] = calendar.map((month) => {
    const rows = linkForecasts.filter((row) => row.month === month);
    const entries = effectivePlan.entries.filter((entry) => isActive(month, entry.startMonth, entry.endMonth) && (entry.frequency === "monthly" || entry.startMonth === month));
    const interbankRevenueUsd = rows.reduce((sum, row) => sum + row.interbankRevenueUsd, 0);
    const interbankCostUsd = rows.reduce((sum, row) => sum + row.interbankCostUsd, 0);
    const otherRevenueUsd = entries.filter((entry) => entry.direction === "revenue").reduce((sum, entry) => sum + entry.amountUsd, 0);
    const otherCostUsd = entries.filter((entry) => entry.direction === "cost").reduce((sum, entry) => sum + entry.amountUsd, 0);
    const revenueUsd = interbankRevenueUsd + otherRevenueUsd;
    const costUsd = interbankCostUsd + otherCostUsd;
    return {
      month,
      ufUsd,
      inboundTransactions: rows.reduce((sum, row) => sum + row.inboundTransactions, 0),
      outboundTransactions: rows.reduce((sum, row) => sum + row.outboundTransactions, 0),
      interbankRevenueUsd,
      interbankCostUsd,
      otherRevenueUsd,
      otherCostUsd,
      revenueUsd,
      costUsd,
      contributionMarginUsd: revenueUsd - costUsd,
      pending: rows.some((row) => row.pending) || entries.some((entry) => entry.status === "Por validar"),
    };
  });

  const byLink = effectivePlan.links.map((link) => {
    const rows = linkForecasts.filter((row) => row.linkId === link.id);
    const revenueUsd = rows.reduce((sum, row) => sum + row.interbankRevenueUsd, 0);
    const costUsd = rows.reduce((sum, row) => sum + row.interbankCostUsd, 0);
    return { ...link, revenueUsd, costUsd, contributionMarginUsd: revenueUsd - costUsd, rows };
  });

  return {
    calendar,
    ufUsd,
    linkForecasts,
    months,
    byLink,
    totals: {
      inboundTransactions: months.reduce((sum, month) => sum + month.inboundTransactions, 0),
      outboundTransactions: months.reduce((sum, month) => sum + month.outboundTransactions, 0),
      revenueUsd: months.reduce((sum, month) => sum + month.revenueUsd, 0),
      costUsd: months.reduce((sum, month) => sum + month.costUsd, 0),
      contributionMarginUsd: months.reduce((sum, month) => sum + month.contributionMarginUsd, 0),
    },
    pendingAssumptions: effectivePlan.links.filter((link) => link.status === "Por validar").length + effectivePlan.entries.filter((entry) => entry.status === "Por validar").length,
  };
}
