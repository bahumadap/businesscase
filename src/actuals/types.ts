export type FinancialCategory = "Revenue" | "Costo directo" | "OPEX";

export type ActualRecord = {
  id: string;
  date: string;
  area: "Enterprise" | "B2C" | "SMB" | "Transversal" | "Corporativo";
  country: string;
  provider: string;
  client: string;
  product: string;
  category: FinancialCategory;
  amountUsd: number;
  notes: string;
};

export type ActualsPlan = { version: number; records: ActualRecord[]; updatedAt: string };
export type TimeGrain = "year" | "quarter" | "month" | "week" | "day";
export type BudgetRecord = Omit<ActualRecord, "id" | "notes"> & { source: string };
