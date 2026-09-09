export type Provider = {
  id: string;
  name: string;
  country: string;
  currency: "USD" | "CLP" | "PEN" | "BRL";
  status: "Activo" | "En negociación" | "Inactivo";
  owner: string;
  validFrom: string;
  validTo: string;
  notes: string;
};

export type ProviderCondition = {
  id: string;
  providerId: string;
  product: string;
  service: string;
  pricingModel: "Fijo" | "Por unidad" | "Porcentual" | "Escalonado";
  fixedFee: number;
  unitFee: number;
  percentageRate: number;
  minVolume: number;
  maxVolume: number | null;
  assumedMonthlyVolume: number;
  assumedMonthlyTpv: number;
  currency: "USD" | "CLP" | "PEN" | "BRL";
  fxToUsd: number;
  country: string;
  validFrom: string;
  validTo: string;
  status: "Validado" | "Por validar";
};

export type ProvidersPlan = {
  version: number;
  providers: Provider[];
  conditions: ProviderCondition[];
  updatedAt: string;
};
