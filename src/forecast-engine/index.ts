export type PricingRule =
  | { kind: "take_rate"; rate: number }
  | { kind: "fee_per_unit"; fee: number };

export type CostRule =
  | { kind: "rate"; rate: number }
  | { kind: "per_unit"; fee: number };

export type ProductForecastInput = {
  id: string;
  name: string;
  verticalId: string;
  goLiveMonth: string;
  driverCurve: number[];
  monthlyGrowthAfterCurve?: number;
  pricing: PricingRule;
  directCost: CostRule;
  fxToReporting?: number;
};

export type CostForecastInput = {
  id: string;
  name: string;
  startMonth: string;
  endMonth?: string;
  amount: number;
  frequency: "monthly" | "one_off";
  fxToReporting?: number;
};

export type ForecastMonth = {
  month: string;
  driver: number;
  revenue: number;
  directCost: number;
  contributionMargin: number;
};

export type ConsolidatedMonth = ForecastMonth & {
  generalCosts: number;
  operatingResult: number;
  netCashFlow: number;
  endingCash: number;
};

function parseMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

export function addMonths(month: string, offset: number) {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDifference(fromMonth: string, toMonth: string) {
  const from = parseMonth(fromMonth);
  const to = parseMonth(toMonth);
  return (to.year - from.year) * 12 + to.monthIndex - from.monthIndex;
}

export function buildForecastCalendar(startMonth: string, horizonMonths = 36) {
  return Array.from({ length: horizonMonths }, (_, index) => addMonths(startMonth, index));
}

function driverAtMonth(input: ProductForecastInput, monthSinceGoLive: number) {
  if (monthSinceGoLive < 0 || input.driverCurve.length === 0) return 0;
  if (monthSinceGoLive < input.driverCurve.length) return input.driverCurve[monthSinceGoLive];
  const finalCurveValue = input.driverCurve.at(-1) ?? 0;
  const monthsAfterCurve = monthSinceGoLive - input.driverCurve.length + 1;
  return finalCurveValue * Math.pow(1 + (input.monthlyGrowthAfterCurve ?? 0), monthsAfterCurve);
}

export function calculateProductForecast(
  input: ProductForecastInput,
  startMonth: string,
  horizonMonths = 36,
): ForecastMonth[] {
  const fx = input.fxToReporting ?? 1;
  if (fx <= 0) throw new Error("fxToReporting must be greater than zero");

  return buildForecastCalendar(startMonth, horizonMonths).map((month) => {
    const driver = driverAtMonth(input, monthDifference(input.goLiveMonth, month));
    const revenueLocal = input.pricing.kind === "take_rate" ? driver * input.pricing.rate : driver * input.pricing.fee;
    const directCostLocal = input.directCost.kind === "rate" ? driver * input.directCost.rate : driver * input.directCost.fee;
    const revenue = revenueLocal / fx;
    const directCost = directCostLocal / fx;
    return { month, driver, revenue, directCost, contributionMargin: revenue - directCost };
  });
}

export function calculateCostForecast(input: CostForecastInput, startMonth: string, horizonMonths = 36) {
  const fx = input.fxToReporting ?? 1;
  return buildForecastCalendar(startMonth, horizonMonths).map((month) => {
    const active = monthDifference(input.startMonth, month) >= 0 && (!input.endMonth || monthDifference(month, input.endMonth) >= 0);
    const isApplicable = active && (input.frequency === "monthly" || month === input.startMonth);
    return { month, amount: isApplicable ? input.amount / fx : 0 };
  });
}

export function calculateConsolidatedForecast(options: {
  startMonth: string;
  horizonMonths?: number;
  products: ProductForecastInput[];
  costs: CostForecastInput[];
  startingCash?: number;
}) {
  const horizonMonths = options.horizonMonths ?? 36;
  const calendar = buildForecastCalendar(options.startMonth, horizonMonths);
  const productForecasts = options.products.map((product) => ({ product, months: calculateProductForecast(product, options.startMonth, horizonMonths) }));
  const costForecasts = options.costs.map((cost) => calculateCostForecast(cost, options.startMonth, horizonMonths));
  let endingCash = options.startingCash ?? 0;

  const months: ConsolidatedMonth[] = calendar.map((month, monthIndex) => {
    const productMonths = productForecasts.map((forecast) => forecast.months[monthIndex]);
    const revenue = productMonths.reduce((sum, item) => sum + item.revenue, 0);
    const directCost = productMonths.reduce((sum, item) => sum + item.directCost, 0);
    const contributionMargin = revenue - directCost;
    const generalCosts = costForecasts.reduce((sum, forecast) => sum + forecast[monthIndex].amount, 0);
    const operatingResult = contributionMargin - generalCosts;
    const netCashFlow = operatingResult;
    endingCash += netCashFlow;
    return { month, driver: productMonths.reduce((sum, item) => sum + item.driver, 0), revenue, directCost, contributionMargin, generalCosts, operatingResult, netCashFlow, endingCash };
  });

  const byVertical = new Map<string, { revenue: number; directCost: number; contributionMargin: number }>();
  for (const forecast of productForecasts) {
    const current = byVertical.get(forecast.product.verticalId) ?? { revenue: 0, directCost: 0, contributionMargin: 0 };
    for (const month of forecast.months) {
      current.revenue += month.revenue;
      current.directCost += month.directCost;
      current.contributionMargin += month.contributionMargin;
    }
    byVertical.set(forecast.product.verticalId, current);
  }

  return { months, byVertical, productForecasts };
}

export function summarizeYears(months: ConsolidatedMonth[]) {
  return [0, 1, 2].map((yearIndex) => {
    const slice = months.slice(yearIndex * 12, yearIndex * 12 + 12);
    return {
      year: yearIndex + 1,
      revenue: slice.reduce((sum, month) => sum + month.revenue, 0),
      directCost: slice.reduce((sum, month) => sum + month.directCost, 0),
      contributionMargin: slice.reduce((sum, month) => sum + month.contributionMargin, 0),
      generalCosts: slice.reduce((sum, month) => sum + month.generalCosts, 0),
      operatingResult: slice.reduce((sum, month) => sum + month.operatingResult, 0),
    };
  });
}
