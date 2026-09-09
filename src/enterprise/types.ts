export type EnterpriseProductId = string;

export type EnterpriseProduct = {
  id: EnterpriseProductId;
  name: string;
  driver: "TPV" | "Transacciones" | "Payouts";
  unit: "USD" | "tx" | "payouts";
  customPriceUsdPerUnit?: number;
  customCostUsdPerUnit?: number;
};

export type EnterpriseClient = {
  id: string;
  name: string;
  country: string;
  productId: EnterpriseProductId;
  goLiveMonth: string;
  status: string;
  owner: string;
  priceClp?: number;
  spread?: number;
  bancoEstadoMix?: number;
};

export type VolumeSegment = {
  id: string;
  clientId: string;
  fromMonth: number;
  toMonth: number;
  volume: number | null;
  status: "Validado" | "Por validar";
};

export type PlanningCost = {
  id: string;
  name: string;
  scope: "consolidated" | "enterprise" | "product";
  productId?: EnterpriseProductId;
  startMonth: string;
  endMonth?: string;
  amountUsd: number;
  frequency: "monthly" | "one_off";
};

export type CvfxProviderAssumption = {
  country: string;
  swiftCostUsd: number;
  localRailCostUsd: number;
  payoutCostUsd: number;
  localTicketUsd: number;
  steadySwiftTicketUsd: number;
  payoutsPerMillionTpv: number;
};

export type EnterprisePlan = {
  version: number;
  modelStartMonth: string;
  horizonMonths: 36;
  clpPerUsd: number;
  enterpriseStartingCashUsd: number;
  consolidatedStartingCashUsd: number;
  products: EnterpriseProduct[];
  clients: EnterpriseClient[];
  volumeSegments: VolumeSegment[];
  costs: PlanningCost[];
  assumptions: {
    cvfxDefaultSpread: number;
    paymentInitiationPriceClp: number;
    paymentInitiationProviderCostClp: number;
    payoutPriceBancoEstadoClp: number;
    payoutPriceOtherBanksClp: number;
    payoutApiCostClp: number;
    /** @deprecated La interbancaria se modela en Negocios Transversales. */
    payoutCostBancoEstadoClp: number;
    /** @deprecated La interbancaria se modela en Negocios Transversales. */
    payoutCostOtherBanksClp: number;
    payoutDefaultBancoEstadoMix: number;
    cvfxProviders: CvfxProviderAssumption[];
  };
  updatedAt: string;
};

export type EnterpriseForecastMonth = {
  month: string;
  revenue: number;
  directCost: number;
  contributionMargin: number;
  enterpriseCosts: number;
  consolidatedCosts: number;
  enterpriseCashFlow: number;
  consolidatedCashFlow: number;
  enterpriseEndingCash: number;
  consolidatedEndingCash: number;
  pending: boolean;
};
