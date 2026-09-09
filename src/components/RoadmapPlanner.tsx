"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TimeGrain } from "../actuals/types";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan } from "../b2c/types";
import { buildProductCatalog, reconcileMilestonesWithCatalog, type ProductVertical } from "../catalog/products";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";
import { downloadCsv, parseCsv } from "../lib/csv";
import { MILESTONES_SEED } from "../milestones/seed";
import type { Milestone, MilestonesPlan, MilestoneStatus } from "../milestones/types";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";

const grainLabels: { value: TimeGrain; label: string }[] = [{ value: "year", label: "Año" }, { value: "quarter", label: "Trimestre" }, { value: "month", label: "Mes" }, { value: "week", label: "Semana" }, { value: "day", label: "Día" }];
const verticals: ProductVertical[] = ["Enterprise", "B2C", "SMB"];
const horizonStart = new Date("2026-09-01T00:00:00Z").getTime();
const horizonEnd = new Date("2029-08-31T00:00:00Z").getTime();
function position(value: string) { return Math.max(0, Math.min(100, (new Date(`${value}T00:00:00Z`).getTime() - horizonStart) / (horizonEnd - horizonStart) * 100)); }
function durationDays(row: Milestone) { return Math.max(0, Math.round((new Date(`${row.endDate}T00:00:00Z`).getTime() - new Date(`${row.startDate}T00:00:00Z`).getTime()) / 86400000) + 1); }
function delayed(row: Milestone) { return row.status !== "Completado" && row.endDate > row.targetDate; }
function routeFor(vertical: ProductVertical) { return vertical === "Enterprise" ? "/enterprise" : vertical === "B2C" ? "/b2c" : "/smb"; }

