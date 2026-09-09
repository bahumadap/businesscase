export type OpexCategory = "Servicios profesionales" | "Gastos TI" | "Ferias" | "Gastos generales" | "Depreciación y amortizaciones" | "Marketing" | "Remuneraciones y honorarios" | "Gastos bancarios" | "Pérdidas operacionales";
export type OpexGrowthMode = "fixed" | "monthly" | "annual";

export type OpexExpense = {
  id: string;
  name: string;
  category: OpexCategory;
  enabled: boolean;
  baseMonth: string;
  baseAmountClp: number;
  growthMode: OpexGrowthMode;
  growthRate: number;
  status: "Validado" | "Por validar" | "Por clasificar";
  source: string;
  notes: string;
  monthlyOverrides: Record<string, number>;
};

export type OpexPlan = {
  version: number;
  modelStartMonth: string;
  horizonMonths: 36;
  ramp: {
    baseMonth: string;
    baseTotalClp: number;
    targetTotalClp: number;
    durationMonths: number;
  };
  expenses: OpexExpense[];
  updatedAt: string;
};

export type OpexForecastMonth = {
  month: string;
  totalClp: number;
  byCategory: Record<OpexCategory, number>;
  pending: boolean;
};
