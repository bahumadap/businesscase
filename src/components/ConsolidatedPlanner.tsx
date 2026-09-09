"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { calculateB2CForecast } from "../b2c/engine";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan } from "../b2c/types";
import { calculateEnterpriseForecast } from "../enterprise/engine";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";
import { calculateOpexForecast, OPEX_CATEGORIES } from "../opex/engine";
import { OPEX_SEED } from "../opex/seed";
import type { OpexPlan } from "../opex/types";
import { calculateSmbForecast } from "../smb/engine";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";
import { calculateTransversalForecast } from "../transversal/engine";
import { TRANSVERSAL_SEED } from "../transversal/seed";
import type { TransversalPlan } from "../transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
type MatrixRow = { label: string; values: number[]; annual: number[]; tone: "revenue" | "cost" | "margin" | "cashflow" | "cash"; emphasis?: boolean; indent?: boolean; percentage?: boolean };
function annualSums(values: number[]) { return [0, 1, 2].map((year) => values.slice(year * 12, year * 12 + 12).reduce((sum, value) => sum + value, 0)); }
function annualEnds(values: number[]) { return [values[11] ?? 0, values[23] ?? 0, values[35] ?? 0]; }
function monthLabel(month: string) { const [year, monthNumber] = month.split("-").map(Number); return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "\u00a0"); }
type PeriodMode = "month" | "quarter";
type PeriodGroup = { label: string; indexes: number[] };
function quarterGroups(calendar: string[]): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();
  calendar.forEach((month, index) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const label = `Q${Math.ceil(monthNumber / 3)} ${year}`;
    const current = groups.get(label) ?? { label, indexes: [] };
    current.indexes.push(index);
    groups.set(label, current);
  });
  return [...groups.values()];
}

function combineForecasts(enterprise: ReturnType<typeof calculateEnterpriseForecast>, b2c: ReturnType<typeof calculateB2CForecast>, smb: ReturnType<typeof calculateSmbForecast>, transversal: ReturnType<typeof calculateTransversalForecast>, opex: ReturnType<typeof calculateOpexForecast>, enterprisePlan: EnterprisePlan, b2cPlan: B2CPlan) {
  const b2cByMonth = new Map(b2c.months.map((month) => [month.month, month]));
  const smbByMonth = new Map(smb.months.map((month) => [month.month, month]));
  const opexByMonth = new Map(opex.months.map((month) => [month.month, month]));
  let endingCash = enterprisePlan.consolidatedStartingCashUsd + b2cPlan.consolidatedStartingCashClp / enterprisePlan.clpPerUsd;
  return enterprise.calendar.map((month, index) => {
    const enterpriseMonth = enterprise.months[index];
    const b2cMonth = b2cByMonth.get(month);
    const b2cRevenue = (b2cMonth?.revenue ?? 0) / enterprisePlan.clpPerUsd;
    const b2cDirectCost = (b2cMonth?.directCost ?? 0) / enterprisePlan.clpPerUsd;
    const b2cMargin = (b2cMonth?.contributionMargin ?? 0) / enterprisePlan.clpPerUsd;
    const smbMonth = smbByMonth.get(month);
    const smbRevenue = (smbMonth?.revenue ?? 0) / enterprisePlan.clpPerUsd;
    const smbDirectCost = (smbMonth?.directCost ?? 0) / enterprisePlan.clpPerUsd;
    const smbMargin = (smbMonth?.contributionMargin ?? 0) / enterprisePlan.clpPerUsd;
    const transversalMonth = transversal.months[index];
    const transversalRevenue = transversalMonth?.revenueUsd ?? 0;
    const transversalDirectCost = transversalMonth?.costUsd ?? 0;
    const transversalMargin = transversalMonth?.contributionMarginUsd ?? 0;
    const enterpriseOpex = enterpriseMonth.consolidatedCosts;
    const b2cOpex = (b2cMonth?.consolidatedCosts ?? 0) / enterprisePlan.clpPerUsd;
    const opexMonth = opexByMonth.get(month);
    const corporateOpex = (opexMonth?.totalClp ?? 0) / enterprisePlan.clpPerUsd;
    const revenue = enterpriseMonth.revenue + b2cRevenue + smbRevenue + transversalRevenue;
    const directCost = enterpriseMonth.directCost + b2cDirectCost + smbDirectCost + transversalDirectCost;
    const contributionMargin = enterpriseMonth.contributionMargin + b2cMargin + smbMargin + transversalMargin;
    const operatingCosts = enterpriseOpex + b2cOpex + corporateOpex;
    const cashFlow = contributionMargin - operatingCosts;
    endingCash += cashFlow;
    const opexByCategory = Object.fromEntries(OPEX_CATEGORIES.map((category) => [category, (opexMonth?.byCategory[category] ?? 0) / enterprisePlan.clpPerUsd]));
    return { month, enterpriseRevenue: enterpriseMonth.revenue, b2cRevenue, smbRevenue, transversalRevenue, enterpriseDirectCost: enterpriseMonth.directCost, b2cDirectCost, smbDirectCost, transversalDirectCost, revenue, directCost, contributionMargin, enterpriseOpex, b2cOpex, corporateOpex, opexByCategory, operatingCosts, cashFlow, endingCash, pending: enterpriseMonth.pending || Boolean(b2cMonth?.pending) || Boolean(smbMonth?.pending) || Boolean(transversalMonth?.pending) || Boolean(opexMonth?.pending) };
  });
}