export function RoadmapPlanner() {
  const [plan, setPlan] = useState<MilestonesPlan>(() => structuredClone(MILESTONES_SEED));
  const [enterprise, setEnterprise] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2c, setB2C] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smb, setSmb] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [grain, setGrain] = useState<TimeGrain>("quarter");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const fileInput = useRef<HTMLInputElement>(null);
  const catalog = useMemo(() => buildProductCatalog(enterprise, b2c, smb), [enterprise, b2c, smb]);
  const visible = useMemo(() => plan.milestones.filter((row) => (!area || row.area === area) && (!status || row.status === status)), [plan.milestones, area, status]);

  useEffect(() => {
    Promise.all(["milestones", "enterprise", "b2c", "smb"].map((key) => fetch(`/api/${key}`, { cache: "no-store" }).then((response) => response.json())))
      .then(async (result) => {
        const [milestonesData, enterpriseData, b2cData, smbData] = result as [{ plan: MilestonesPlan | null }, { plan: EnterprisePlan | null }, { plan: B2CPlan | null }, { plan: SmbPlan | null }];
        const nextEnterprise = enterpriseData.plan ?? structuredClone(ENTERPRISE_SEED);
        const nextB2C = b2cData.plan ?? structuredClone(B2C_SEED);
        const nextSmb = smbData.plan ?? structuredClone(SMB_SEED);
        const nextCatalog = buildProductCatalog(nextEnterprise, nextB2C, nextSmb);
        const stored = milestonesData.plan ?? structuredClone(MILESTONES_SEED);
        const milestones = reconcileMilestonesWithCatalog(stored.milestones, nextCatalog);
        setEnterprise(nextEnterprise);
        setB2C(nextB2C);
        setSmb(nextSmb);
        const changed = milestonesData.plan === null || milestones.length !== stored.milestones.length || milestones.some((row, index) => row.productKey !== stored.milestones[index]?.productKey || row.product !== stored.milestones[index]?.product || row.area !== stored.milestones[index]?.area);
        const nextPlan = changed ? { ...stored, version: stored.version + 1, updatedAt: new Date().toISOString(), milestones } : { ...stored, milestones };
        setPlan(nextPlan);
        if (changed) {
          setSaveState("saving");
          const response = await fetch("/api/milestones", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(nextPlan) });
          if (!response.ok) throw new Error("No se pudo sincronizar el catálogo");
          setSaveState("saved");
        }
      }).catch(() => setSaveState("error"));
  }, []);

  function update(next: MilestonesPlan) { setPlan({ ...next, updatedAt: new Date().toISOString() }); setSaveState("saving"); }
  function patchRow(id: string, patch: Partial<Milestone>) { update({ ...plan, milestones: plan.milestones.map((row) => row.id === id ? { ...row, ...patch } : row) }); }
  function productsFor(areaValue: Milestone["area"]) { return catalog.filter((product) => product.vertical === areaValue); }
  function selectProduct(row: Milestone, productKey: string) {
    const product = catalog.find((item) => item.key === productKey);
    patchRow(row.id, product ? { productKey: product.key, product: product.name, area: product.vertical } : { productKey: undefined, product: "" });
  }
  function selectArea(row: Milestone, nextArea: Milestone["area"]) {
    const first = catalog.find((product) => product.vertical === nextArea);
    patchRow(row.id, { area: nextArea, productKey: first?.key, product: first?.name ?? "" });
  }
  function addRow() {
    const product = catalog[0];
    const date = product ? `${product.goLiveMonth}-01` : "2026-09-01";
    update({ ...plan, milestones: [{ id: crypto.randomUUID(), name: "Nuevo hito", area: product?.vertical ?? "Enterprise", country: "Chile", client: "", productKey: product?.key, product: product?.name ?? "", owner: "Por asignar", startDate: date, endDate: date, targetDate: date, status: "Planificado", progress: 0, notes: "" }, ...plan.milestones] });
  }
  async function save() { try { const next = { ...plan, version: plan.version + 1, updatedAt: new Date().toISOString() }; const response = await fetch("/api/milestones", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }); if (!response.ok) throw new Error(); setPlan(next); setSaveState("saved"); } catch { setSaveState("error"); } }
  async function importCsv(file?: File) { if (!file) return; const rows = parseCsv(await file.text()); const imported = rows.map((row) => ({ id: row.id || crypto.randomUUID(), name: row.name || "Hito", area: (row.area || "Enterprise") as Milestone["area"], country: row.country || "", client: row.client || "", productKey: row.productKey || undefined, product: row.product || "", owner: row.owner || "", startDate: row.startDate || "", endDate: row.endDate || "", targetDate: row.targetDate || "", status: (row.status || "Planificado") as MilestoneStatus, progress: Number(row.progress) || 0, notes: row.notes || "" })); update({ ...plan, milestones: reconcileMilestonesWithCatalog(imported, catalog) }); }

  return <>
    <div className="page-heading"><div><span className="section-kicker">CALENDARIO / GANTT CONECTADO</span><h2>Pipeline en el tiempo</h2><p>Los productos vienen directamente de Enterprise, B2C y SMB. No existe un catálogo paralelo.</p></div><div className="impact-card"><span>Productos vinculados</span><strong>{catalog.length}</strong></div></div>
    <article className="panel roadmap-catalog"><div className="panel-heading"><div><span className="section-kicker">CATÁLOGO VIVO</span><h2>Productos por vertical</h2></div><span className="method-chip">{catalog.length} productos</span></div><div className="roadmap-catalog-grid">{verticals.map((vertical) => <div key={vertical}><a href={routeFor(vertical)}><strong>{vertical}</strong><span>{catalog.filter((product) => product.vertical === vertical).length} productos →</span></a><div>{catalog.filter((product) => product.vertical === vertical).map((product) => <span className={product.status === "Por validar" ? "pending-chip" : "validated-chip"} key={product.key} title={`${product.goLiveMonth} · ${product.detail}`}>{product.name}</span>)}</div></div>)}</div></article>
    <article className="panel gantt-controls"><div className="grain-control">{grainLabels.map((item) => <button type="button" className={grain === item.value ? "active" : ""} key={item.value} onClick={() => setGrain(item.value)}>{item.label}</button>)}</div><label>Área<select value={area} onChange={(event) => setArea(event.target.value)}><option value="">Todas</option><option>Enterprise</option><option>B2C</option><option>SMB</option><option>Corporativo</option></select></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option>Planificado</option><option>En curso</option><option>Completado</option><option>Atrasado</option></select></label><span>Vista: {grainLabels.find((item) => item.value === grain)?.label}</span></article>
    <article className="panel gantt-board"><div className="gantt-header"><span>Hito / producto</span><div>{grain === "year" ? <><b>2026</b><b>2027</b><b>2028</b><b>2029</b></> : <><b>Sep 26</b><b>Jun 27</b><b>Mar 28</b><b>Dic 28</b><b>Ago 29</b></>}</div></div>{visible.map((row) => { const left = position(row.startDate); const width = Math.max(.7, position(row.endDate) - left); return <div className="gantt-row" key={row.id}><div><strong>{row.name}</strong><small>{row.product || row.client || row.area} · {durationDays(row)} días</small></div><div className="gantt-track"><span className={`gantt-bar ${delayed(row) || row.status === "Atrasado" ? "delayed" : row.status === "Completado" ? "complete" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${row.startDate} → ${row.endDate}`}><i style={{ width: `${Math.max(0, Math.min(100, row.progress))}%` }}></i></span><b className="gantt-target" style={{ left: `${position(row.targetDate)}%` }} title={`Objetivo ${row.targetDate}`}></b></div></div>})}</article>
    <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">MANTENEDOR</span><h2>Hitos editables</h2></div><div className="table-actions"><span className={`save-state ${saveState === "saved" ? "saved" : saveState === "error" ? "error" : ""}`}><i></i>{saveState === "saving" ? "Sin guardar" : saveState === "error" ? "Error" : "Guardado y auditado"}</span><button className="ghost-button" type="button" onClick={() => downloadCsv("pipeline-yol1.csv", plan.milestones as unknown as Record<string, unknown>[])}>Descargar CSV</button><button className="ghost-button" type="button" onClick={() => fileInput.current?.click()}>Cargar CSV</button><button className="ghost-button" type="button" onClick={save}>Guardar</button><button className="primary-action compact" type="button" onClick={addRow}>+ Hito</button><input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} /></div></div><div className="table-wrap"><table className="planning-table milestones-table"><thead><tr><th>Hito</th><th>Área / País</th><th>Cliente / Producto vinculado</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Objetivo</th><th>Estado</th><th>Avance %</th><th>Duración</th><th></th></tr></thead><tbody>{plan.milestones.map((row) => <tr key={row.id}><td><input className="table-input wide" value={row.name} onChange={(event) => patchRow(row.id, { name: event.target.value })} /></td><td><select className="table-input" value={row.area} onChange={(event) => selectArea(row, event.target.value as Milestone["area"])}><option>Enterprise</option><option>B2C</option><option>SMB</option><option>Corporativo</option></select><input className="table-input" value={row.country} onChange={(event) => patchRow(row.id, { country: event.target.value })} /></td><td><input className="table-input" value={row.client} placeholder="Cliente opcional" onChange={(event) => patchRow(row.id, { client: event.target.value })} /><select className="table-input wide" value={row.productKey ?? ""} onChange={(event) => selectProduct(row, event.target.value)}><option value="">Sin producto vinculado</option>{productsFor(row.area).map((product) => <option key={product.key} value={product.key}>{product.name}</option>)}</select></td><td><input className="table-input" value={row.owner} onChange={(event) => patchRow(row.id, { owner: event.target.value })} /></td>{(["startDate", "endDate", "targetDate"] as const).map((key) => <td key={key}><input type="date" value={row[key]} onChange={(event) => patchRow(row.id, { [key]: event.target.value })} /></td>)}<td><select className="table-input" value={row.status} onChange={(event) => patchRow(row.id, { status: event.target.value as MilestoneStatus })}><option>Planificado</option><option>En curso</option><option>Completado</option><option>Atrasado</option></select></td><td><input className="table-input" type="number" min="0" max="100" value={row.progress} onChange={(event) => patchRow(row.id, { progress: Number(event.target.value) || 0 })} /></td><td className={delayed(row) ? "negative-number" : ""}>{durationDays(row)} días{delayed(row) ? " · retraso" : ""}</td><td><button className="row-action danger" type="button" onClick={() => update({ ...plan, milestones: plan.milestones.filter((item) => item.id !== row.id) })}>Eliminar</button></td></tr>)}</tbody></table></div></article>
  </>;
}
