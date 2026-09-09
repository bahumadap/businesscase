import { addMonths, monthDifference } from "../forecast-engine";
import type { OpexCategory, OpexExpense, OpexForecastMonth, OpexPlan } from "./types";

export const OPEX_CATEGORIES: OpexCategory[] = ["Servicios profesionales", "Gastos TI", "Ferias", "Gastos generales", "Depreciación y amortizaciones", "Marketing", "Remuneraciones y honorarios", "Gastos bancarios", "Pérdidas operacionales"];

export function expenseAmountAt(expense: OpexExpense, month: string) {
  if (!expense.enabled) return 0;
  const override = expense.monthlyOverrides[month];
  if (override !== undefined) return Math.max(0, Number(override) || 0);
  const monthsFromBase = monthDifference(expense.baseMonth, month);
  if (monthsFromBase < 0) return 0;
  if (expense.growthMode === "monthly") return expense.baseAmountClp * Math.pow(1 + expense.growthRate, monthsFromBase);
  if (expense.growthMode === "annual") return expense.baseAmountClp * Math.pow(1 + expense.growthRate, monthsFromBase / 12);
  return expense.baseAmountClp;
}

export function calculateOpexForecast(plan: OpexPlan, startMonth = plan.modelStartMonth, horizonMonths = plan.horizonMonths) {
  const calendar = Array.from({ length: horizonMonths }, (_, index) => addMonths(startMonth, index));
  const enabled = plan.expenses.filter((expense) => expense.enabled);
  const baseTotal = enabled.reduce((sum, expense) => sum + expense.baseAmountClp, 0) || plan.ramp.baseTotalClp;
  const totalAt = (month: string) => {
    const elapsed = Math.max(0, monthDifference(plan.ramp.baseMonth, month));
    const progress = Math.min(1, elapsed / Math.max(1, plan.ramp.durationMonths));
    return plan.ramp.baseTotalClp + (plan.ramp.targetTotalClp - plan.ramp.baseTotalClp) * progress;
  };
  const byExpense = plan.expenses.map((expense, expenseIndex) => ({ ...expense, values: calendar.map((month) => {
    const override = expense.monthlyOverrides[month];
    if (override !== undefined) return Math.max(0, Number(override) || 0);
    const total = totalAt(month);
    const preceding = enabled.slice(0, Math.max(0, enabled.findIndex((item) => item.id === expense.id))).reduce((sum, item) => sum + item.baseAmountClp / baseTotal * total, 0);
    const isLastEnabled = expense.id === enabled.at(-1)?.id;
    return isLastEnabled ? total - preceding : expense.baseAmountClp / baseTotal * total;
  }) }));
  const months: OpexForecastMonth[] = calendar.map((month, index) => {
    const byCategory = Object.fromEntries(OPEX_CATEGORIES.map((category) => [category, byExpense.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.values[index], 0)])) as Record<OpexCategory, number>;
    return {
      month,
      byCategory,
      totalClp: Object.values(byCategory).reduce((sum, value) => sum + value, 0),
      pending: plan.expenses.some((expense) => expense.enabled && expense.status !== "Validado"),
    };
  });
  return { calendar, byExpense, months };
}
