"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ACTUALS_SEED } from "../actuals/seed";
import { buildBudgetRecords, compareBudgetActual, type FinancialFilters } from "../actuals/engine";
import type { ActualRecord, ActualsPlan, FinancialCategory, TimeGrain } from "../actuals/types";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan } from "../b2c/types";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";
import { downloadCsv, parseCsv } from "../lib/csv";
import { OPEX_SEED } from "../opex/seed";
import type { OpexPlan } from "../opex/types";
import { applyProviderConditionsToEnterprise } from "../providers/engine";
import { PROVIDERS_SEED } from "../providers/seed";
import type { ProvidersPlan } from "../providers/types";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";
import { TRANSVERSAL_SEED } from "../transversal/seed";
import type { TransversalPlan } from "../transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
const emptyFilters: FinancialFilters = { area: "", country: "", provider: "", client: "", product: "", category: "" };
const grains: { value: TimeGrain; label: string }[] = [{ value: "year", label: "Año" }, { value: "quarter", label: "Trimestre" }, { value: "month", label: "Mes" }, { value: "week", label: "Semana" }, { value: "day", label: "Día" }];

export function ActualsManager() {
  const [plan, setPlan] = useState<ActualsPlan>(() => structuredClone(ACTUALS_SEED));
  const [enterprise, setEnterprise] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2c, setB2C] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smb, setSmb] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [opex, setOpex] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [providers, setProviders] = useState<ProvidersPlan>(() => structuredClone(PROVIDERS_SEED));
  const [transversal, setTransversal] = useState<TransversalPlan>(() => structuredClone(TRANSVERSAL_SEED));
  const [grain, setGrain] = useState<TimeGrain>("month");
  const [filters, setFilters] = useState<FinancialFilters>(emptyFilters);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { Promise.all(["actuals", "enterprise", "b2c", "smb", "opex", "providers", "transversal"].map((key) => fetch(`/api/${key}`, { cache: "no-store" }).then((r) => r.json()))).then(([a, e, b, s, o, p, t]) => { if (a.plan) setPlan(a.plan); if (e.plan) setEnterprise(e.plan); if (b.plan) setB2C(b.plan); if (s.plan) setSmb(s.plan); if (o.plan) setOpex(o.plan); if (p.plan) setProviders(p.plan); if (t.plan) setTransversal(t.plan); }).catch(() => undefined); }, []);
  const budget = useMemo(() => buildBudgetRecords(applyProviderConditionsToEnterprise(enterprise, providers), b2c, smb, opex, transversal), [enterprise, b2c, smb, opex, providers, transversal]);
  const comparison = useMemo(() => compareBudgetActual(budget, plan.records, grain, filters), [budget, plan.records, grain, filters]);
  const totals = comparison.reduce((result, row) => ({ budget: result.budget + row.budget, actual: result.actual + row.actual }), { budget: 0, actual: 0 });
  const options = useMemo(() => Object.fromEntries((["area", "country", "provider", "client", "product", "category"] as const).map((key) => [key, [...new Set([...budget.map((row) => row[key]), ...plan.records.map((row) => row[key])].filter(Boolean))].sort()])), [budget, plan.records]);

  function update(next: ActualsPlan) { setPlan({ ...next, updatedAt: new Date().toISOString() }); setSaveState("saving"); }
  function patchRecord(id: string, patch: Partial<ActualRecord>) { update({ ...plan, records: plan.records.map((row) => row.id === id ? { ...row, ...patch } : row) }); }
  function addRecord() { update({ ...plan, records: [{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), area: "Enterprise", country: "Chile", provider: "", client: "", product: "", category: "Revenue", amountUsd: 0, notes: "" }, ...plan.records] }); }
  async function save() { try { const response = await fetch("/api/actuals", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(plan) }); if (!response.ok) throw new Error(); setSaveState("saved"); } catch { setSaveState("error"); } }
  async function importCsv(file?: File) { if (!file) return; const rows = parseCsv(await file.text()); const records: ActualRecord[] = rows.map((row) => ({ id: row.id || crypto.randomUUID(), date: row.date || new Date().toISOString().slice(0, 10), area: (row.area || "Enterprise") as ActualRecord["area"], country: row.country || "", provider: row.provider || "", client: row.client || "", product: row.product || "", category: (row.category || "Revenue") as FinancialCategory, amountUsd: Number(row.amountUsd) || 0, notes: row.notes || "" })); update({ ...plan, records }); }

  return <>
    <article className="dashboard-live-banner"><div><span className="dashboard-live-dot"></span><strong>Presupuesto conectado a los modelos</strong><small>Enterprise + B2C + SMB + Transversal + OPEX · Real cargado sin inventar datos</small></div><span>{plan.records.length} registros reales</span></article>
    <section className="enterprise-kpis"><article><span>Presupuesto filtrado</span><strong>{usd.format(totals.budget)}</strong><small>USD</small></article><article><span>Real filtrado</span><strong>{usd.format(totals.actual)}</strong><small>USD</small></article><article className={totals.actual - totals.budget >= 0 ? "positive-card" : "negative-card"}><span>Desviación absoluta</span><strong>{usd.format(totals.actual - totals.budget)}</strong><small>Real − Presupuesto</small></article><article><span>Desviación %</span><strong>{totals.budget ? percent.format((totals.actual - totals.budget) / totals.budget) : "—"}</strong><small>Sobre presupuesto filtrado</small></article></section>

    <article className="panel variance-controls"><div><span className="section-kicker">FRACTALIDAD TEMPORAL</span><div className="grain-control">{grains.map((item) => <button className={grain === item.value ? "active" : ""} type="button" key={item.value} onClick={() => setGrain(item.value)}>{item.label}</button>)}</div></div><div className="dimension-filters">{(["area", "country", "provider", "client", "product", "category"] as const).map((key) => <label key={key}>{key === "area" ? "Área" : key === "country" ? "País" : key === "provider" ? "Proveedor" : key === "client" ? "Cliente" : key === "product" ? "Producto" : "Categoría"}<select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}><option value="">Todos</option>{(options[key] as string[]).map((value) => <option key={value}>{value}</option>)}</select></label>)}</div><button className="ghost-button" type="button" onClick={() => setFilters(emptyFilters)}>Limpiar filtros</button></article>

    <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">ANÁLISIS</span><h2>Presupuesto vs. Real</h2></div><span className="method-chip">{grains.find((item) => item.value === grain)?.label}</span></div><div className="table-wrap"><table className="planning-table variance-table"><thead><tr><th>Período</th><th>Categoría</th><th>Presupuesto</th><th>Real</th><th>Desviación</th><th>Desviación %</th></tr></thead><tbody>{comparison.map((row) => <tr key={`${row.period}-${row.category}`}><td><strong>{row.period}</strong></td><td>{row.category}</td><td>{usd.format(row.budget)}</td><td>{usd.format(row.actual)}</td><td className={row.variance < 0 ? "negative-number" : "value-positive"}>{usd.format(row.variance)}</td><td className={row.variance < 0 ? "negative-number" : "value-positive"}>{row.variancePercent === null ? "—" : percent.format(row.variancePercent)}</td></tr>)}{comparison.length === 0 && <tr><td className="empty-row" colSpan={6}>No hay registros para estos filtros.</td></tr>}</tbody></table></div></article>

    <article id="escenario-real" className="panel data-panel anchor-target"><div className="panel-heading"><div><span className="section-kicker">ESCENARIO REAL</span><h2>Registros editables</h2></div><div className="table-actions"><span className={`save-state ${saveState === "saved" ? "saved" : saveState === "error" ? "error" : ""}`}><i></i>{saveState === "saving" ? "Sin guardar" : saveState === "error" ? "Error" : "Guardado y auditado"}</span><button className="ghost-button" type="button" onClick={() => downloadCsv("escenario-real-yol1.csv", plan.records as unknown as Record<string, unknown>[])}>Descargar CSV</button><button className="ghost-button" type="button" onClick={() => fileInput.current?.click()}>Cargar CSV</button><button className="ghost-button" type="button" onClick={save}>Guardar</button><button className="primary-action compact" type="button" onClick={addRecord}>+ Registro</button><input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(e) => importCsv(e.target.files?.[0])} /></div></div><div className="table-wrap"><table className="planning-table actuals-table"><thead><tr><th>Fecha</th><th>Área</th><th>País</th><th>Proveedor</th><th>Cliente</th><th>Producto</th><th>Categoría</th><th>Monto USD</th><th>Notas</th><th></th></tr></thead><tbody>{plan.records.map((row) => <tr key={row.id}><td><input type="date" value={row.date} onChange={(e) => patchRecord(row.id, { date: e.target.value })} /></td><td><select className="table-input" value={row.area} onChange={(e) => patchRecord(row.id, { area: e.target.value as ActualRecord["area"] })}><option>Enterprise</option><option>B2C</option><option>SMB</option><option>Transversal</option><option>Corporativo</option></select></td>{(["country", "provider", "client", "product"] as const).map((key) => <td key={key}><input className="table-input" value={row[key]} onChange={(e) => patchRecord(row.id, { [key]: e.target.value })} /></td>)}<td><select className="table-input" value={row.category} onChange={(e) => patchRecord(row.id, { category: e.target.value as FinancialCategory })}><option>Revenue</option><option>Costo directo</option><option>OPEX</option></select></td><td><input className="table-input" type="number" value={row.amountUsd} onChange={(e) => patchRecord(row.id, { amountUsd: Number(e.target.value) || 0 })} /></td><td><input className="table-input wide" value={row.notes} onChange={(e) => patchRecord(row.id, { notes: e.target.value })} /></td><td><button className="row-action danger" type="button" onClick={() => update({ ...plan, records: plan.records.filter((item) => item.id !== row.id) })}>Eliminar</button></td></tr>)}{plan.records.length === 0 && <tr><td colSpan={10} className="empty-row">Carga un CSV o agrega el primer registro Real. No se han creado cifras ficticias.</td></tr>}</tbody></table></div></article>
  </>;
}
