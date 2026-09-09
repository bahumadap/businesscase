import type { ProvidersPlan } from "./types";

export const PROVIDERS_SEED: ProvidersPlan = {
  version: 1,
  providers: [
    { id: "floid", name: "Floid", country: "Chile", currency: "CLP", status: "Activo", owner: "Enterprise", validFrom: "2026-01-01", validTo: "2027-12-31", notes: "Iniciación de pagos." },
    { id: "radar", name: "Radar", country: "Chile", currency: "CLP", status: "Inactivo", owner: "Benchmark", validFrom: "2026-01-01", validTo: "2027-12-31", notes: "Referencia histórica de ProntoPaga; no es costo del nuevo producto YOL1." },
    { id: "csa-api", name: "CSA / API Payouts", country: "Chile", currency: "CLP", status: "En negociación", owner: "Enterprise", validFrom: "2027-02-01", validTo: "2027-12-31", notes: "Costo por llamada API. La interbancaria se administra en Negocios Transversales." },
    { id: "cvfx-rail", name: "Riel CV+FX", country: "Regional", currency: "USD", status: "En negociación", owner: "Enterprise", validFrom: "2026-09-01", validTo: "2027-12-31", notes: "Condiciones diferenciadas por país." },
  ],
  conditions: [
    { id: "floid-init", providerId: "floid", product: "Iniciación de Pagos", service: "Payment initiation", pricingModel: "Por unidad", fixedFee: 0, unitFee: 40, percentageRate: 0, minVolume: 0, maxVolume: null, assumedMonthlyVolume: 720000, assumedMonthlyTpv: 0, currency: "CLP", fxToUsd: 930, country: "Chile", validFrom: "2026-09-01", validTo: "2027-12-31", status: "Validado" },
    { id: "csa-payout-api", providerId: "csa-api", product: "Payouts", service: "Llamada API", pricingModel: "Por unidad", fixedFee: 0, unitFee: 10, percentageRate: 0, minVolume: 0, maxVolume: null, assumedMonthlyVolume: 900000, assumedMonthlyTpv: 0, currency: "CLP", fxToUsd: 930, country: "Chile", validFrom: "2027-02-01", validTo: "2027-12-31", status: "Por validar" },
  ],
  updatedAt: "2026-08-21T00:00:00.000Z",
};
