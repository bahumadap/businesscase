"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadCsv } from "../lib/csv";

type AuditEntry = { id: string; actor: string; entity: string; action: string; before_json: string | null; after_json: string | null; changed_at: string };

function summary(value: string | null) {
  if (!value || value === "null") return "—";
  try { const parsed = JSON.parse(value) as Record<string, unknown>; const text = Object.entries(parsed).slice(0, 4).map(([key, item]) => `${key}: ${String(item)}`).join(" · "); return text.length > 120 ? `${text.slice(0, 117)}…` : text; } catch { return value.slice(0, 120); }
}

export function AuditViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/audit?limit=500", { cache: "no-store" }).then((r) => r.json()).then(({ entries: rows }: { entries: AuditEntry[] }) => setEntries(rows ?? [])).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => entries.filter((row) => `${row.actor} ${row.entity} ${row.action}`.toLowerCase().includes(query.toLowerCase())), [entries, query]);
  return <>
    <section className="enterprise-kpis"><article><span>Cambios registrados</span><strong>{entries.length}</strong><small>Últimos 500 eventos</small></article><article><span>Usuarios</span><strong>{new Set(entries.map((row) => row.actor)).size}</strong><small>Actores identificados</small></article><article><span>Actualizaciones</span><strong>{entries.filter((row) => row.action === "update").length}</strong><small>Registros modificados</small></article><article><span>Creaciones / eliminaciones</span><strong>{entries.filter((row) => row.action !== "update").length}</strong><small>Trazabilidad estructural</small></article></section>
    <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">TRAZABILIDAD CONSOLIDADA</span><h2>Log de auditoría</h2></div><div className="table-actions"><input className="table-input wide" placeholder="Buscar usuario o entidad…" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="ghost-button" type="button" onClick={() => downloadCsv("auditoria-yol1.csv", filtered as unknown as Record<string, unknown>[])}>Descargar CSV</button></div></div><div className="table-wrap"><table className="planning-table audit-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Valor anterior</th><th>Valor nuevo</th><th>Detalle</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Santiago" }).format(new Date(row.changed_at))}</td><td><strong>{row.actor}</strong></td><td><span className={`status-pill audit-${row.action}`}>{row.action === "create" ? "Creación" : row.action === "delete" ? "Eliminación" : "Edición"}</span></td><td>{row.entity}</td><td>{summary(row.before_json)}</td><td>{summary(row.after_json)}</td><td><details><summary>Ver JSON</summary><div className="audit-json"><pre>{row.before_json ?? "null"}</pre><pre>{row.after_json ?? "null"}</pre></div></details></td></tr>)}{!loading && filtered.length === 0 && <tr><td className="empty-row" colSpan={7}>Aún no hay cambios guardados.</td></tr>}{loading && <tr><td className="empty-row" colSpan={7}>Cargando auditoría…</td></tr>}</tbody></table></div></article>
    <div className="callout"><strong>Integración con Vercel</strong><span>El API acepta el usuario autenticado en el encabezado x-yol1-user. La aplicación mantiene la trazabilidad; la autorización por rol puede resolverse en la capa de acceso de Vercel.</span></div>
  </>;
}
