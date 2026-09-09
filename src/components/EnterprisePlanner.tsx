"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { calculateEnterpriseForecast } from "../enterprise/engine";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterpriseClient, EnterprisePlan, EnterpriseProduct, EnterpriseProductId, PlanningCost, VolumeSegment } from "../enterprise/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
type Tab = "summary" | "clients" | "assumptions" | "costs" | "cashflow";
type CashflowTone = "revenue" | "cost" | "margin" | "cashflow" | "cash";
type CashflowRow = { label: string; values: number[]; annual: number[]; tone: CashflowTone; emphasis?: boolean; indent?: boolean; percentage?: boolean };

function annualSums(values: number[]) {
  return [0, 1, 2].map((year) => values.slice(year * 12, year * 12 + 12).reduce((sum, value) => sum + value, 0));
}

function annualEnds(values: number[]) {
  return [values[11] ?? 0, values[23] ?? 0, values[35] ?? 0];
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "\u00a0");
}

export function EnterprisePlanner() {
  const [plan, setPlan] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [saveState, setSaveState] = useState<"loading" | "saved" | "dirty" | "error">("loading");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", country: "Chile", productId: "payment-initiation" as EnterpriseProductId, goLiveMonth: "2027-01" });
  const [productDraft, setProductDraft] = useState({ name: "", driver: "Transacciones" as EnterpriseProduct["driver"], unit: "tx" as EnterpriseProduct["unit"], priceUsd: 0, costUsd: 0 });
  const [selectedClientId, setSelectedClientId] = useState("xtransfer-pe");
  const [segmentDraft, setSegmentDraft] = useState({ fromMonth: 12, toMonth: 17, volume: "" });
  const [costDraft, setCostDraft] = useState({ name: "", scope: "enterprise" as PlanningCost["scope"], productId: "cvfx" as EnterpriseProductId, startMonth: "2026-09", amountUsd: 0, frequency: "monthly" as PlanningCost["frequency"] });
  const forecast = useMemo(() => calculateEnterpriseForecast(plan), [plan]);
  const totals = forecast.months.reduce((acc, month) => ({ revenue: acc.revenue + month.revenue, margin: acc.margin + month.contributionMargin, enterpriseCash: acc.enterpriseCash + month.enterpriseCashFlow, consolidatedCash: acc.consolidatedCash + month.consolidatedCashFlow }), { revenue: 0, margin: 0, enterpriseCash: 0, consolidatedCash: 0 });
  const productSeries = plan.products.map((product) => {
    const rows = forecast.clientForecasts.filter((item) => item.productId === product.id);
    const series = (field: "revenue" | "directCost" | "contributionMargin") => forecast.calendar.map((month) => rows.filter((item) => item.month === month).reduce((sum, item) => sum + item[field], 0));
    return { product, revenue: series("revenue"), directCost: series("directCost").map((value) => -value), margin: series("contributionMargin") };
  });
  const revenueSeries = forecast.months.map((month) => month.revenue);
  const directCostSeries = forecast.months.map((month) => -month.directCost);
  const marginSeries = forecast.months.map((month) => month.contributionMargin);
  const marginPercentSeries = forecast.months.map((month) => month.revenue ? month.contributionMargin / month.revenue : 0);
  const annualRevenue = annualSums(revenueSeries);
  const annualMargin = annualSums(marginSeries);
  const cashflowSections: { title: string; subtitle: string; rows: CashflowRow[] }[] = [
    { title: "Revenue Enterprise", subtitle: "Ingresos por producto", rows: [
      ...productSeries.map(({ product, revenue }) => ({ label: product.name, values: revenue, annual: annualSums(revenue), tone: "revenue" as const, indent: true })),
      { label: "Revenue total", values: revenueSeries, annual: annualRevenue, tone: "revenue", emphasis: true },
    ] },
    { title: "Costos directos", subtitle: "Salidas asociadas a la operación", rows: [
      ...productSeries.map(({ product, directCost }) => ({ label: product.name, values: directCost, annual: annualSums(directCost), tone: "cost" as const, indent: true })),
      { label: "Costos directos totales", values: directCostSeries, annual: annualSums(directCostSeries), tone: "cost", emphasis: true },
    ] },
    { title: "Margen de contribución", subtitle: "Revenue menos costos directos", rows: [
      ...productSeries.map(({ product, margin }) => ({ label: product.name, values: margin, annual: annualSums(margin), tone: "margin" as const, indent: true })),
      { label: "Margen de contribución", values: marginSeries, annual: annualMargin, tone: "margin", emphasis: true },
      { label: "Margen %", values: marginPercentSeries, annual: annualRevenue.map((value, index) => value ? annualMargin[index] / value : 0), tone: "margin", emphasis: true, percentage: true },
    ] },
    { title: "Flujo Enterprise", subtitle: "Margen menos gastos Enterprise y de producto", rows: [
      { label: "Costos Enterprise", values: forecast.months.map((month) => -month.enterpriseCosts), annual: annualSums(forecast.months.map((month) => -month.enterpriseCosts)), tone: "cost" },
      { label: "Flujo neto Enterprise", values: forecast.months.map((month) => month.enterpriseCashFlow), annual: annualSums(forecast.months.map((month) => month.enterpriseCashFlow)), tone: "cashflow", emphasis: true },
      { label: "Caja final Enterprise", values: forecast.months.map((month) => month.enterpriseEndingCash), annual: annualEnds(forecast.months.map((month) => month.enterpriseEndingCash)), tone: "cash", emphasis: true },
    ] },
  ];

  useEffect(() => {
    let active = true;
    fetch("/api/enterprise", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("load"))).then((data: { plan: EnterprisePlan | null }) => {
      if (!active) return;
      if (data.plan?.clients && data.plan?.volumeSegments) setPlan(data.plan);
      setSaveState("saved");
    }).catch(() => active && setSaveState("error"));
    return () => { active = false; };
  }, []);

  function changePlan(updater: (current: EnterprisePlan) => EnterprisePlan) {
    setPlan((current) => updater(current));
    setSaveState("dirty");
  }

  async function savePlan() {
    setSaveState("loading");
    const next = { ...plan, updatedAt: new Date().toISOString(), version: plan.version + 1 };
    try {
      const response = await fetch("/api/enterprise", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("save");
      setPlan(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function addClient(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const id = crypto.randomUUID();
    const client: EnterpriseClient = { id, name: draft.name.trim(), country: draft.country, productId: draft.productId, goLiveMonth: draft.goLiveMonth, status: "Planificado", owner: "Por asignar" };
    const segment: VolumeSegment = { id: crypto.randomUUID(), clientId: id, fromMonth: 0, toMonth: 35, volume: null, status: "Por validar" };
    changePlan((current) => ({ ...current, clients: [...current.clients, client], volumeSegments: [...current.volumeSegments, segment] }));
    setSelectedClientId(id);
    setDraft({ name: "", country: "Chile", productId: "payment-initiation", goLiveMonth: "2027-01" });
    setShowClientForm(false);
  }

  function addProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!productDraft.name.trim()) return;
    const id = crypto.randomUUID();
    const product: EnterpriseProduct = {
      id,
      name: productDraft.name.trim(),
      driver: productDraft.driver,
      unit: productDraft.unit,
      customPriceUsdPerUnit: Number(productDraft.priceUsd),
      customCostUsdPerUnit: Number(productDraft.costUsd),
    };
    changePlan((current) => ({ ...current, products: [...current.products, product] }));
    setDraft((current) => ({ ...current, productId: id }));
    setProductDraft({ name: "", driver: "Transacciones", unit: "tx", priceUsd: 0, costUsd: 0 });
    setShowProductForm(false);
  }

  function updateProduct(productId: string, patch: Partial<EnterpriseProduct>) {
    changePlan((current) => ({ ...current, products: current.products.map((product) => product.id === productId ? { ...product, ...patch } : product) }));
  }

  function updateClient(clientId: string, patch: Partial<EnterpriseClient>) {
    changePlan((current) => ({ ...current, clients: current.clients.map((client) => client.id === clientId ? { ...client, ...patch } : client) }));
  }

  function removeClient(clientId: string) {
    changePlan((current) => ({ ...current, clients: current.clients.filter((client) => client.id !== clientId), volumeSegments: current.volumeSegments.filter((segment) => segment.clientId !== clientId) }));
  }

  function updateSegment(segmentId: string, patch: Partial<VolumeSegment>) {
    changePlan((current) => ({ ...current, volumeSegments: current.volumeSegments.map((segment) => segment.id === segmentId ? { ...segment, ...patch } : segment) }));
  }

  function addSegment(event: React.FormEvent) {
    event.preventDefault();
    const parsed = segmentDraft.volume.trim() === "" ? null : Number(segmentDraft.volume);
    const segment: VolumeSegment = { id: crypto.randomUUID(), clientId: selectedClientId, fromMonth: segmentDraft.fromMonth, toMonth: segmentDraft.toMonth, volume: Number.isFinite(parsed) ? parsed : null, status: parsed === null ? "Por validar" : "Validado" };
    changePlan((current) => ({ ...current, volumeSegments: [...current.volumeSegments, segment] }));
  }

  function addCost(event: React.FormEvent) {
    event.preventDefault();
    if (!costDraft.name.trim()) return;
    const cost: PlanningCost = { id: crypto.randomUUID(), name: costDraft.name.trim(), scope: costDraft.scope, productId: costDraft.scope === "product" ? costDraft.productId : undefined, startMonth: costDraft.startMonth, amountUsd: Number(costDraft.amountUsd), frequency: costDraft.frequency };
    changePlan((current) => ({ ...current, costs: [...current.costs, cost] }));
    setCostDraft({ name: "", scope: "enterprise", productId: "cvfx", startMonth: plan.modelStartMonth, amountUsd: 0, frequency: "monthly" });
  }

  return <>
    <div className="enterprise-toolbar"><div className={`save-state ${saveState}`}><i></i><span>{saveState === "saved" ? "Cambios guardados" : saveState === "dirty" ? "Cambios sin guardar" : saveState === "loading" ? "Guardando…" : "No se pudo conectar; revisa antes de cerrar"}</span></div><button className="primary-action compact" type="button" onClick={savePlan} disabled={saveState === "loading"}>Guardar en la aplicación</button></div>
    <nav className="enterprise-tabs" aria-label="Secciones del modelo Enterprise">{([['summary', 'Resumen gerencial'], ['clients', 'Productos y clientes'], ['assumptions', 'Drivers y supuestos'], ['costs', 'Costos directos'], ['cashflow', 'Flujo de caja']] as [Tab, string][]).map(([id, label]) => <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)} type="button">{label}</button>)}</nav>

    {activeTab === "summary" && <>
      <section className="enterprise-kpis"><article><span>Revenue conocido · 36M</span><strong>{usd.format(totals.revenue)}</strong><small>Excluye inputs “Por validar”</small></article><article><span>Margen conocido · 36M</span><strong>{usd.format(totals.margin)}</strong><small>{totals.revenue ? percent.format(totals.margin / totals.revenue) : "—"}</small></article><article><span>Clientes Enterprise</span><strong>{plan.clients.length}</strong><small>{plan.products.length} productos</small></article><article className={forecast.pendingAssumptions ? "attention" : ""}><span>Supuestos pendientes</span><strong>{forecast.pendingAssumptions}</strong><small>Sin CAGR ni datos inventados</small></article></section>
      <article className="panel enterprise-method"><span className="section-kicker">METODOLOGÍA CORREGIDA</span><strong>Go Live → Mes desde Go Live → Volumen → Revenue → Costos Directos → Margen</strong><p>Una sola curva continua por cliente. Cambiar el Go Live desplaza toda la proyección; el año calendario no reinicia el ramp-up.</p></article>
      <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">EXPLICACIÓN DEL CRECIMIENTO Y MARGEN</span><h2>Resumen por producto</h2></div><span className="pending-chip">* Año incompleto si faltan supuestos</span></div><div className="table-wrap"><table className="planning-table product-summary-table"><thead><tr><th>Producto</th><th>Go Live</th><th>Revenue Año 1</th><th>Revenue Año 2</th><th>Revenue Año 3</th><th>Margen contribución</th><th>Margen %</th><th>% Revenue Ent.</th><th>% Margen Ent.</th></tr></thead><tbody>{forecast.byProduct.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.goLive}</td>{product.annualRevenue.map((value, index) => <td key={index}>{product.pendingYears[index] ? <span className="pending-chip">Por validar</span> : usd.format(value)}</td>)}<td><strong>{usd.format(product.margin)}</strong>{product.pendingYears.some(Boolean) && <small>Parcial</small>}</td><td>{percent.format(product.marginPercent)}</td><td>{forecast.pendingAssumptions ? "Por validar" : percent.format(product.revenueShare)}</td><td>{forecast.pendingAssumptions ? "Por validar" : percent.format(product.marginShare)}</td></tr>)}</tbody></table></div></article>
    </>}

    {activeTab === "clients" && <>
      <div className="page-heading enterprise-heading"><div><span className="section-kicker">CLIENTES, PRODUCTOS Y PLAZOS</span><h2>Productos, clientes y Go Lives</h2><p>Un producto nuevo parte con economía unitaria editable; cada cliente crea una curva pendiente de Mes 0 a Mes 35.</p></div><div className="heading-actions"><button className="secondary-action compact" type="button" onClick={() => setShowProductForm((value) => !value)}>+ Nuevo producto</button><button className="primary-action compact" type="button" onClick={() => setShowClientForm((value) => !value)}>+ Nuevo cliente</button></div></div>
      {showProductForm && <form className="inline-form product-entry-form" onSubmit={addProduct}><label>Producto<input required value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} placeholder="Nombre del producto" /></label><label>Driver<select value={productDraft.driver} onChange={(event) => setProductDraft({ ...productDraft, driver: event.target.value as EnterpriseProduct["driver"] })}><option>TPV</option><option>Transacciones</option><option>Payouts</option></select></label><label>Unidad<select value={productDraft.unit} onChange={(event) => setProductDraft({ ...productDraft, unit: event.target.value as EnterpriseProduct["unit"] })}><option value="USD">USD</option><option value="tx">tx</option><option value="payouts">payouts</option></select></label><label>Precio USD/unidad<input type="number" min="0" step="any" value={productDraft.priceUsd} onChange={(event) => setProductDraft({ ...productDraft, priceUsd: Number(event.target.value) })} /></label><label>Costo USD/unidad<input type="number" min="0" step="any" value={productDraft.costUsd} onChange={(event) => setProductDraft({ ...productDraft, costUsd: Number(event.target.value) })} /></label><button className="primary-action compact" type="submit">Agregar producto</button></form>}
      <article className="panel data-panel"><div className="table-tools"><span>{plan.products.length} productos cargados</span><span className="method-chip">Economía base por unidad</span></div><div className="table-wrap"><table className="planning-table"><thead><tr><th>Producto</th><th>Driver</th><th>Unidad</th><th>Precio USD/unidad</th><th>Costo USD/unidad</th><th>Modelo</th></tr></thead><tbody>{plan.products.map((product) => { const custom = !["cvfx", "payment-initiation", "payouts"].includes(product.id); return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.id}</small></td><td>{product.driver}</td><td>{product.unit}</td><td>{custom ? <input className="table-input" type="number" min="0" step="any" value={product.customPriceUsdPerUnit ?? 0} onChange={(event) => updateProduct(product.id, { customPriceUsdPerUnit: Number(event.target.value) })} /> : <span className="validated-chip">Supuesto validado</span>}</td><td>{custom ? <input className="table-input" type="number" min="0" step="any" value={product.customCostUsdPerUnit ?? 0} onChange={(event) => updateProduct(product.id, { customCostUsdPerUnit: Number(event.target.value) })} /> : <span className="validated-chip">Supuesto validado</span>}</td><td><span className={custom ? "pending-chip" : "validated-chip"}>{custom ? "Nuevo · por validar" : "Modelo base"}</span></td></tr>})}</tbody></table></div></article>
      {showClientForm && <form className="inline-form enterprise-client-form" onSubmit={addClient}><label>Cliente<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre del cliente" /></label><label>País<input value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} /></label><label>Producto<select value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value as EnterpriseProductId })}>{plan.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Go Live<input type="month" value={draft.goLiveMonth} onChange={(event) => setDraft({ ...draft, goLiveMonth: event.target.value })} /></label><button className="primary-action compact" type="submit">Agregar</button></form>}
      <article className="panel data-panel"><div className="table-tools"><span>{plan.clients.length} clientes cargados</span><span className="method-chip">Go Live gobierna los 36 meses</span></div><div className="table-wrap"><table className="planning-table"><thead><tr><th>Cliente</th><th>País</th><th>Producto</th><th>Go Live</th><th>Estado</th><th>Curvas</th><th></th></tr></thead><tbody>{plan.clients.map((client) => { const segments = plan.volumeSegments.filter((segment) => segment.clientId === client.id); const pending = segments.filter((segment) => segment.status === "Por validar" || segment.volume === null).length; return <tr key={client.id}><td><input className="table-input wide" value={client.name} onChange={(event) => updateClient(client.id, { name: event.target.value })} /><small>{client.owner}</small></td><td><input className="table-input" value={client.country} onChange={(event) => updateClient(client.id, { country: event.target.value })} /></td><td><select className="table-input wide" value={client.productId} onChange={(event) => updateClient(client.id, { productId: event.target.value as EnterpriseProductId })}>{plan.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></td><td><input className="table-input" type="month" value={client.goLiveMonth} onChange={(event) => updateClient(client.id, { goLiveMonth: event.target.value })} /></td><td><input className="table-input wide" value={client.status} onChange={(event) => updateClient(client.id, { status: event.target.value })} /></td><td><button className={pending ? "pending-chip" : "validated-chip"} type="button" onClick={() => setSelectedClientId(client.id)}>{pending ? `${pending} por validar` : "36 meses definidos"}</button></td><td><button className="row-action danger" type="button" onClick={() => removeClient(client.id)}>Eliminar</button></td></tr>})}</tbody></table></div></article>
      <article className="panel curve-editor"><div className="panel-heading"><div><span className="section-kicker">CURVA CONTINUA</span><h2>Mes desde Go Live · 0 a 35</h2></div><select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>{plan.clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.country} · {plan.products.find((product) => product.id === client.productId)?.name}</option>)}</select></div><div className="curve-segments">{plan.volumeSegments.filter((segment) => segment.clientId === selectedClientId).sort((a, b) => a.fromMonth - b.fromMonth).map((segment) => <div key={segment.id}><label>Desde Mes<input type="number" min="0" max="35" value={segment.fromMonth} onChange={(event) => updateSegment(segment.id, { fromMonth: Number(event.target.value) })} /></label><label>Hasta Mes<input type="number" min="0" max="35" value={segment.toMonth} onChange={(event) => updateSegment(segment.id, { toMonth: Number(event.target.value) })} /></label><label>Volumen<input type="number" min="0" value={segment.volume ?? ""} placeholder="Por validar" onChange={(event) => updateSegment(segment.id, { volume: event.target.value === "" ? null : Number(event.target.value), status: event.target.value === "" ? "Por validar" : "Validado" })} /></label><span className={segment.volume === null ? "pending-chip" : "validated-chip"}>{segment.volume === null ? "Por validar" : number.format(segment.volume)}</span><button className="row-action danger" type="button" onClick={() => changePlan((current) => ({ ...current, volumeSegments: current.volumeSegments.filter((item) => item.id !== segment.id) }))}>Eliminar</button></div>)}</div><form className="segment-form" onSubmit={addSegment}><label>Desde<input type="number" min="0" max="35" value={segmentDraft.fromMonth} onChange={(event) => setSegmentDraft({ ...segmentDraft, fromMonth: Number(event.target.value) })} /></label><label>Hasta<input type="number" min="0" max="35" value={segmentDraft.toMonth} onChange={(event) => setSegmentDraft({ ...segmentDraft, toMonth: Number(event.target.value) })} /></label><label>Volumen<input type="number" min="0" value={segmentDraft.volume} placeholder="Vacío = Por validar" onChange={(event) => setSegmentDraft({ ...segmentDraft, volume: event.target.value })} /></label><button className="primary-action compact" type="submit">+ Tramo</button></form></article>
    </>}

    {activeTab === "assumptions" && <>
      <div className="page-heading enterprise-heading"><div><span className="section-kicker">ECONOMÍA VALIDADA</span><h2>Supuestos Enterprise</h2><p>No existe CAGR global. Sólo se proyecta lo que tenga un driver explícito.</p></div></div>
      <section className="assumption-sections"><article className="panel assumption-form"><h3>Control y FX corporativo</h3><label>Inicio del modelo<input type="month" value={plan.modelStartMonth} onChange={(event) => changePlan((current) => ({ ...current, modelStartMonth: event.target.value }))} /></label><label>CLP / USD<input type="number" min="1" value={plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, clpPerUsd: Number(event.target.value) }))} /></label><p>Este FX gobierna la visualización en USD de Enterprise, B2C, OPEX, Transversal y Consolidado.</p></article><article className="panel assumption-form"><h3>Iniciación de Pagos · USD</h3><label>Precio cliente (USD/tx)<input type="number" step="any" value={plan.assumptions.paymentInitiationPriceClp / plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, paymentInitiationPriceClp: Number(event.target.value) * current.clpPerUsd } }))} /></label><label>Costo Floid (USD/tx)<input type="number" step="any" value={plan.assumptions.paymentInitiationProviderCostClp / plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, paymentInitiationProviderCostClp: Number(event.target.value) * current.clpPerUsd } }))} /></label><p>Margen unitario: {usd.format((plan.assumptions.paymentInitiationPriceClp - plan.assumptions.paymentInitiationProviderCostClp) / plan.clpPerUsd)}</p></article><article className="panel assumption-form"><h3>Payouts · USD</h3><label>Mix BancoEstado (%)<input type="number" min="0" max="100" value={plan.assumptions.payoutDefaultBancoEstadoMix * 100} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, payoutDefaultBancoEstadoMix: Number(event.target.value) / 100 } }))} /></label><div className="paired-inputs"><label>Precio BE (USD)<input type="number" step="any" value={plan.assumptions.payoutPriceBancoEstadoClp / plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, payoutPriceBancoEstadoClp: Number(event.target.value) * current.clpPerUsd } }))} /></label><label>Precio otros (USD)<input type="number" step="any" value={plan.assumptions.payoutPriceOtherBanksClp / plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, payoutPriceOtherBanksClp: Number(event.target.value) * current.clpPerUsd } }))} /></label></div><label>Costo API (USD/llamada)<input type="number" min="0" step="any" value={(plan.assumptions.payoutApiCostClp ?? 10) / plan.clpPerUsd} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, payoutApiCostClp: Number(event.target.value) * current.clpPerUsd } }))} /></label><p>La interbancaria ya no se carga a Payouts. Se calcula en <a href="/transversal">Negocios Transversales</a>.</p></article></section>
      <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">CV+FX · PROVEEDORES</span><h2>Costos operativos por país</h2></div><label className="inline-number">Spread default<input type="number" step="0.0001" value={plan.assumptions.cvfxDefaultSpread} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, cvfxDefaultSpread: Number(event.target.value) } }))} /></label></div><div className="table-wrap"><table className="planning-table"><thead><tr><th>País</th><th>SWIFT USD/op</th><th>Riel local USD/op</th><th>Payout USD/op</th><th>Ticket local USD</th><th>Ticket SWIFT estable</th><th>Payouts / USD 1M TPV</th></tr></thead><tbody>{plan.assumptions.cvfxProviders.map((provider, index) => <tr key={provider.country}><td><strong>{provider.country}</strong></td>{(["swiftCostUsd", "localRailCostUsd", "payoutCostUsd", "localTicketUsd", "steadySwiftTicketUsd", "payoutsPerMillionTpv"] as const).map((field) => <td key={field}><input className="table-input" type="number" step="any" value={provider[field]} onChange={(event) => changePlan((current) => ({ ...current, assumptions: { ...current.assumptions, cvfxProviders: current.assumptions.cvfxProviders.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: Number(event.target.value) } : item) } }))} /></td>)}</tr>)}</tbody></table></div></article>
    </>}

    {activeTab === "costs" && <><div className="page-heading enterprise-heading"><div><span className="section-kicker">COSTOS DIRECTOS ENTERPRISE</span><h2>Costos propios de la vertical</h2><p>Carga aquí sólo costos específicos de Enterprise o de un producto. Personas, tecnología, marketing y administración transversal se administran una sola vez en OPEX corporativo.</p></div><a className="method-chip" href="/opex">Abrir OPEX corporativo →</a></div><form className="inline-form cost-entry-form" onSubmit={addCost}><label>Costo<input value={costDraft.name} onChange={(event) => setCostDraft({ ...costDraft, name: event.target.value })} placeholder="Ej. Operación dedicada" /></label><label>Alcance<select value={costDraft.scope} onChange={(event) => setCostDraft({ ...costDraft, scope: event.target.value as PlanningCost["scope"] })}><option value="enterprise">Enterprise</option><option value="product">Producto Enterprise</option></select></label>{costDraft.scope === "product" && <label>Producto<select value={costDraft.productId} onChange={(event) => setCostDraft({ ...costDraft, productId: event.target.value as EnterpriseProductId })}>{plan.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}<label>Inicio<input type="month" value={costDraft.startMonth} onChange={(event) => setCostDraft({ ...costDraft, startMonth: event.target.value })} /></label><label>USD<input type="number" min="0" value={costDraft.amountUsd} onChange={(event) => setCostDraft({ ...costDraft, amountUsd: Number(event.target.value) })} /></label><label>Frecuencia<select value={costDraft.frequency} onChange={(event) => setCostDraft({ ...costDraft, frequency: event.target.value as PlanningCost["frequency"] })}><option value="monthly">Mensual</option><option value="one_off">One-off</option></select></label><button className="primary-action compact" type="submit">Agregar costo directo</button></form><article className="panel data-panel"><div className="table-wrap"><table className="planning-table"><thead><tr><th>Costo</th><th>Alcance</th><th>Producto</th><th>Inicio</th><th>Frecuencia</th><th>Valor USD</th><th></th></tr></thead><tbody>{plan.costs.length ? plan.costs.map((cost) => <tr key={cost.id}><td><strong>{cost.name}</strong></td><td>{cost.scope === "consolidated" ? "Legado consolidado · mover a OPEX" : cost.scope === "enterprise" ? "Enterprise" : "Producto"}</td><td>{plan.products.find((product) => product.id === cost.productId)?.name ?? "—"}</td><td>{cost.startMonth}</td><td>{cost.frequency === "monthly" ? "Mensual" : "One-off"}</td><td>{usd.format(cost.amountUsd)}</td><td><button className="row-action danger" type="button" onClick={() => changePlan((current) => ({ ...current, costs: current.costs.filter((item) => item.id !== cost.id) }))}>Eliminar</button></td></tr>) : <tr><td colSpan={7}><div className="empty-row">No hay costos directos adicionales. El OPEX corporativo se administra en su propia sección.</div></td></tr>}</tbody></table></div></article></>}

    {activeTab === "cashflow" && <>
      <section className="enterprise-kpis cash-kpis"><article className={totals.enterpriseCash >= 0 ? "positive-card" : "negative-card"}><span>Flujo Enterprise · 36M</span><strong>{usd.format(totals.enterpriseCash)}</strong><small>Margen menos costos Enterprise</small></article><article><span>Costos directos · 36M</span><strong>{usd.format(-directCostSeries.reduce((sum, value) => sum + value, 0))}</strong><small>Incluidos una sola vez antes del margen</small></article><article className={(forecast.months.at(-1)?.enterpriseEndingCash ?? 0) >= 0 ? "positive-card" : "negative-card"}><span>Caja final Enterprise</span><strong>{usd.format(forecast.months.at(-1)?.enterpriseEndingCash ?? 0)}</strong><small>Desde caja inicial editable</small></article><article className={forecast.pendingAssumptions ? "attention" : ""}><span>Estado del horizonte</span><strong>{forecast.pendingAssumptions ? "PARCIAL" : "COMPLETO"}</strong><small><a href="/consolidated">Abrir consolidado YOL1 →</a></small></article></section>
      <article className="panel cashflow-note"><strong>El flujo se lee de izquierda a derecha.</strong><span>El consolidado completo Enterprise + B2C está disponible en la sección Consolidado.</span></article>
      <div className="cashflow-legend" aria-label="Leyenda del flujo de caja"><span className="legend-revenue">Revenue</span><span className="legend-cost">Costos / salidas</span><span className="legend-positive">Margen o flujo positivo</span><span className="legend-negative">Margen o flujo negativo</span><span className="legend-pending">Mes parcial</span></div>
      <article className="panel data-panel horizontal-cashflow-panel"><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table">
        <thead><tr className="year-band"><th rowSpan={2}>Concepto</th>{[1, 2, 3].map((year) => <th key={year} colSpan={12}>Año {year}</th>)}<th colSpan={3}>Resumen anual</th></tr><tr className="month-band">{forecast.calendar.map((month, index) => <th key={month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{monthLabel(month)}</th>)}{[1, 2, 3].map((year) => <th key={year} className="annual-column">Año {year}</th>)}</tr></thead>
        <tbody>{cashflowSections.map((section) => <Fragment key={section.title}><tr className="cashflow-section-row"><th colSpan={40}><strong>{section.title}</strong><span>{section.subtitle}</span></th></tr>{section.rows.map((row) => <tr key={`${section.title}-${row.label}`} className={`${row.tone}-row ${row.emphasis ? "emphasis-row" : ""}`}><th className={row.indent ? "indent-label" : ""}>{row.label}</th>{row.values.map((value, index) => <td key={index} className={`${value < 0 ? "value-negative" : value > 0 && (row.tone === "margin" || row.tone === "cashflow" || row.tone === "cash") ? "value-positive" : ""} ${(index + 1) % 12 === 0 ? "year-end" : ""}`}>{row.percentage ? percent.format(value) : usd.format(value)}</td>)}{row.annual.map((value, index) => <td key={index} className={`annual-column ${value < 0 ? "value-negative" : value > 0 && (row.tone === "margin" || row.tone === "cashflow" || row.tone === "cash") ? "value-positive" : ""}`}>{row.percentage ? percent.format(value) : usd.format(value)}</td>)}</tr>)}</Fragment>)}</tbody>
        <tfoot><tr><th>Estado del mes</th>{forecast.months.map((month, index) => <td key={month.month} className={(index + 1) % 12 === 0 ? "year-end" : ""}><span className={month.pending ? "pending-dot" : "complete-dot"}>{month.pending ? "Parcial" : "Completo"}</span></td>)}{[0, 1, 2].map((year) => <td key={year} className="annual-column"><span className={forecast.months.slice(year * 12, year * 12 + 12).some((month) => month.pending) ? "pending-dot" : "complete-dot"}>{forecast.months.slice(year * 12, year * 12 + 12).some((month) => month.pending) ? "Parcial" : "Completo"}</span></td>)}</tr></tfoot>
      </table></div></article>
    </>}
  </>;
}
