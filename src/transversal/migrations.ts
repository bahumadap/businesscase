import type { InterbankLink, TransversalPlan } from "./types";

const LEGACY_PAYMENT_INITIATION_LINK_ID = "payment-initiation-payins-inbound";

/**
 * Keeps saved plans compatible with the corrected interbank model.
 *
 * The former seed linked every Payment Initiation transaction to inbound
 * interbank revenue. That was not a valid economic driver and materially
 * overstated revenue. Only that known legacy row is migrated; user-created
 * links remain untouched.
 */
export function migrateTransversalPlan(plan: TransversalPlan): TransversalPlan {
  if (!plan.links.some((link) => link.id === LEGACY_PAYMENT_INITIATION_LINK_ID)) return plan;

  const links = plan.links.map<InterbankLink>((link) => link.id === LEGACY_PAYMENT_INITIATION_LINK_ID
    ? {
        id: "xtransfer-interbank-inbound",
        name: "XTransfer · Entrada interbancaria",
        sourceMode: "manual",
        goLiveMonth: "2026-09",
        manualMonthlyTransactions: 10_000,
        inboundRatio: 1,
        outboundRatio: 0,
        bancoEstadoMix: link.bancoEstadoMix,
        status: "Por validar",
      }
    : link);

  return { ...plan, links };
}
