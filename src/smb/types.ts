export type SmbProductId = string;
export type SgrProductId = "sgr-seriedad" | "sgr-fiel" | "sgr-garantia" | "sgr-anticipo";

export type SmbProduct = {
  id: SmbProductId;
  name: string;
  category: "Factor Place" | "SMB comercial" | "SGR";
  goLiveMonth: string;
  sourceStatus: "Fuente" | "Por validar";
  customRevenueClpPerCompany?: number;
  customCostClpPerCompany?: number;
};

export type SmbPlan = {
  version: number;
  modelStartMonth: string;
  horizonMonths: 36;
  sourceEndMonth: string;
  clpPerUsd: number;
  products: SmbProduct[];
  factorPlace: {
    initialVolumeMmClp: number;
    monthlyGrowth24: number[];
    effectiveCommissionRate: number;
    signedMonthlyServiceAdjustmentClp: number;
    detailMonthlyServiceAdjustmentClp: number;
  };
  commercial: {
    companiesYear1: number[];
    monthlyCompanyGrowthYear2: number;
    remittanceActiveRate: number;
    remittancesPerCompanyYear: number;
    remittanceFixedFeeClp: number;
    remittanceSpreadRate: number;
    remittanceTicketUsd: number;
    remittanceFxClpPerUsd: number;
    planPriceUf: number;
    planUfClp: number;
    payrollAdoptionRate: number;
    payrollRevenueClpPerMonth: number;
    cardAdoptionRate: number;
    cardRevenueClpPerMonth: number;
    floatAdoptionRate: number;
    floatRevenueClpPerMonth: number;
  };
  sgr: {
    startMonth: string;
    capitalUf: number;
    ufClp: number;
    leverage: number;
    utilizationRate: number;
    companiesAtCapacity: number;
    productShare: number;
    annualRates: Record<SgrProductId, number>;
    targetOperatingMargin: number;
  };
  updatedAt: string;
};

export type SmbForecastMonth = {
  month: string;
  companies: number;
  revenue: number;
  directCost: number;
  contributionMargin: number;
  pending: boolean;
  sourceCovered: boolean;
};
