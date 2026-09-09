"use client";

import { useEffect, useMemo, useState } from "react";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan } from "../b2c/types";
import { calculateDashboardForecast } from "../dashboard/engine";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";
import { OPEX_SEED } from "../opex/seed";
import type { OpexPlan } from "../opex/types";
import { periodKey } from "../actuals/engine";
import type { TimeGrain } from "../actuals/types";
import { applyProviderConditionsToEnterprise } from "../providers/engine";
import { PROVIDERS_SEED } from "../providers/seed";
import type { ProvidersPlan } from "../providers/types";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";
import { TRANSVERSAL_SEED } from "../transversal/seed";
import type { TransversalPlan } from "../transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });

export function compactUsd(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const [divisor, suffix] = absolute >= 1_000_000_000 ? [1_000_000_000, "B"] : absolute >= 1_000_000 ? [1_000_000, "M"] : absolute >= 1_000 ? [1_000, "k"] : [1, ""];
  const scaled = absolute / divisor;
  const decimals = divisor === 1 ? 0 : 1;
  const formatted = scaled.toFixed(decimals).replace(/\.0$/, "").replace(".", ",");
  return `${sign}US$${formatted}${suffix ? ` ${suffix}` : ""}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "\u00a0");
}

export function DashboardPlanner() {
  const [enterprisePlan, setEnterprisePlan] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2cPlan, setB2CPlan] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smbPlan, setSmbPlan] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [opexPlan, setOpexPlan] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [providersPlan, setProvidersPlan] = useState<ProvidersPlan>(() => structuredClone(PROVIDERS_SEED));
  const [transversalPlan, setTransversalPlan] = useState<TransversalPlan>(() => structuredClone(TRANSVERSAL_SEED));
  const [loading, setLoading] = useState(true);
  const [grain, setGrain] = useState<TimeGrain>("month");

  useEffect(() => {
    Promise.all([
      fetch("/api/enterprise", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/b2c", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/smb", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/opex", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/providers", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/transversal", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([enterprise, b2c, smb, opex, providers, transversal]: [{ plan: EnterprisePlan | null }, { plan: B2CPlan | null }, { plan: SmbPlan | null }, { plan: OpexPlan | null }, { plan: ProvidersPlan | null }, { plan: TransversalPlan | null }]) => {
      if (enterprise.plan) setEnterprisePlan(enterprise.plan);
      if (b2c.plan) setB2CPlan(b2c.plan);
      if (smb.plan) setSmbPlan(smb.plan);
      if (opex.plan) setOpexPlan(opex.plan);
      if (providers.plan) setProvidersPlan(providers.plan);
      if (transversal.plan) setTransversalPlan(transversal.plan);
    }).finally(() => setLoading(false));
  }, []);

  const dashboard = useMemo(() => calculateDashboardForecast(applyProviderConditionsToEnterprise(enterprisePlan, providersPlan), b2cPlan, smbPlan, opexPlan, transversalPlan), [enterprisePlan, b2cPlan, smbPlan, opexPlan, providersPlan, transversalPlan]);
  const chartPeriods = useMemo(() => {
    const values = new Map<string, { period: string; revenue: number; totalCosts: number }>();
    dashboard.months.forEach((month) => { const period = periodKey(`${month.month}-01`, grain); const current = values.get(period) ?? { period, revenue: 0, totalCosts: 0 }; current.revenue += month.revenue; current.totalCosts += month.totalCosts; values.set(period, current); });
    return [...values.values()];
  }, [dashboard.months, grain]);
  const maxChart = Math.max(1, ...chartPeriods.flatMap((month) => [month.revenue, month.totalCosts]));

  return <>
    <article className="dashboard-live-banner"><div><span className={loading ? "dashboard-live-dot loading" : "dashboard-live-dot"}></span><strong>{loading ? "Cargando modelo integrado" : "Conectado a los flujos reales"}</strong><small>Enterprise + B2C + SMB + Transversal + OPEX</small></div><a href="/consolidated">Abrir flujo consolidado →</a></article>

    <section className="enterprise-kpis cash-kpis dashboard-kpis">
      <article><span>Revenue consolidado · 36M</span><strong>{compactUsd(dashboard.totals.revenue)}</strong><small>Verticales + Transversal · USD</small></article>
      <article className={dashboard.totals.contributionMargin >= 0 ? "positive-card" : "negative-card"}><span>Margen contribución · 36M</span><strong>{compactUsd(dashboard.totals.contributionMargin)}</strong><small>{percent.format(dashboard.totals.marginPercent)} del revenue</small></article>
      <article><span>OPEX consolidado · 36M</span><strong>{compactUsd(dashboard.totals.opexTotal)}</strong><small>Corporativo + costos de verticales</small></article>
      <article className={dashboard.totals.operatingResult >= 0 ? "positive-card" : "negative-card"}><span>Resultado operacional · 36M</span><strong>{compactUsd(dashboard.totals.operatingResult)}</strong><small>{dashboard.firstPositiveMonth ? `Primer mes positivo: ${monthLabel(dashboard.firstPositiveMonth)}` : "Sin mes positivo en el horizonte"}</small></article>
    </section>

    <section className="dashboard-chart-grid">
      <article className="panel dashboard-comparison-panel">
        <div className="panel-heading"><div><span className="section-kicker">EVOLUCIÓN · USD</span><h2>Ingresos vs. costos totales</h2></div><div><div className="dashboard-chart-legend"><span className="revenue-key">Revenue</span><span className="cost-key">Costos directos + OPEX</span></div><div className="grain-control compact-grain">{([['year','Año'],['quarter','Trim.'],['month','Mes'],['week','Sem.'],['day','Día']] as [TimeGrain,string][]).map(([value,label]) => <button className={grain === value ? "active" : ""} type="button" key={value} onClick={() => setGrain(value)}>{label}</button>)}</div></div></div>
        <div className="dashboard-grouped-chart" style={{ gridTemplateColumns: `repeat(${chartPeriods.length}, minmax(9px, 1fr))` }} role="img" aria-label="Comparación de revenue y costos totales durante 36 meses">
          {chartPeriods.map((month, index) => <div className="dashboard-month-group" key={month.period} title={`${month.period} · Revenue ${usd.format(month.revenue)} · Costos ${usd.format(month.totalCosts)}`}><div className="dashboard-bars"><i className="dashboard-revenue-bar" style={{ height: `${Math.max(1, month.revenue / maxChart * 100)}%` }}></i><i className="dashboard-cost-bar" style={{ height: `${Math.max(1, month.totalCosts / maxChart * 100)}%` }}></i></div>{chartPeriods.length <= 12 || index % Math.max(1, Math.floor(chartPeriods.length / 6)) === 0 || index === chartPeriods.length - 1 ? <span>{month.period}</span> : <span></span>}</div>)}
        </div>
      </article>

      <article className="panel dashboard-result-panel">
        <div className="panel-heading"><div><span className="section-kicker">RESULTADO</span><h2>Lectura ejecutiva</h2></div><span className={dashboard.pending ? "pending-chip" : "validated-chip"}>{dashboard.pending ? "Modelo parcial" : "Modelo completo"}</span></div>
        <div className="dashboard-result-number"><span>Resultado operacional acumulado</span><strong className={dashboard.totals.operatingResult < 0 ? "negative-number" : ""}>{usd.format(dashboard.totals.operatingResult)}</strong><small>Caja final modelada: {usd.format(dashboard.totals.endingCash)}</small></div>
        <div className="dashboard-cost-stack"><div><span>Costos directos</span><strong>{compactUsd(dashboard.totals.directCosts)}</strong></div><div><span>OPEX</span><strong>{compactUsd(dashboard.totals.opexTotal)}</strong></div></div>
        <p className="dashboard-warning">SMB ya está integrado. La fuente cubre ene-27 a dic-28; 2029 permanece en cero hasta aprobar nuevos supuestos y costos comerciales.</p>
      </article>
    </section>

    <section className="dashboard-lower-grid">
      <article className="panel dashboard-vertical-panel">
        <div className="panel-heading"><div><span className="section-kicker">COMPOSICIÓN</span><h2>Aporte por vertical</h2></div><span className="method-chip">36 meses</span></div>
        <div className="dashboard-vertical-list">{dashboard.verticals.map((vertical) => <a href={vertical.href} key={vertical.id} className={vertical.status === "Pendiente" ? "pending-vertical" : ""}><i style={{ background: vertical.color }}></i><div><strong>{vertical.name}</strong><span>{vertical.status}</span></div><p><strong>{vertical.status === "Pendiente" ? "Por incorporar" : compactUsd(vertical.id === "transversal" ? vertical.margin : vertical.revenue)}</strong><span>{vertical.status === "Pendiente" ? "Sin cifras" : vertical.id === "transversal" ? "resultado de red" : `${percent.format(vertical.share)} del revenue`}</span></p><b>→</b></a>)}</div>
      </article>

      <article className="panel dashboard-annual-panel">
        <div className="panel-heading"><div><span className="section-kicker">RESUMEN</span><h2>Economía por año</h2></div><a className="ghost-button" href="/consolidated">Ver 36 meses</a></div>
        <div className="table-wrap"><table><thead><tr><th>Métrica</th>{dashboard.annual.map((year) => <th key={year.year}>Año {year.year}</th>)}</tr></thead><tbody><tr><td><strong>Revenue</strong></td>{dashboard.annual.map((year) => <td key={year.year}>{compactUsd(year.revenue)}</td>)}</tr><tr><td>Costos directos</td>{dashboard.annual.map((year) => <td key={year.year} className="negative-number">{compactUsd(-year.directCosts)}</td>)}</tr><tr><td>Margen contribución</td>{dashboard.annual.map((year) => <td key={year.year}>{compactUsd(year.contributionMargin)}<small>{percent.format(year.marginPercent)}</small></td>)}</tr><tr><td>OPEX</td>{dashboard.annual.map((year) => <td key={year.year} className="negative-number">{compactUsd(-year.opexTotal)}</td>)}</tr><tr className="annual-result-row"><td><strong>Resultado operacional</strong></td>{dashboard.annual.map((year) => <td key={year.year} className={year.operatingResult < 0 ? "negative-number" : ""}><strong>{compactUsd(year.operatingResult)}</strong></td>)}</tr></tbody></table></div>
      </article>
    </section>

    <section className="dashboard-action-strip"><a href="/inputs"><strong>Editar todos los inputs</strong><span>Drivers, precios, costos y volúmenes</span></a><a href="/actuals"><strong>+ Cargar o editar Real</strong><span>Registros, variaciones y filtros</span></a><a href="/providers"><strong>Editar proveedores</strong><span>Tarifas, vigencias y monedas</span></a><a href="/roadmap"><strong>Actualizar pipeline</strong><span>Hitos, duración y retrasos</span></a><a href="/imports"><strong>Descargar / cargar datos</strong><span>Round trip de todos los modelos</span></a></section>
  </>;
}
