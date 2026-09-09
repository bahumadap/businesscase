import type { OpexExpense, OpexPlan } from "./types";

const expense = (input: Omit<OpexExpense, "enabled" | "baseMonth" | "source" | "monthlyOverrides">): OpexExpense => ({
  ...input,
  enabled: true,
  baseMonth: "2025-12",
  source: "20251014_Yol1_Model_v01.xlsx · GtosOpex",
  monthlyOverrides: {},
});

export const OPEX_SEED: OpexPlan = {
  version: 1,
  modelStartMonth: "2027-03",
  horizonMonths: 36,
  ramp: { baseMonth: "2027-03", baseTotalClp: 238_216_000, targetTotalClp: 300_000_000, durationMonths: 12 },
  expenses: [
    expense({ id: "services", name: "Servicios profesionales", category: "Servicios profesionales", baseAmountClp: 191_719_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026; Finance + Tech." }),
    expense({ id: "it", name: "Gastos TI", category: "Gastos TI", baseAmountClp: 38_885_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026." }),
    expense({ id: "fairs", name: "Ferias", category: "Ferias", baseAmountClp: 3_725_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026." }),
    expense({ id: "general", name: "Gastos generales", category: "Gastos generales", baseAmountClp: 1_068_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026." }),
    expense({ id: "depreciation", name: "Depreciación y amortizaciones", category: "Depreciación y amortizaciones", baseAmountClp: 2_464_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026." }),
    expense({ id: "marketing", name: "Marketing", category: "Marketing", baseAmountClp: 0, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Base julio 2026: cero." }),
    expense({ id: "payroll", name: "Remuneraciones y honorarios", category: "Remuneraciones y honorarios", baseAmountClp: 354_000, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Composición consolidada de julio 2026." }),
    expense({ id: "bank", name: "Gastos bancarios", category: "Gastos bancarios", baseAmountClp: 0, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Base julio 2026: cero." }),
    expense({ id: "losses", name: "Pérdidas operacionales", category: "Pérdidas operacionales", baseAmountClp: 0, growthMode: "fixed", growthRate: 0, status: "Validado", notes: "Base julio 2026: cero." }),
  ],
  updatedAt: "2026-08-20T00:00:00.000Z",
};
