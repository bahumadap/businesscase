"use client";

import { useRef, useState } from "react";

const datasets = [
  { key: "enterprise", label: "Enterprise", detail: "Clientes, productos, curvas, costos y supuestos" },
  { key: "b2c", label: "B2C", detail: "Productos, MAU, economics y costos" },
  { key: "smb", label: "SMB", detail: "Factor Place, productos PyME, SGR y supuestos fuente" },
  { key: "transversal", label: "Negocios Transversales", detail: "Interbancaria, vínculos de volumen y otros ingresos/costos" },
  { key: "opex", label: "OPEX", detail: "Partidas, drivers y ajustes mensuales" },
  { key: "providers", label: "Proveedores", detail: "Maestro y condiciones contractuales" },
  { key: "actuals", label: "Escenario Real", detail: "Ejecución financiera por dimensión" },
  { key: "milestones", label: "Pipeline / Gantt", detail: "Fechas, hitos, estados y responsables" },
];

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name}-yol1.json`; anchor.click(); URL.revokeObjectURL(url);
}

export function DataExchangeManager() {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [states, setStates] = useState<Record<string, string>>({});
  async function exportDataset(key: string) { const response = await fetch(`/api/${key}`, { cache: "no-store" }); const body = await response.json(); download(key, body.plan); setStates((old) => ({ ...old, [key]: "Descargado" })); }
  async function importDataset(key: string, file?: File) {
    if (!file) return;
    try { const plan = JSON.parse(await file.text()); const response = await fetch(`/api/${key}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(plan) }); if (!response.ok) throw new Error(); setStates((old) => ({ ...old, [key]: "Cargado y auditado" })); } catch { setStates((old) => ({ ...old, [key]: "Archivo inválido" })); }
  }
  return <>
    <article className="panel exchange-intro"><span className="empty-icon">⇅</span><div><p className="section-kicker">ROUND TRIP DE DATOS</p><h2>Descarga, edita y vuelve a cargar</h2><p>Cada archivo conserva el esquema completo de su tabla. La carga reemplaza el conjunto correspondiente y registra el detalle del cambio en auditoría.</p></div></article>
    <section className="exchange-grid">{datasets.map((dataset) => <article className="panel exchange-card" key={dataset.key}><div><span className="method-chip">JSON</span><strong>{dataset.label}</strong><p>{dataset.detail}</p></div><small className={states[dataset.key] === "Archivo inválido" ? "negative-number" : ""}>{states[dataset.key] ?? "Sin actividad en esta sesión"}</small><div><button className="ghost-button" type="button" onClick={() => exportDataset(dataset.key)}>Descargar registros</button><button className="primary-action compact" type="button" onClick={() => inputs.current[dataset.key]?.click()}>Cargar archivo editado</button><input hidden ref={(element) => { inputs.current[dataset.key] = element; }} type="file" accept=".json,application/json" onChange={(e) => importDataset(dataset.key, e.target.files?.[0])} /></div></article>)}</section>
    <div className="callout"><strong>Validación segura</strong><span>Descarga primero el archivo vigente y conserva sus identificadores. Proveedores y Real también permiten intercambio CSV desde sus respectivos mantenedores.</span></div>
  </>;
}
