import type { TransversalPlan } from "./types";

export const TRANSVERSAL_SEED: TransversalPlan = {
  version: 3,
  modelStartMonth: "2026-09",
  horizonMonths: 36,
  // Base implícita del costo informado: CLP 423 / 0,01 UF. Siempre editable.
  ufClp: 42_300,
  interbankRates: {
    bancoEstadoInboundUf: 0.01,
    bancoEstadoOutboundUf: 0.01,
    otherBanksInboundUf: 0.0028,
    otherBanksOutboundUf: 0.0028,
  },
  links: [
    {
      id: "xtransfer-interbank-inbound",
      name: "XTransfer · Entrada interbancaria",
      sourceMode: "manual",
      goLiveMonth: "2026-09",
      // Driver transaccional independiente del TPV de CV+FX y de Iniciación de Pagos.
      manualMonthlyTransactions: 10_000,
      inboundRatio: 1,
      outboundRatio: 0,
      bancoEstadoMix: 0.6,
      status: "Por validar",
    },
    {
      id: "prontopaga-payouts-outbound",
      name: "ProntoPaga · Payouts",
      sourceMode: "enterprise_client",
      enterpriseClientId: "prontopaga-payouts",
      goLiveMonth: "2027-02",
      manualMonthlyTransactions: 0,
      inboundRatio: 0,
      outboundRatio: 1,
      bancoEstadoMix: 0.6,
      status: "Validado",
    },
  ],
  entries: [],
  updatedAt: "2026-08-25T00:00:00.000Z",
};
