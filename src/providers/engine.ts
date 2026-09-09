import type { ProviderCondition } from "./types";
import type { ProvidersPlan } from "./types";
import type { EnterprisePlan } from "../enterprise/types";

export function conditionMonthlyBudgetUsd(condition: ProviderCondition) {
  if (condition.pricingModel === "Escalonado" && (condition.assumedMonthlyVolume < condition.minVolume || (condition.maxVolume !== null && condition.assumedMonthlyVolume > condition.maxVolume))) return 0;
  const fixed = condition.fixedFee;
  const unit = condition.unitFee * condition.assumedMonthlyVolume;
  const percentage = condition.percentageRate * condition.assumedMonthlyTpv;
  const nativeAmount = condition.pricingModel === "Fijo" ? fixed : condition.pricingModel === "Por unidad" ? fixed + unit : condition.pricingModel === "Porcentual" ? fixed + percentage : fixed + unit + percentage;
  return condition.currency === "USD" ? nativeAmount : nativeAmount / Math.max(0.000001, condition.fxToUsd);
}

export function applyProviderConditionsToEnterprise(plan: EnterprisePlan, providers: ProvidersPlan) {
  const validated = providers.conditions.filter((row) => row.status === "Validado");
  const validAt = (condition: ProviderCondition, month: string) =>
    (!condition.validFrom || condition.validFrom.slice(0, 7) <= month) && (!condition.validTo || condition.validTo.slice(0, 7) >= month);
  const conditionFor = (productName: string, month: string) => validated.find((row) => row.product.trim().toLowerCase() === productName.trim().toLowerCase() && validAt(row, month));
  const initiation = conditionFor("Iniciación de Pagos", plan.modelStartMonth);
  const payoutApi = conditionFor("Payouts", plan.modelStartMonth);
  const productCosts = new Map(plan.products.map((product) => [product.id, product.customCostUsdPerUnit]));
  for (const product of plan.products) {
    const productName = product.name.trim().toLowerCase();
    const condition = validated.find((row) => row.product.trim().toLowerCase() === productName && validAt(row, plan.clients.find((client) => client.productId === product.id)?.goLiveMonth ?? plan.modelStartMonth));
    if (condition?.pricingModel === "Por unidad") {
      productCosts.set(product.id, condition.unitFee / Math.max(0.000001, condition.fxToUsd));
    }
  }
  return {
    ...plan,
    products: plan.products.map((product) => ({ ...product, customCostUsdPerUnit: productCosts.get(product.id) ?? product.customCostUsdPerUnit })),
    assumptions: {
      ...plan.assumptions,
      paymentInitiationProviderCostClp: initiation?.currency === "CLP" ? initiation.unitFee : plan.assumptions.paymentInitiationProviderCostClp,
      payoutApiCostClp: payoutApi?.currency === "CLP" ? payoutApi.unitFee : plan.assumptions.payoutApiCostClp ?? 10,
    },
  };
}
