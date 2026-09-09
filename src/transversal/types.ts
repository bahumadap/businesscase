export type InterbankLink = {
  id: string;
  name: string;
  sourceMode: "enterprise_client" | "enterprise_product" | "manual";
  enterpriseClientId?: string;
  enterpriseProductId?: string;
  goLiveMonth: string;
  manualMonthlyTransactions: number;
  inboundRatio: number;
  outboundRatio: number;
  bancoEstadoMix: number;
  status: "Validado" | "Por validar";
};

export type TransversalEntry = {
  id: string;
  name: string;
  category: "Licencias" | "Auspicios" | "Patrocinios" | "Otros ingresos" | "Otros costos";
  direction: "revenue" | "cost";
  startMonth: string;
  endMonth?: string;
  amountUsd: number;
  frequency: "monthly" | "one_off";
  status: "Validado" | "Por validar";
};

export type TransversalPlan = {
  version: number;
  modelStartMonth: string;
  horizonMonths: 36;
  ufClp: number;
  interbankRates: {
    bancoEstadoInboundUf: number;
    bancoEstadoOutboundUf: number;
    otherBanksInboundUf: number;
    otherBanksOutboundUf: number;
  };
  links: InterbankLink[];
  entries: TransversalEntry[];
  updatedAt: string;
};

export type TransversalForecastMonth = {
  month: string;
  ufUsd: number;
  inboundTransactions: number;
  outboundTransactions: number;
  interbankRevenueUsd: number;
  interbankCostUsd: number;
  otherRevenueUsd: number;
  otherCostUsd: number;
  revenueUsd: number;
  costUsd: number;
  contributionMarginUsd: number;
  pending: boolean;
};
