"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { calculateSmbForecast } from "../smb/engine";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan, SmbProduct } from "../smb/types";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });

type Tab = "summary" | "products" | "growth" | "costs" | "cashflow";
type MatrixRow = { label: string; values: number[]; annual: number[]; tone: "revenue" | "cost" | "margin"; emphasis?: boolean; indent?: boolean; percentage?: boolean };

function annualSums(values: number[]) {
  return [0, 1, 2].map((year) => values.slice(year * 12, year * 12 + 12).reduce((sum, value) => sum + value, 0));
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "\u00a0");
}

function NumericInput({ label, value, step = 1, suffix, onChange, warning = false }: { label: string; value: number; step?: number; suffix: string; onChange: (value: number) => void; warning?: boolean }) {
  return <label className={warning ? "smb-input warning" : "smb-input"}><span>{label}</span><div><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /><small>{suffix}</small></div></label>;
}

export function SMBPlanner() {
  const [plan, setPlan] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [saveState, setSaveState] = useState<"loading" | "saved" | "dirty" | "error">("loading");
  const [showProductForm, setShowProductForm] = useState(false);
  const [productDraft, setProductDraft] = useState({ name: "", category: "SMB comercial" as SmbProduct["category"], goLiveMonth: "2027-01", revenueUsdPerCompany: 0, costUsdPerCompany: 0 });
  const forecast = useMemo(() => calculateSmbForecast(plan), [plan]);
  const totals = useMemo(() => forecast.months.reduce((result, month) => ({ revenue: result.revenue + month.revenue, directCost: result.directCost + month.directCost, margin: result.margin + month.contributionMargin }), { revenue: 0, directCost: 0, margin: 0 }), [forecast.months]);
  const annual = useMemo(() => [0, 1, 2].map((year) => {
    const rows = forecast.months.slice(year * 12, year * 12 + 12);
    const revenue = rows.reduce((sum, month) => sum + month.revenue, 0);
    const directCost = rows.reduce((sum, month) => sum + month.directCost, 0);
    return { year: 2027 + year, revenue, directCost, margin: revenue - directCost, pending: rows.some((month) => month.pending) };
  }), [forecast.months]);

  useEffect(() => {
    let active = true;
    fetch("/api/smb", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("load"))).then(({ plan: stored }: { plan: SmbPlan | null }) => {
      if (!active) return;
      if (stored?.products && stored?.factorPlace && stored?.commercial && stored?.sgr) setPlan(stored);
      setSaveState("saved");
    }).catch(() => active && setSaveState("error"));
    return () => { active = false; };
  }, []);

  function changePlan(update: (current: SmbPlan) => SmbPlan) {
    setPlan((current) => update(current));
    setSaveState("dirty");
  }

  async function savePlan() {
    setSaveState("loading");
    const next = { ...plan, version: plan.version + 1, updatedAt: new Date().toISOString() };
    try {
      const response = await fetch("/api/smb", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("save");
      setPlan(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const factor = plan.factorPlace;
  const commercial = plan.commercial;
  const sgr = plan.sgr;
  const patchFactor = (patch: Partial<SmbPlan["factorPlace"]>) => changePlan((current) => ({ ...current, factorPlace: { ...current.factorPlace, ...patch } }));
  const patchCommercial = (patch: Partial<SmbPlan["commercial"]>) => changePlan((current) => ({ ...current, commercial: { ...current.commercial, ...patch } }));
  const patchSgr = (patch: Partial<SmbPlan["sgr"]>) => changePlan((current) => ({ ...current, sgr: { ...current.sgr, ...patch } }));
  const patchSgrRate = (key: keyof SmbPlan["sgr"]["annualRates"], value: number) => patchSgr({ annualRates: { ...sgr.annualRates, [key]: value } });
  const updateProduct = (productId: SmbProduct["id"], patch: Partial<SmbProduct>) => changePlan((current) => ({ ...current, products: current.products.map((product) => product.id === productId ? { ...product, ...patch } : product) }));
  const addProduct = (event: React.FormEvent) => {
    event.preventDefault();
    if (!productDraft.name.trim()) return;
    const product: SmbProduct = {
      id: crypto.randomUUID(),
      name: productDraft.name.trim(),
      category: productDraft.category,
      goLiveMonth: productDraft.goLiveMonth,
      sourceStatus: "Por validar",
      customRevenueClpPerCompany: Number(productDraft.revenueUsdPerCompany) * plan.clpPerUsd,
      customCostClpPerCompany: Number(productDraft.costUsdPerCompany) * plan.clpPerUsd,
    };
    changePlan((current) => ({ ...current, products: [...current.products, product] }));
    setProductDraft({ name: "", category: "SMB comercial", goLiveMonth: plan.modelStartMonth, revenueUsdPerCompany: 0, costUsdPerCompany: 0 });
    setShowProductForm(false);
  };

  const productSeries = plan.products.map((product) => {
    const rows = forecast.productForecasts.filter((row) => row.productId === product.id);
    const series = (field: "revenue" | "directCost" | "contributionMargin") => forecast.calendar.map((month) => rows.find((row) => row.month === month)?.[field] ?? 0);
    return { product, revenue: series("revenue"), directCost: series("directCost").map((value) => -value), margin: series("contributionMargin") };
  });
  const revenueSeries = forecast.months.map((month) => month.revenue);
  const directCostSeries = forecast.months.map((month) => -month.directCost);
  const marginSeries = forecast.months.map((month) => month.contributionMargin);
  const annualRevenue = annualSums(revenueSeries);
  const annualMargin = annualSums(marginSeries);
  const matrixSections: { title: string; subtitle: string; rows: MatrixRow[] }[] = [
    { title: "Revenue SMB", subtitle: "Ingresos por producto", rows: [...productSeries.map(({ product, revenue }) => ({ label: product.name, values: revenue, annual: annualSums(revenue), tone: "revenue" as const, indent: true })), { label: "Revenue total SMB", values: revenueSeries, annual: annualRevenue, tone: "revenue", emphasis: true }] },
    { title: "Costos directos", subtitle: "Costos atribuibles al producto; sin OPEX corporativo", rows: [...productSeries.map(({ product, directCost }) => ({ label: product.name, values: directCost, annual: annualSums(directCost), tone: "cost" as const, indent: true })), { label: "Costos directos totales", values: directCostSeries, annual: annualSums(directCostSeries), tone: "cost", emphasis: true }] },
    { title: "Margen de contribución", subtitle: "Revenue menos costos directos", rows: [...productSeries.map(({ product, margin }) => ({ label: product.name, values: margin, annual: annualSums(margin), tone: "margin" as const, indent: true })), { label: "Margen de contribución", values: marginSeries, annual: annualMargin, tone: "margin", emphasis: true }, { label: "Margen %", values: forecast.months.map((month) => month.revenue ? month.contributionMargin / month.revenue : 0), annual: annualRevenue.map((value, index) => value ? annualMargin[index] / value : 0), tone: "margin", emphasis: true, percentage: true }] },
  ];

  return <>
    <div className="enterprise-toolbar"><div className={`save-state ${saveState}`}><i></i><span>{saveState === "saved" ? "Cambios guardados" : saveState === "dirty" ? "Cambios sin guardar" : saveState === "loading" ? "Guardando…" : "No se pudo conectar"}</span></div><button className="primary-action compact" type="button" onClick={savePlan} disabled={saveState === "loading"}>Guardar SMB</button></div>
    <nav className="enterprise-tabs" aria-label="Secciones del modelo SMB">{([['summary', 'Resumen gerencial'], ['products', 'Productos y supuestos'], ['growth', 'Drivers y crecimiento'], ['costs', 'Costos directos'], ['cashflow', 'Flujo de caja']] as [Tab, string][]).map(([id, label]) => <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)} type="button">{label}</button>)}</nav>

    {activeTab === "summary" && <>
      <section className="enterprise-kpis cash-kpis">
        <article><span>Revenue SMB · 36M</span><strong>{usd.format(totals.revenue / plan.clpPerUsd)}</strong><small>{clp.format(totals.revenue)} · FX {number.format(plan.clpPerUsd)}</small></article>
        <article className={totals.margin >= 0 ? "positive-card" : "negative-card"}><span>Margen contribución · 36M</span><strong>{usd.format(totals.margin / plan.clpPerUsd)}</strong><small>{totals.revenue ? percent.format(totals.margin / totals.revenue) : "—"}</small></article>
        <article><span>Empresas · Mes 24</span><strong>{number.format(forecast.months[23]?.companies ?? 0)}</strong><small>Crecimiento 2028: {percent.format(commercial.monthlyCompanyGrowthYear2)} mensual</small></article>
        <article className="attention"><span>Estado del horizonte</span><strong>PARCIAL</strong><small>Fuente recibida hasta {monthLabel(plan.sourceEndMonth)}</small></article>
      </section>
      <article className="panel enterprise-method"><span className="section-kicker">METODOLOGÍA SMB · REPORTING USD</span><strong>Empresas y volumen → Uso del producto → Revenue → Costos directos → Margen</strong><p>La fuente cubre hasta agosto de 2029. Desde septiembre de 2029 el modelo continúa con los drivers editables y queda marcado “Por validar”.</p></article>
      <section className="dashboard-lower-grid smb-summary-grid">
        <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">RESUMEN</span><h2>Economía anual · USD</h2></div><span className="method-chip">36 meses</span></div><div className="table-wrap"><table><thead><tr><th>Año</th><th>Ingresos</th><th>Costos directos</th><th>Contribución</th><th>Margen</th><th>Estado</th></tr></thead><tbody>{annual.map((year) => <tr key={year.year}><td><strong>{year.year}</strong></td><td>{usd.format(year.revenue / plan.clpPerUsd)}</td><td className={year.directCost < 0 ? "value-positive" : "negative-number"}>{usd.format(year.directCost / plan.clpPerUsd)}</td><td>{usd.format(year.margin / plan.clpPerUsd)}</td><td>{year.revenue ? percent.format(year.margin / year.revenue) : "—"}</td><td><span className={year.pending ? "pending-dot" : "complete-dot"}>{year.pending ? "Parcial" : "Completo"}</span></td></tr>)}</tbody></table></div></article>
        <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">COBERTURA</span><h2>Lectura de la fuente</h2></div></div><div className="smb-source-facts"><div><span>Archivo recibido</span><strong>Consolidado Vertical PyME</strong></div><div><span>Productos conectados</span><strong>{plan.products.length}</strong></div><div><span>Moneda base</span><strong>CLP nominal</strong></div><div><span>Meses fuente</span><strong>24</strong></div><div><span>Inicio SGR</span><strong>{monthLabel(sgr.startMonth)}</strong></div><div><span>Margen SGR</span><strong>{percent.format(sgr.targetOperatingMargin)}</strong></div></div></article>
      </section>
      <article className="panel smb-warning-panel"><div className="panel-heading"><div><span className="section-kicker">CONTROLES ABIERTOS</span><h2>Qué falta validar</h2></div><span className="pending-chip">{forecast.warnings.length} pendientes</span></div><div className="smb-warning-list">{forecast.warnings.map((warning, index) => <div key={warning}><strong>{index + 1}</strong><span>{warning}</span></div>)}</div></article>
    </>}

    {activeTab === "products" && <>
      <div className="page-heading enterprise-heading"><div><span className="section-kicker">CATÁLOGO SMB</span><h2>Productos y supuestos</h2><p>Los productos se sincronizan con Catálogo y Roadmap. Un alta nueva usa empresas activas como driver inicial.</p></div><div className="heading-actions"><a className="method-chip" href="/roadmap">Ver Roadmap →</a><button className="primary-action compact" type="button" onClick={() => setShowProductForm((value) => !value)}>+ Nuevo producto</button></div></div>
      {showProductForm && <form className="inline-form product-entry-form smb-product-form" onSubmit={addProduct}><label>Producto<input required value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} placeholder="Nombre del producto" /></label><label>Categoría<select value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value as SmbProduct["category"] })}><option>Factor Place</option><option>SMB comercial</option><option>SGR</option></select></label><label>Go Live<input type="month" value={productDraft.goLiveMonth} onChange={(event) => setProductDraft({ ...productDraft, goLiveMonth: event.target.value })} /></label><label>Revenue USD/empresa<input type="number" min="0" step="any" value={productDraft.revenueUsdPerCompany} onChange={(event) => setProductDraft({ ...productDraft, revenueUsdPerCompany: Number(event.target.value) })} /></label><label>Costo USD/empresa<input type="number" min="0" step="any" value={productDraft.costUsdPerCompany} onChange={(event) => setProductDraft({ ...productDraft, costUsdPerCompany: Number(event.target.value) })} /></label><button className="primary-action compact" type="submit">Agregar producto</button></form>}
      <article className="panel data-panel"><div className="table-wrap"><table className="planning-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Go Live</th><th>Revenue USD/empresa</th><th>Costo USD/empresa</th><th>Revenue 36M</th><th>Costo directo</th><th>Contribución</th><th>Margen</th><th>Estado</th></tr></thead><tbody>{forecast.byProduct.map((product) => { const custom = product.customRevenueClpPerCompany !== undefined || product.customCostClpPerCompany !== undefined; return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.id}</small></td><td>{product.category}</td><td><input className="table-input" type="month" value={product.goLiveMonth} onChange={(event) => updateProduct(product.id, { goLiveMonth: event.target.value })} /></td><td>{custom ? <input className="table-input" type="number" min="0" step="any" value={(product.customRevenueClpPerCompany ?? 0) / plan.clpPerUsd} onChange={(event) => updateProduct(product.id, { customRevenueClpPerCompany: Number(event.target.value) * plan.clpPerUsd })} /> : <span className="validated-chip">Modelo fuente</span>}</td><td>{custom ? <input className="table-input" type="number" min="0" step="any" value={(product.customCostClpPerCompany ?? 0) / plan.clpPerUsd} onChange={(event) => updateProduct(product.id, { customCostClpPerCompany: Number(event.target.value) * plan.clpPerUsd })} /> : <span className="validated-chip">Modelo fuente</span>}</td><td>{usd.format(product.revenue / plan.clpPerUsd)}</td><td>{usd.format(product.directCost / plan.clpPerUsd)}</td><td>{usd.format(product.margin / plan.clpPerUsd)}</td><td>{product.revenue ? percent.format(product.marginPercent) : "—"}</td><td><select className="table-input wide" value={product.sourceStatus} onChange={(event) => updateProduct(product.id, { sourceStatus: event.target.value as SmbProduct["sourceStatus"] })}><option>Fuente</option><option>Por validar</option></select></td></tr>})}</tbody></table></div></article>

      <article className="panel data-panel smb-assumptions"><div className="panel-heading"><div><span className="section-kicker">SUPUESTOS EDITABLES</span><h2>Drivers económicos por familia</h2></div><span className="method-chip">Fuente + ajustes explícitos</span></div>
        <section><h3>Factor Place</h3><div className="smb-assumption-grid">
          <NumericInput label="Flujo inicial" value={factor.initialVolumeMmClp} suffix="MM CLP" onChange={(value) => patchFactor({ initialVolumeMmClp: value })} />
          <NumericInput label="Comisión efectiva" value={factor.effectiveCommissionRate} step={0.0001} suffix="tasa" onChange={(value) => patchFactor({ effectiveCommissionRate: value })} />
          <NumericInput label="Ajuste consolidado" value={factor.signedMonthlyServiceAdjustmentClp} suffix="CLP/mes" warning onChange={(value) => patchFactor({ signedMonthlyServiceAdjustmentClp: value })} />
          <NumericInput label="Ajuste detalle" value={factor.detailMonthlyServiceAdjustmentClp} suffix="CLP/mes" warning onChange={(value) => patchFactor({ detailMonthlyServiceAdjustmentClp: value })} />
        </div></section>
        <section><h3>SMB comercial</h3><div className="smb-assumption-grid">
          <NumericInput label="Empresas activas Remesas" value={commercial.remittanceActiveRate} step={0.01} suffix="tasa" onChange={(value) => patchCommercial({ remittanceActiveRate: value })} />
          <NumericInput label="Operaciones Remesas/año" value={commercial.remittancesPerCompanyYear} suffix="ops" onChange={(value) => patchCommercial({ remittancesPerCompanyYear: value })} />
          <NumericInput label="Fee fijo Remesas" value={commercial.remittanceFixedFeeClp} suffix="CLP/op" onChange={(value) => patchCommercial({ remittanceFixedFeeClp: value })} />
          <NumericInput label="Spread FX" value={commercial.remittanceSpreadRate} step={0.001} suffix="tasa" onChange={(value) => patchCommercial({ remittanceSpreadRate: value })} />
          <NumericInput label="Ticket Remesas" value={commercial.remittanceTicketUsd} suffix="USD/op" onChange={(value) => patchCommercial({ remittanceTicketUsd: value })} />
          <NumericInput label="FX Remesas" value={commercial.remittanceFxClpPerUsd} suffix="CLP/USD" onChange={(value) => patchCommercial({ remittanceFxClpPerUsd: value })} />
          <NumericInput label="Precio Plan Empresa" value={commercial.planPriceUf} step={0.1} suffix="UF/mes" onChange={(value) => patchCommercial({ planPriceUf: value })} />
          <NumericInput label="UF Plan Empresa" value={commercial.planUfClp} step={0.01} suffix="CLP/UF" onChange={(value) => patchCommercial({ planUfClp: value })} />
          <NumericInput label="Adopción Payroll" value={commercial.payrollAdoptionRate} step={0.01} suffix="tasa" onChange={(value) => patchCommercial({ payrollAdoptionRate: value })} />
          <NumericInput label="Ingreso Payroll" value={commercial.payrollRevenueClpPerMonth} suffix="CLP/mes" onChange={(value) => patchCommercial({ payrollRevenueClpPerMonth: value })} />
          <NumericInput label="Adopción Tarjetas" value={commercial.cardAdoptionRate} step={0.01} suffix="tasa" onChange={(value) => patchCommercial({ cardAdoptionRate: value })} />
          <NumericInput label="Ingreso Tarjetas" value={commercial.cardRevenueClpPerMonth} suffix="CLP/mes" onChange={(value) => patchCommercial({ cardRevenueClpPerMonth: value })} />
          <NumericInput label="Adopción Float" value={commercial.floatAdoptionRate} step={0.01} suffix="tasa" onChange={(value) => patchCommercial({ floatAdoptionRate: value })} />
          <NumericInput label="Ingreso Float" value={commercial.floatRevenueClpPerMonth} suffix="CLP/mes" onChange={(value) => patchCommercial({ floatRevenueClpPerMonth: value })} />
        </div></section>
        <section><h3>SGR certificados</h3><div className="smb-assumption-grid">
          <NumericInput label="Capital" value={sgr.capitalUf} suffix="UF" onChange={(value) => patchSgr({ capitalUf: value })} />
          <NumericInput label="UF SGR" value={sgr.ufClp} suffix="CLP/UF" onChange={(value) => patchSgr({ ufClp: value })} />
          <NumericInput label="Apalancamiento" value={sgr.leverage} suffix="x" onChange={(value) => patchSgr({ leverage: value })} />
          <NumericInput label="Utilización" value={sgr.utilizationRate} step={0.01} suffix="tasa" onChange={(value) => patchSgr({ utilizationRate: value })} />
          <NumericInput label="Empresas a capacidad" value={sgr.companiesAtCapacity} suffix="empresas" onChange={(value) => patchSgr({ companiesAtCapacity: value })} />
          <NumericInput label="Tarifa Seriedad" value={sgr.annualRates["sgr-seriedad"]} step={0.001} suffix="tasa anual" onChange={(value) => patchSgrRate("sgr-seriedad", value)} />
          <NumericInput label="Tarifa Fiel" value={sgr.annualRates["sgr-fiel"]} step={0.001} suffix="tasa anual" onChange={(value) => patchSgrRate("sgr-fiel", value)} />
          <NumericInput label="Tarifa Garantía" value={sgr.annualRates["sgr-garantia"]} step={0.001} suffix="tasa anual" onChange={(value) => patchSgrRate("sgr-garantia", value)} />
          <NumericInput label="Tarifa Anticipo" value={sgr.annualRates["sgr-anticipo"]} step={0.001} suffix="tasa anual" onChange={(value) => patchSgrRate("sgr-anticipo", value)} />
          <NumericInput label="Margen operativo" value={sgr.targetOperatingMargin} step={0.01} suffix="tasa" warning onChange={(value) => patchSgr({ targetOperatingMargin: value })} />
        </div></section>
      </article>
    </>}

    {activeTab === "growth" && <>
      <div className="page-heading enterprise-heading"><div><span className="section-kicker">DRIVERS DEL MODELO</span><h2>Empresas, volumen y crecimiento</h2><p>La proyección continúa después de la fuente con crecimiento mensual explícito; ajusta los drivers si cambia el supuesto comercial.</p></div></div>
      <section className="assumption-sections b2c-growth-controls"><article className="panel assumption-form"><h3>Control</h3><label>Inicio del modelo<input type="month" value={plan.modelStartMonth} onChange={(event) => changePlan((current) => ({ ...current, modelStartMonth: event.target.value }))} /></label><label>Fin de fuente<input type="month" value={plan.sourceEndMonth} onChange={(event) => changePlan((current) => ({ ...current, sourceEndMonth: event.target.value }))} /></label><label>FX corporativo CLP / USD<input type="number" min="1" value={plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, clpPerUsd: Number(event.target.value) }))} /></label><NumericInput label="Crecimiento empresas 2028" value={commercial.monthlyCompanyGrowthYear2} step={0.01} suffix="tasa/mes" onChange={(value) => patchCommercial({ monthlyCompanyGrowthYear2: value })} /></article></section>
      <article className="panel data-panel horizontal-cashflow-panel"><div className="panel-heading"><div><span className="section-kicker">CURVAS FUENTE</span><h2>Inputs mensuales editables</h2></div></div><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table"><thead><tr><th>Driver</th>{forecast.calendar.slice(0, 24).map((month, index) => <th key={month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{monthLabel(month)}</th>)}</tr></thead><tbody><tr><th>Empresas</th>{forecast.calendar.slice(0, 24).map((month, index) => <td key={month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{index < 12 ? <input className="table-input" type="number" min="0" value={commercial.companiesYear1[index] ?? 0} onChange={(event) => patchCommercial({ companiesYear1: commercial.companiesYear1.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item) })} /> : number.format(forecast.months[index]?.companies ?? 0)}</td>)}</tr><tr><th>Crecimiento Factor</th>{factor.monthlyGrowth24.map((value, index) => <td key={index} className={(index + 1) % 12 === 0 ? "year-end" : ""}><input className="table-input" type="number" step="0.001" value={value} onChange={(event) => patchFactor({ monthlyGrowth24: factor.monthlyGrowth24.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item) })} /></td>)}</tr></tbody></table></div></article>
      <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">TRAZABILIDAD</span><h2>Forecast mensual de drivers</h2></div><span className="method-chip">24 meses fuente + 12 pendientes</span></div><div className="table-wrap"><table className="planning-table"><thead><tr><th>Mes</th><th>Empresas</th><th>Volumen Factor · MM CLP</th><th>Colocación SGR · CLP</th><th>Estado</th></tr></thead><tbody>{forecast.months.map((month, index) => { const factorRow = forecast.productForecasts.find((row) => row.month === month.month && row.productId === "factor-place"); const sgrRow = forecast.productForecasts.find((row) => row.month === month.month && row.productId === "sgr-seriedad"); return <tr key={month.month}><td><strong>{monthLabel(month.month)}</strong></td><td>{number.format(month.companies)}</td><td>{number.format(factorRow?.driver ?? 0)}</td><td>{clp.format(sgrRow?.driver ?? 0)}</td><td><span className={index < 24 ? "complete-dot" : "pending-dot"}>{index < 24 ? "Fuente" : "Por validar"}</span></td></tr>; })}</tbody></table></div></article>
    </>}

    {activeTab === "costs" && <>
      <div className="page-heading enterprise-heading"><div><span className="section-kicker">COSTOS DIRECTOS SMB</span><h2>Costos atribuibles a productos</h2><p>Esta sección no recibe OPEX corporativo. Los costos comerciales ausentes se mantienen en cero y visibles como pendientes.</p></div><a className="method-chip" href="/opex">Abrir OPEX corporativo →</a></div>
      <article className="panel data-panel"><div className="table-wrap"><table className="planning-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Costo 2027</th><th>Costo 2028</th><th>Costo 2029</th><th>Costo 36M</th><th>Regla / estado</th></tr></thead><tbody>{forecast.byProduct.map((product) => { const rows = forecast.productForecasts.filter((row) => row.productId === product.id); const annualCosts = [0, 1, 2].map((year) => rows.slice(year * 12, year * 12 + 12).reduce((sum, row) => sum + row.directCost, 0)); return <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.category}</td>{annualCosts.map((value, index) => <td key={index}>{usd.format(value / plan.clpPerUsd)}</td>)}<td><strong>{usd.format(product.directCost / plan.clpPerUsd)}</strong></td><td>{product.id === "factor-place" ? "Ajuste firmado de la fuente" : product.category === "SGR" ? `Margen objetivo ${percent.format(sgr.targetOperatingMargin)}` : "Por validar · costo no informado"}</td></tr>; })}</tbody></table></div></article>
      <article className="panel smb-warning-panel"><div className="panel-heading"><div><span className="section-kicker">CONCILIACIÓN DE COSTOS</span><h2>Controles que no deben ocultarse</h2></div></div><div className="smb-warning-list">{forecast.warnings.map((warning, index) => <div key={warning}><strong>{index + 1}</strong><span>{warning}</span></div>)}</div></article>
    </>}

    {activeTab === "cashflow" && <>
      <section className="enterprise-kpis cash-kpis"><article><span>Revenue SMB · 36M</span><strong>{usd.format(totals.revenue / plan.clpPerUsd)}</strong><small>Reporting USD</small></article><article><span>Costos directos · 36M</span><strong>{usd.format(totals.directCost / plan.clpPerUsd)}</strong><small>Sin OPEX corporativo</small></article><article className={totals.margin >= 0 ? "positive-card" : "negative-card"}><span>Contribución · 36M</span><strong>{usd.format(totals.margin / plan.clpPerUsd)}</strong><small>{totals.revenue ? percent.format(totals.margin / totals.revenue) : "—"}</small></article><article className="attention"><span>Estado del horizonte</span><strong>PARCIAL</strong><small><a href="/consolidated">Abrir consolidado →</a></small></article></section>
      <article className="panel cashflow-note"><strong>El flujo SMB sigue la misma lectura que Enterprise y B2C.</strong><span>Los costos directos aparecen como salidas; desde septiembre de 2029 se proyecta con drivers editables y se identifica como pendiente de validación.</span></article>
      <div className="cashflow-legend"><span className="legend-revenue">Revenue USD</span><span className="legend-cost">Costos / salidas USD</span><span className="legend-positive">Margen positivo</span><span className="legend-pending">Mes sin fuente</span></div>
      <article className="panel data-panel horizontal-cashflow-panel"><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table"><thead><tr className="year-band"><th rowSpan={2}>Concepto</th>{[1, 2, 3].map((year) => <th key={year} colSpan={12}>Año {year}</th>)}<th colSpan={3}>Resumen anual</th></tr><tr className="month-band">{forecast.calendar.map((month, index) => <th key={month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{monthLabel(month)}</th>)}{[1, 2, 3].map((year) => <th key={year} className="annual-column">Año {year}</th>)}</tr></thead><tbody>{matrixSections.map((section) => <Fragment key={section.title}><tr className="cashflow-section-row"><th colSpan={40}><strong>{section.title}</strong><span>{section.subtitle} · USD</span></th></tr>{section.rows.map((row) => <tr key={`${section.title}-${row.label}`} className={`${row.tone}-row ${row.emphasis ? "emphasis-row" : ""}`}><th className={row.indent ? "indent-label" : ""}>{row.label}</th>{row.values.map((value, index) => <td key={index} className={`${value < 0 ? "value-negative" : value > 0 && row.tone === "margin" ? "value-positive" : ""} ${(index + 1) % 12 === 0 ? "year-end" : ""}`}>{row.percentage ? percent.format(value) : usd.format(value / plan.clpPerUsd)}</td>)}{row.annual.map((value, index) => <td key={index} className={`annual-column ${value < 0 ? "value-negative" : value > 0 && row.tone === "margin" ? "value-positive" : ""}`}>{row.percentage ? percent.format(value) : usd.format(value / plan.clpPerUsd)}</td>)}</tr>)}</Fragment>)}</tbody><tfoot><tr><th>Estado del mes</th>{forecast.months.map((month, index) => <td key={month.month} className={(index + 1) % 12 === 0 ? "year-end" : ""}><span className={month.sourceCovered ? "complete-dot" : "pending-dot"}>{month.sourceCovered ? "Fuente" : "Por validar"}</span></td>)}{[0, 1, 2].map((year) => <td key={year} className="annual-column"><span className={forecast.months.slice(year * 12, year * 12 + 12).every((month) => month.sourceCovered) ? "complete-dot" : "pending-dot"}>{forecast.months.slice(year * 12, year * 12 + 12).every((month) => month.sourceCovered) ? "Fuente" : "Parcial"}</span></td>)}</tr></tfoot></table></div></article>
    </>}
  </>;
}
