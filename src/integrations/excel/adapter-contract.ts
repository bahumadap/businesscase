export type CanonicalForecastRow = {
  periodMonth: string;
  verticalCode: string;
  productCode: string;
  countryCode?: string;
  clientExternalId?: string;
  volume?: number;
  customers?: number;
  users?: number;
  transactions?: number;
  revenue?: number;
  directCost?: number;
  contributionMargin?: number;
  sourceCurrency: string;
  sourceSheet: string;
  sourceRow: number;
};

export type ImportValidationIssue = {
  severity: "warning" | "error";
  sheet?: string;
  row?: number;
  column?: string;
  message: string;
};

export type AdapterResult = {
  rows: CanonicalForecastRow[];
  issues: ImportValidationIssue[];
  metadata: { adapterKey: string; sourceFileName: string };
};

export interface ExcelAdapter {
  readonly key: "enterprise" | "smb" | "b2c";
  canHandle(fileName: string, sheetNames: string[]): boolean;
  parse(file: ArrayBuffer, fileName: string): Promise<AdapterResult>;
}
