"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { calculateOpexForecast, OPEX_CATEGORIES } from "../opex/engine";
import { OPEX_SEED } from "../opex/seed";
import type { OpexCategory, OpexExpense, OpexGrowthMode, OpexPlan } from "../opex/types";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";

const kclp = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
type Tab = "assumptions" | "projection";
type SaveState = "saved" | "dirty" | "loading" | "error";

function MoneyInput({ value, onCommit, className = "", ariaLabel, id }: { value: number; onCommit: (value: number | null) => void; className?: string; ariaLabel: string; id?: string }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(Number(value.toFixed(2))));

  function commit() {
    const cleaned = draft.replace(/[^0-9.,]/g, "").replace(",", ".");
    onCommit(cleaned === "" ? null : Number(cleaned));
    setFocused(false);
  }

  return <input
    id={id}
    aria-label={ariaLabel}
    className={className}
    type="text"
    inputMode="numeric"
    value={focused ? draft : kclp.format(value)}
    onFocus={(event) => { setDraft(String(Number(value.toFixed(2)))); setFocused(true); event.currentTarget.select(); }}
    onChange={(event) => setDraft(event.target.value.replace(/[^0-9.,]/g, ""))}
    onBlur={commit}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
  />;
}

function annualSums(values: number[]) {
  return [0, 1, 2].map((year) => values.slice(year * 12, year * 12 + 12).reduce((sum, value) => sum + value, 0));
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "\u00a0");
}

const emptyDraft = (startMonth: string): OpexExpense => ({
  id: "",
  name: "",
  category: "Gastos generales",
  enabled: true,
  baseMonth: startMonth,
  baseAmountClp: 0,
  growthMode: "annual",
  growthRate: 0,
  status: "Por validar",
  source: "Input manual",
  notes: "",
  monthlyOverrides: {},
});

