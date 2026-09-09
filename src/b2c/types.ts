export type B2CProduct = {
  id: string;
  code: string;
  line: string;
  segment: string;
  active: boolean;
  goLiveMonth: string;
  adoptionRate: number;
  usesPerMonth: number;
  completionRate: number;
  netRate: number;
  ticketClp: number;
  fixedRevenueClpPerTx: number;
  variableRevenueRate: number;
  yol1Share: number;
  provider: string;
  fixedCostClpPerTx: number;
  variableCostRate: number;
  costPerUserClp: number;
  riskRate: number;
  providerStatus: "Validado" | "Por validar";
  comment: string;
};

export type B2CCost = {
  id: string;
  name: string;
  scope: "b2c" | "product" | "consolidated";
  category: "direct" | "opex";
  productId?: string;
  startMonth: string;
  endMonth?: string;
  amountClp: number;
  frequency: "monthly" | "one_off";
};

export type B2CPlan = {
  version: number;
  modelStartMonth: string;
  horizonMonths: 36;
  clpPerUsd: number;
  annualMauGrowthRate: number;
  baseMau12: number[];
  startingCashClp: number;
  consolidatedStartingCashClp: number;
  products: B2CProduct[];
  costs: B2CCost[];
  updatedAt: string;
};

export type B2CForecastMonth = {
  month: string;
  mau: number;
  revenue: number;
  directCost: number;
  contributionMargin: number;
  b2cCosts: number;
  consolidatedCosts: number;
  b2cCashFlow: number;
  consolidatedCashFlow: number;
  b2cEndingCash: number;
  consolidatedEndingCash: number;
  pending: boolean;
};