export function ConsolidatedPlanner() {
  const [enterprisePlan, setEnterprisePlan] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2cPlan, setB2CPlan] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smbPlan, setSmbPlan] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [opexPlan, setOpexPlan] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [transversalPlan, setTransversalPlan] = useState<TransversalPlan>(() => structuredClone(TRANSVERSAL_SEED));
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  useEffect(() => { Promise.all([fetch("/api/enterprise", { cache: "no-store" }).then((response) => response.json()), fetch("/api/b2c", { cache: "no-store" }).then((response) => response.json()), fetch("/api/smb", { cache: "no-store" }).then((response) => response.json()), fetch("/api/opex", { cache: "no-store" }).then((response) => response.json()), fetch("/api/transversal", { cache: "no-store" }).then((response) => response.json())]).then(([enterprise, b2c, smb, opex, transversal]: [{ plan: EnterprisePlan | null }, { plan: B2CPlan | null }, { plan: SmbPlan | null }, { plan: OpexPlan | null }, { plan: TransversalPlan | null }]) => { if (enterprise.plan) setEnterprisePlan(enterprise.plan); if (b2c.plan) setB2CPlan(b2c.plan); if (smb.plan) setSmbPlan(smb.plan); if (opex.plan) setOpexPlan(opex.plan); if (transversal.plan) setTransversalPlan(transversal.plan); }).finally(() => setLoading(false)); }, []);
  const enterprise = useMemo(() => calculateEnterpriseForecast(enterprisePlan), [enterprisePlan]);
  const b2c = useMemo(() => calculateB2CForecast(b2cPlan), [b2cPlan]);
  const smb = useMemo(() => calculateSmbForecast(smbPlan), [smbPlan]);
  const transversal = useMemo(() => calculateTransversalForecast({ ...transversalPlan, modelStartMonth: enterprisePlan.modelStartMonth, horizonMonths: enterprisePlan.horizonMonths }, enterprise.clientForecasts, enterprisePlan.clpPerUsd), [transversalPlan, enterprise, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths, enterprisePlan.clpPerUsd]);
  const opex = useMemo(() => calculateOpexForecast(opexPlan, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths), [opexPlan, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths]);
  const consolidated = useMemo(() => combineForecasts(enterprise, b2c, smb, transversal, opex, enterprisePlan, b2cPlan), [enterprise, b2c, smb, transversal, opex, enterprisePlan, b2cPlan]);
  const revenue = consolidated.map((month) => month.revenue);
  const margin = consolidated.map((month) => month.contributionMargin);
  const annualRevenue = annualSums(revenue);
  const annualMargin = annualSums(margin);
  const totalRevenue = revenue.reduce((sum, value) => sum + value, 0);
  const totalMargin = margin.reduce((sum, value) => sum + value, 0);
  const totalFlow = consolidated.reduce((sum, month) => sum + month.cashFlow, 0);
  const periods = useMemo<PeriodGroup[]>(() => periodMode === "month" ? enterprise.calendar.map((month, index) => ({ label: monthLabel(month), indexes: [index] })) : quarterGroups(enterprise.calendar), [periodMode, enterprise.calendar]);
  const periodValues = (values: number[], percentage = false) => periods.map((period) => percentage
    ? (() => { const revenueForPeriod = period.indexes.reduce((sum, index) => sum + consolidated[index].revenue, 0); return revenueForPeriod ? period.indexes.reduce((sum, index) => sum + consolidated[index].contributionMargin, 0) / revenueForPeriod : 0; })()
    : period.indexes.reduce((sum, index) => sum + values[index], 0));
  const sections: { title: string; subtitle: string; rows: MatrixRow[] }[] = [
    { title: "Revenue consolidado", subtitle: "Enterprise + B2C + SMB + Transversal convertidos a USD", rows: [{ label: "Enterprise", values: consolidated.map((month) => month.enterpriseRevenue), annual: annualSums(consolidated.map((month) => month.enterpriseRevenue)), tone: "revenue", indent: true }, { label: "B2C / Personas", values: consolidated.map((month) => month.b2cRevenue), annual: annualSums(consolidated.map((month) => month.b2cRevenue)), tone: "revenue", indent: true }, { label: "SMB", values: consolidated.map((month) => month.smbRevenue), annual: annualSums(consolidated.map((month) => month.smbRevenue)), tone: "revenue", indent: true }, { label: "Transversal", values: consolidated.map((month) => month.transversalRevenue), annual: annualSums(consolidated.map((month) => month.transversalRevenue)), tone: "revenue", indent: true }, { label: "Revenue YOL1", values: revenue, annual: annualRevenue, tone: "revenue", emphasis: true }] },
    { title: "Economía consolidada", subtitle: "Costos directos, red transversal y margen de contribución", rows: [{ label: "Costos directos · Enterprise", values: consolidated.map((month) => -month.enterpriseDirectCost), annual: annualSums(consolidated.map((month) => -month.enterpriseDirectCost)), tone: "cost", indent: true }, { label: "Costos directos · B2C", values: consolidated.map((month) => -month.b2cDirectCost), annual: annualSums(consolidated.map((month) => -month.b2cDirectCost)), tone: "cost", indent: true }, { label: "Costos directos · SMB", values: consolidated.map((month) => -month.smbDirectCost), annual: annualSums(consolidated.map((month) => -month.smbDirectCost)), tone: "cost", indent: true }, { label: "Costos · Transversal", values: consolidated.map((month) => -month.transversalDirectCost), annual: annualSums(consolidated.map((month) => -month.transversalDirectCost)), tone: "cost", indent: true }, { label: "Costos directos", values: consolidated.map((month) => -month.directCost), annual: annualSums(consolidated.map((month) => -month.directCost)), tone: "cost", emphasis: true }, { label: "Margen de contribución", values: margin, annual: annualMargin, tone: "margin", emphasis: true }, { label: "Margen %", values: consolidated.map((month) => month.revenue ? month.contributionMargin / month.revenue : 0), annual: annualRevenue.map((value, index) => value ? annualMargin[index] / value : 0), tone: "margin", emphasis: true, percentage: true }] },
    { title: "OPEX consolidado", subtitle: "Fuente corporativa única; adicionales de vertical visibles sólo si existen datos heredados", rows: [...OPEX_CATEGORIES.map((category) => ({ label: `OPEX · ${category}`, values: consolidated.map((month) => -month.opexByCategory[category]), annual: annualSums(consolidated.map((month) => -month.opexByCategory[category])), tone: "cost" as const, indent: true })), { label: "Adicional heredado · Enterprise", values: consolidated.map((month) => -month.enterpriseOpex), annual: annualSums(consolidated.map((month) => -month.enterpriseOpex)), tone: "cost", indent: true }, { label: "Adicional heredado · B2C", values: consolidated.map((month) => -month.b2cOpex), annual: annualSums(consolidated.map((month) => -month.b2cOpex)), tone: "cost", indent: true }, { label: "OPEX total consolidado", values: consolidated.map((month) => -month.operatingCosts), annual: annualSums(consolidated.map((month) => -month.operatingCosts)), tone: "cost", emphasis: true }] },
    { title: "Flujo de caja YOL1", subtitle: "Margen de contribución menos OPEX total consolidado", rows: [{ label: "Flujo neto consolidado", values: consolidated.map((month) => month.cashFlow), annual: annualSums(consolidated.map((month) => month.cashFlow)), tone: "cashflow", emphasis: true }, { label: "Caja final consolidada", values: consolidated.map((month) => month.endingCash), annual: annualEnds(consolidated.map((month) => month.endingCash)), tone: "cash", emphasis: true }] },
  ];

  return <>
    <section className="enterprise-kpis cash-kpis"><article><span>Revenue consolidado · 36M</span><strong>{usd.format(totalRevenue)}</strong><small>USD · Enterprise + B2C + SMB</small></article><article className={totalMargin >= 0 ? "positive-card" : "negative-card"}><span>Margen consolidado · 36M</span><strong>{usd.format(totalMargin)}</strong><small>{totalRevenue ? percent.format(totalMargin / totalRevenue) : "—"}</small></article><article className={totalFlow >= 0 ? "positive-card" : "negative-card"}><span>Flujo consolidado · 36M</span><strong>{usd.format(totalFlow)}</strong><small>USD · después de OPEX</small></article><article><span>Moneda de reporte</span><strong>USD</strong><small>FX {enterprisePlan.clpPerUsd.toLocaleString("es-CL")} CLP/USD</small></article></section>
    <article className="panel cashflow-note"><strong>{loading ? "Cargando el consolidado integrado…" : "Todo el consolidado está expresado en USD."}</strong><span>Enterprise, B2C, SMB y OPEX usan el único supuesto CLP/USD administrado en Enterprise.</span></article>
    <div className="enterprise-toolbar"><div className="cashflow-legend"><span className="legend-revenue">Revenue USD</span><span className="legend-cost">Costos / salidas USD</span></div><div className="grain-control compact-grain"><button className={periodMode === "month" ? "active" : ""} onClick={() => setPeriodMode("month")} type="button">Mensual</button><button className={periodMode === "quarter" ? "active" : ""} onClick={() => setPeriodMode("quarter")} type="button">Trimestral</button></div></div>
    <article className="panel data-panel horizontal-cashflow-panel"><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table"><thead><tr className="year-band"><th>Concepto</th><th colSpan={periods.length}>{periodMode === "month" ? "Detalle mensual" : "Vista trimestral"}</th><th colSpan={3}>Resumen anual</th></tr><tr className="month-band"><th></th>{periods.map((period) => <th key={period.label}>{period.label}</th>)}{[1, 2, 3].map((year) => <th key={year} className="annual-column">Año {year}</th>)}</tr></thead><tbody>{sections.map((section) => <Fragment key={section.title}><tr className="cashflow-section-row"><th colSpan={periods.length + 4}><strong>{section.title}</strong><span>{section.subtitle} · USD</span></th></tr>{section.rows.map((row) => <tr key={`${section.title}-${row.label}`} className={`${row.tone}-row ${row.emphasis ? "emphasis-row" : ""}`}><th className={row.indent ? "indent-label" : ""}>{row.label}</th>{periodValues(row.values, row.percentage).map((value, index) => <td key={index} className={value < 0 ? "value-negative" : value > 0 && (row.tone === "margin" || row.tone === "cashflow" || row.tone === "cash") ? "value-positive" : ""}><a className="cashflow-input-link" href="/inputs" title="Abrir los inputs que generan esta cifra">{row.percentage ? percent.format(value) : usd.format(value)}</a></td>)}{row.annual.map((value, index) => <td key={index} className={`annual-column ${value < 0 ? "value-negative" : ""}`}><a className="cashflow-input-link" href="/inputs">{row.percentage ? percent.format(value) : usd.format(value)}</a></td>)}</tr>)}</Fragment>)}</tbody><tfoot><tr><th>Estado</th>{periods.map((period) => { const pending = period.indexes.some((index) => consolidated[index].pending); return <td key={period.label}><span className={pending ? "pending-dot" : "complete-dot"}>{pending ? "Parcial" : "Completo"}</span></td>; })}{[0, 1, 2].map((year) => <td key={year} className="annual-column"><span className={consolidated.slice(year * 12, year * 12 + 12).some((month) => month.pending) ? "pending-dot" : "complete-dot"}>Resumen</span></td>)}</tr></tfoot></table></div></article>
  </>;
}
