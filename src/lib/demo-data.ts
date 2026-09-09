import type { CostForecastInput, ProductForecastInput } from "../forecast-engine";

export const DEMO_VERTICALS = [
  { id: "enterprise", name: "Enterprise", description: "Grandes empresas y plataformas", color: "#80ef0c", owner: "Equipo Enterprise" },
  { id: "smb", name: "SMB", description: "Comercios y pequeñas empresas", color: "#6ce0d7", owner: "Equipo SMB" },
  { id: "b2c", name: "B2C", description: "Personas y servicios de consumo", color: "#ff0055", owner: "Equipo B2C" },
];

export const DEMO_PRODUCTS: ProductForecastInput[] = [
  { id: "cv-fx", name: "Cuentas Virtuales + FX", verticalId: "enterprise", goLiveMonth: "2027-03", driverCurve: [20_000_000, 28_000_000, 36_000_000, 44_000_000, 52_000_000, 60_000_000], monthlyGrowthAfterCurve: 0.018, pricing: { kind: "take_rate", rate: 0.0024 }, directCost: { kind: "rate", rate: 0.0008 } },
  { id: "payment-initiation", name: "Iniciación de Pagos", verticalId: "enterprise", goLiveMonth: "2027-01", driverCurve: [80_000, 110_000, 140_000, 175_000, 215_000, 260_000], monthlyGrowthAfterCurve: 0.02, pricing: { kind: "fee_per_unit", fee: 0.08 }, directCost: { kind: "per_unit", fee: 0.045 } },
  { id: "payouts", name: "Payouts", verticalId: "enterprise", goLiveMonth: "2027-08", driverCurve: [30_000, 42_000, 55_000, 68_000, 84_000, 102_000], monthlyGrowthAfterCurve: 0.025, pricing: { kind: "fee_per_unit", fee: 0.45 }, directCost: { kind: "per_unit", fee: 0.31 } },
  { id: "smb-payments", name: "Pagos para Comercios", verticalId: "smb", goLiveMonth: "2027-05", driverCurve: [1_200_000, 2_500_000, 4_200_000, 6_500_000, 9_000_000, 12_000_000], monthlyGrowthAfterCurve: 0.022, pricing: { kind: "take_rate", rate: 0.008 }, directCost: { kind: "rate", rate: 0.0047 } },
  { id: "b2c-remittances", name: "Remesas", verticalId: "b2c", goLiveMonth: "2027-02", driverCurve: [900, 1_200, 1_550, 1_950, 2_400, 2_900], monthlyGrowthAfterCurve: 0.026, pricing: { kind: "fee_per_unit", fee: 5.4 }, directCost: { kind: "per_unit", fee: 3.5 } },
  { id: "b2c-cashinout", name: "Cash In / Out", verticalId: "b2c", goLiveMonth: "2027-06", driverCurve: [2_000, 3_100, 4_400, 5_900, 7_600, 9_400], monthlyGrowthAfterCurve: 0.03, pricing: { kind: "fee_per_unit", fee: 0.14 }, directCost: { kind: "per_unit", fee: 0.05 } },
];

export const DEMO_COSTS: CostForecastInput[] = [
  { id: "office", name: "Oficina", startMonth: "2027-01", amount: 11_000, frequency: "monthly" },
  { id: "software", name: "Software corporativo", startMonth: "2027-01", amount: 6_500, frequency: "monthly" },
  { id: "marketing", name: "Marketing B2C", startMonth: "2027-04", amount: 18_000, frequency: "monthly" },
  { id: "legal", name: "Legal y licencias", startMonth: "2027-09", amount: 42_000, frequency: "one_off" },
];