export function OpexPlanner() {
  const [plan, setPlan] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [activeTab, setActiveTab] = useState<Tab>("assumptions");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [reportingFx, setReportingFx] = useState(ENTERPRISE_SEED.clpPerUsd);
  const [draft, setDraft] = useState<OpexExpense>(() => emptyDraft(OPEX_SEED.modelStartMonth));
  const forecast = useMemo(() => calculateOpexForecast(plan), [plan]);
  const total36 = forecast.months.reduce((sum, month) => sum + month.totalClp, 0);
  const annual = annualSums(forecast.months.map((month) => month.totalClp));
  const overrides = plan.expenses.reduce((sum, expense) => sum + Object.keys(expense.monthlyOverrides).length, 0);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/opex", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("load"))), fetch("/api/enterprise", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("load")))])
      .then(([data, enterprise]: [{ plan: OpexPlan | null }, { plan: EnterprisePlan | null }]) => {
        if (!active) return;
        if (data.plan?.expenses) setPlan({ ...data.plan, expenses: data.plan.expenses.map((expense) => { const { accountCode: _removed, ...clean } = expense as OpexExpense & { accountCode?: string }; return clean; }) });
        if (enterprise.plan?.clpPerUsd) setReportingFx(enterprise.plan.clpPerUsd);
        setSaveState("saved");
      })
      .catch(() => active && setSaveState("error"));
    return () => { active = false; };
  }, []);

  function changePlan(updater: (current: OpexPlan) => OpexPlan) {
    setPlan((current) => updater(current));
    setSaveState("dirty");
  }

  function updateExpense(id: string, patch: Partial<OpexExpense>) {
    changePlan((current) => ({ ...current, expenses: current.expenses.map((expense) => expense.id === id ? { ...expense, ...patch } : expense) }));
  }

  function updateRamp(patch: Partial<OpexPlan["ramp"]>) {
    changePlan((current) => ({ ...current, ramp: { ...current.ramp, ...patch } }));
  }

  async function savePlan() {
    setSaveState("loading");
    try {
      const next = { ...plan, updatedAt: new Date().toISOString() };
      const response = await fetch("/api/opex", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("save");
      setPlan(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function addExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const id = crypto.randomUUID();
    changePlan((current) => ({ ...current, expenses: [...current.expenses, { ...draft, id, name: draft.name.trim() }] }));
    setDraft(emptyDraft(plan.modelStartMonth));
  }

  function setOverride(expense: OpexExpense, month: string, value: string) {
    const monthlyOverrides = { ...expense.monthlyOverrides };
    if (value === "") delete monthlyOverrides[month];
    else monthlyOverrides[month] = Math.max(0, Number(value) || 0);
    updateExpense(expense.id, { monthlyOverrides });
  }

  return <>
    <div className="enterprise-toolbar"><div className={`save-state ${saveState}`}><i></i><span>{saveState === "saved" ? "Cambios guardados" : saveState === "dirty" ? "Cambios sin guardar" : saveState === "loading" ? "Guardando…" : "No se pudo conectar"}</span></div><button className="primary-action compact" type="button" onClick={savePlan} disabled={saveState === "loading"}>Guardar OPEX</button></div>
    <nav className="enterprise-tabs" aria-label="Secciones del modelo OPEX"><button className={activeTab === "assumptions" ? "active" : ""} onClick={() => setActiveTab("assumptions")} type="button">Supuestos y crecimiento</button><button className={activeTab === "projection" ? "active" : ""} onClick={() => setActiveTab("projection")} type="button">Proyección 36 meses</button></nav>

    <section className="enterprise-kpis cash-kpis"><article><span>OPEX · 36M</span><strong>{kclp.format(total36 / 1000)}</strong><small>Miles de CLP · consolidado YOL1</small></article><article><span>Run-rate inicial</span><strong>{kclp.format((forecast.months[0]?.totalClp ?? 0) / 1000)}</strong><small>{forecast.calendar[0]}</small></article><article className={(forecast.months.at(-1)?.totalClp ?? 0) > (forecast.months[0]?.totalClp ?? 0) ? "negative-card" : "positive-card"}><span>Run-rate final</span><strong>{kclp.format((forecast.months.at(-1)?.totalClp ?? 0) / 1000)}</strong><small>{forecast.calendar.at(-1)}</small></article><article><span>Unidades</span><strong>miles CLP</strong><small>{overrides} ajustes manuales</small></article></section>
    <article className="panel cashflow-note"><strong>OPEX corporativo consolidado: YOL1 Tech + YOL1 Finance, una sola vez.</strong><span>Excluye costo de venta; incorpora únicamente Gastos de Administración y Ventas.</span></article>

    {activeTab === "assumptions" && <>
      <article className="panel assumption-form"><h3>Ramp-up consolidado · miles de CLP</h3><label>Mes inicial<input type="month" value={plan.ramp.baseMonth} onChange={(event) => updateRamp({ baseMonth: event.target.value })} /></label><label>OPEX base<input type="number" value={plan.ramp.baseTotalClp / 1000} onChange={(event) => updateRamp({ baseTotalClp: Number(event.target.value) * 1000 })} /></label><label>OPEX objetivo<input type="number" value={plan.ramp.targetTotalClp / 1000} onChange={(event) => updateRamp({ targetTotalClp: Number(event.target.value) * 1000 })} /></label><label>Duración (meses)<input type="number" min="1" value={plan.ramp.durationMonths} onChange={(event) => updateRamp({ durationMonths: Number(event.target.value) || 1 })} /></label></article>
      <article className="panel data-panel"><div className="panel-heading"><div><span className="section-kicker">OPEX CORPORATIVO EDITABLE · MILES CLP</span><h2>Composición base por categoría</h2></div><span className="method-chip">Escala proporcional durante el ramp-up</span></div><div className="table-wrap"><table className="planning-table opex-assumptions-table"><thead><tr><th>Activo</th><th>Partida</th><th>Categoría</th><th>Mes base</th><th>Base miles CLP</th><th>Estado</th><th>Comentario</th><th></th></tr></thead><tbody>{plan.expenses.map((expense) => <tr key={expense.id}><td><input aria-label={`Activar ${expense.name}`} type="checkbox" checked={expense.enabled} onChange={(event) => updateExpense(expense.id, { enabled: event.target.checked })} /></td><td><input className="table-input wide" value={expense.name} onChange={(event) => updateExpense(expense.id, { name: event.target.value })} /></td><td><select className="table-input" value={expense.category} onChange={(event) => updateExpense(expense.id, { category: event.target.value as OpexCategory })}>{OPEX_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></td><td><input className="table-input" type="month" value={expense.baseMonth} onChange={(event) => updateExpense(expense.id, { baseMonth: event.target.value })} /></td><td><MoneyInput ariaLabel={`Base de ${expense.name}`} className="table-input money-input" value={expense.baseAmountClp / 1000} onCommit={(value) => updateExpense(expense.id, { baseAmountClp: (value ?? 0) * 1000 })} /></td><td><select className="table-input" value={expense.status} onChange={(event) => updateExpense(expense.id, { status: event.target.value as OpexExpense["status"] })}><option>Validado</option><option>Por validar</option><option>Por clasificar</option></select></td><td><textarea className="table-input opex-notes" value={expense.notes} onChange={(event) => updateExpense(expense.id, { notes: event.target.value })} /></td><td><button className="row-action danger" type="button" onClick={() => changePlan((current) => ({ ...current, expenses: current.expenses.filter((item) => item.id !== expense.id) }))}>Eliminar</button></td></tr>)}</tbody></table></div></article>
      <form className="inline-form opex-entry-form" onSubmit={addExpense}><label>Partida<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nueva partida" /></label><label>Categoría<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as OpexCategory })}>{OPEX_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Mes base<input type="month" value={draft.baseMonth} onChange={(event) => setDraft({ ...draft, baseMonth: event.target.value })} /></label><label htmlFor="new-opex-runrate">Base miles CLP<MoneyInput id="new-opex-runrate" ariaLabel="Base de la nueva partida" value={draft.baseAmountClp / 1000} onCommit={(value) => setDraft({ ...draft, baseAmountClp: (value ?? 0) * 1000 })} /></label><button className="primary-action compact" type="submit">Agregar OPEX</button></form>
    </>}

    {activeTab === "projection" && <><div className="cashflow-legend"><span className="legend-cost">OPEX proyectado · miles CLP</span><span className="legend-revenue">Celda ajustada manualmente</span></div><article className="panel data-panel horizontal-cashflow-panel"><div className="horizontal-cashflow-scroll"><table className="horizontal-cashflow-table opex-projection-table"><thead><tr className="year-band"><th rowSpan={2}>Partida</th>{[1, 2, 3].map((year) => <th key={year} colSpan={12}>Año {year}</th>)}<th colSpan={3}>Resumen anual</th></tr><tr className="month-band">{forecast.calendar.map((month, index) => <th key={month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{monthLabel(month)}</th>)}{[1, 2, 3].map((year) => <th key={year} className="annual-column">Año {year}</th>)}</tr></thead><tbody>{OPEX_CATEGORIES.map((category) => <Fragment key={category}><tr className="cashflow-section-row"><th colSpan={40}><strong>{category}</strong><span>Partidas corporativas · miles CLP</span></th></tr>{forecast.byExpense.filter((expense) => expense.category === category).map((expense) => <tr key={expense.id} className="cost-row"><th><strong>{expense.name}</strong><small>{expense.status} · proporción base editable</small></th>{expense.values.map((value, index) => { const month = forecast.calendar[index]; const adjusted = expense.monthlyOverrides[month] !== undefined; return <td key={month} className={`${adjusted ? "opex-adjusted" : ""} ${(index + 1) % 12 === 0 ? "year-end" : ""}`}><MoneyInput ariaLabel={`${expense.name} ${month}`} value={value / 1000} onCommit={(nextValue) => setOverride(expense, month, nextValue === null ? "" : String(nextValue * 1000))} /></td>; })}{annualSums(expense.values).map((value, index) => <td key={index} className="annual-column">{kclp.format(value / 1000)}</td>)}</tr>)}</Fragment>)}<tr className="cost-row emphasis-row"><th>TOTAL OPEX</th>{forecast.months.map((month, index) => <td key={month.month} className={(index + 1) % 12 === 0 ? "year-end" : ""}>{kclp.format(month.totalClp / 1000)}</td>)}{annual.map((value, index) => <td key={index} className="annual-column">{kclp.format(value / 1000)}</td>)}</tr></tbody></table></div></article><article className="panel cashflow-note opex-override-note"><strong>Las 36 celdas mensuales son editables en miles de CLP.</strong><span>Al editar una celda, ese mes reemplaza la distribución proporcional automática.</span></article></>}
  </>;
}
