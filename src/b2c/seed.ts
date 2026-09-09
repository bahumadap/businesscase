import type { B2CPlan, B2CProduct } from "./types";

const product = (input: B2CProduct) => input;

export const B2C_SEED: B2CPlan = {
  version: 1,
  modelStartMonth: "2028-03",
  horizonMonths: 36,
  clpPerUsd: 930,
  annualMauGrowthRate: 0.10,
  baseMau12: [0, 2100, 3855, 5422.5, 6897, 8335.2, 9771.12, 11225.172, 12672.8532, 14107.33692, 15529.252152, 16941.8112912],
  startingCashClp: 0,
  consolidatedStartingCashClp: 0,
  products: [
    product({ id: "beneficios", code: "BF", line: "Beneficios Afiliados", segment: "Beneficios", active: false, goLiveMonth: "2028-08", adoptionRate: 0.65, usesPerMonth: 3, completionRate: 0.95, netRate: 0.98, ticketClp: 0, fixedRevenueClpPerTx: 0, variableRevenueRate: 0, yol1Share: 1, provider: "Por definir", fixedCostClpPerTx: 0, variableCostRate: 0, costPerUserClp: 0, riskRate: 0, providerStatus: "Por validar", comment: "Sin monetización hasta validar evidencia contractual" }),
    product({ id: "closed-loop", code: "CL", line: "Pagos Closed Loop", segment: "Closed Loop", active: true, goLiveMonth: "2028-03", adoptionRate: 0.35, usesPerMonth: 4, completionRate: 0.97, netRate: 0.985, ticketClp: 15000, fixedRevenueClpPerTx: 0, variableRevenueRate: 0.015, yol1Share: 0.60, provider: "Proveedor por definir", fixedCostClpPerTx: 25, variableCostRate: 0.003, costPerUserClp: 50, riskRate: 0.002, providerStatus: "Por validar", comment: "Economía merchant-funded" }),
    product({ id: "cash-in", code: "CI", line: "Cash In / Out", segment: "Cash In", active: true, goLiveMonth: "2028-06", adoptionRate: 1, usesPerMonth: 4, completionRate: 0.99, netRate: 0.998, ticketClp: 80000, fixedRevenueClpPerTx: 120, variableRevenueRate: 0, yol1Share: 1, provider: "Proveedor Cash In", fixedCostClpPerTx: 0, variableCostRate: 0, costPerUserClp: 0, riskRate: 0, providerStatus: "Por validar", comment: "Ingreso fijo por transacción" }),
    product({ id: "cash-out", code: "CO", line: "Cash In / Out", segment: "Cash Out", active: true, goLiveMonth: "2028-06", adoptionRate: 0.40, usesPerMonth: 1.5, completionRate: 0.99, netRate: 0.995, ticketClp: 0, fixedRevenueClpPerTx: 0, variableRevenueRate: 0, yol1Share: 1, provider: "Proveedor Cash Out", fixedCostClpPerTx: 120, variableCostRate: 0, costPerUserClp: 0, riskRate: 0, providerStatus: "Por validar", comment: "Costo fijo por transacción" }),
    product({ id: "pago-tarjeta", code: "PT", line: "Pago Tarjeta", segment: "Pago Tarjeta", active: true, goLiveMonth: "2028-07", adoptionRate: 0.55, usesPerMonth: 12, completionRate: 0.98, netRate: 0.995, ticketClp: 25000, fixedRevenueClpPerTx: 0, variableRevenueRate: 0.0094, yol1Share: 0.65, provider: "Procesador por definir", fixedCostClpPerTx: 15, variableCostRate: 0.002, costPerUserClp: 100, riskRate: 0.001, providerStatus: "Por validar", comment: "Share YOL1 aplicado al ingreso variable" }),
    product({ id: "transferencias", code: "TR", line: "Transferencias", segment: "Transferencias", active: true, goLiveMonth: "2028-06", adoptionRate: 0.40, usesPerMonth: 3, completionRate: 0.99, netRate: 0.998, ticketClp: 0, fixedRevenueClpPerTx: 0, variableRevenueRate: 0, yol1Share: 1, provider: "Riel por definir", fixedCostClpPerTx: 50, variableCostRate: 0, costPerUserClp: 0, riskRate: 0.0002, providerStatus: "Por validar", comment: "Sin ingreso cargado en la base" }),
    product({ id: "remesas", code: "RM", line: "Remesas", segment: "Remesas", active: true, goLiveMonth: "2028-03", adoptionRate: 0.10, usesPerMonth: 1, completionRate: 0.98, netRate: 0.995, ticketClp: 190000, fixedRevenueClpPerTx: 0, variableRevenueRate: 0.03, yol1Share: 1, provider: "Proveedor remesas", fixedCostClpPerTx: 0, variableCostRate: 0.02, costPerUserClp: 0, riskRate: 0, providerStatus: "Por validar", comment: "Ruta activa consolidada" }),
    product({ id: "pago-servicios", code: "PS", line: "Pago Servicios", segment: "Pago Servicios", active: true, goLiveMonth: "2028-08", adoptionRate: 0.35, usesPerMonth: 1.5, completionRate: 0.98, netRate: 0.995, ticketClp: 0, fixedRevenueClpPerTx: 100, variableRevenueRate: 0, yol1Share: 1, provider: "Agregador por definir", fixedCostClpPerTx: 50, variableCostRate: 0, costPerUserClp: 0, riskRate: 0, providerStatus: "Por validar", comment: "Ingreso y costo fijos por transacción" }),
  ],
  costs: [],
  updatedAt: "2026-08-20T00:00:00.000Z",
};
