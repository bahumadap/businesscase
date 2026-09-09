"use client";

import { useEffect, useMemo, useState } from "react";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan } from "../b2c/types";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan } from "../enterprise/types";
import { OPEX_SEED } from "../opex/seed";
import type { OpexPlan } from "../opex/types";
import { applyProviderConditionsToEnterprise } from "../providers/engine";
import { PROVIDERS_SEED } from "../providers/seed";
import type { ProvidersPlan } from "../providers/types";
import { calculateScenarioForecast } from "../scenarios/engine";
import { SCENARIOS_SEED } from "../scenarios/seed";
import type { ScenarioOverride, ScenariosPlan } from "../scenarios/types";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";
import { TRANSVERSAL_SEED } from "../transversal/seed";
import type { TransversalPlan } from "../transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });

export function ScenariosManager() {
  const [plan, setPlan] = useState<ScenariosPlan>(() => structuredClone(SCENARIOS_SEED));
  const [enterprise, setEnterprise] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2c, setB2C] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smb, setSmb] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [opex, setOpex] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [providers, setProviders] = useState<ProvidersPlan>(() => structuredClone(PROVIDERS_SEED));
  const [transversal, setTransversal] = useState<TransversalPlan>(() => structuredClone(TRANSVERSAL_SEED));
  const [selected, setSelected] = useState("base");
  const [saveState, setSaveState] = useState("Guardado");

  useEffect(() => {
    Promise.all(["scenarios", "enterprise", "b2c", "smb", "opex", "providers", "transversal"].map((key) => fetch(`/api/${key}`, { cache: "no-store" }).then((response) => response.json())))
      .then(([scenarios, e, b, s, o, p, t]) => { if (scenarios.plan) setPlan(scenarios.plan); if (e.plan) setEnterprise(e.plan); if (b.plan) setB2C(b.plan); if (s.plan) setSmb(s.plan); if (o.plan) setOpex(o.plan); if (p.plan) setProviders(p.plan); if (t.plan) setTransversal(t.plan); })
      .catch(() => undefined);
  }, []);

  const appliedEnterprise = useMemo(() => applyProviderConditionsToEnterprise(enterprise, providers), [enterprise, providers]);
  const forecasts = useMemo(() => new Map(plan.scenarios.map((scenario) => [scenario.id, calculateScenarioForecast(appliedEnterprise, b2c, smb, opex, transversal, scenario)])), [plan.scenarios, appliedEnterprise, b2c, smb, opex, transversal]);
  const selectedScenario = plan.scenarios.find((scenario) => scenario.id === selected) ?? plan.scenarios[0];

  function patchScenario(id: string, patch: Partial<ScenarioOverride>) { setPlan((current) => ({ ...current, scenarios: current.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch } : scenario), updatedAt: new Date().toISOString() })); setSaveState("Sin guardar"); }
  async function save() { setSaveState("Guardando…"); const response = await fetch("/api/scenarios", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...plan, version: plan.version + 1, updatedAt: new Date().toISOString() }) }); setSaveState(response.ok ? "Guardado y auditado" : "Error al guardar"); }

  return <>
    <div className="page-heading"><div><span className="section-kicker">WHAT-IF</span><h2>Base, Upside y Downside</h2><p>Base conserva el plan oficial. Upside y Downside guardan solo sus overrides y recalculan el forecast completo.</p></div><div className="heading-actions"><span className={`save-state ${saveState.startsWith("Guardado") ? "saved" : saveState.startsWith("Error") ? "error" : ""}`}><i></i>{saveState}</span><button className="primary-action compact" type="button" onClick={save}>Guardar cambios</button></div></div>
    <section className="scenario-grid">{plan.scenarios.map((scenario) => { const forecast = forecasts.get(scenario.id); return <article className={`panel scenario-card ${scenario.id === selected ? "selected" : ""}`} key={scenario.id} onClick={() => setSelected(scenario.id)}><div><span className="status-pill">{scenario.status}</span>{scenario.id === selected && <em>Seleccionado</em>}</div><h3>{scenario.name}</h3><dl><div><dt>Revenue 36M</dt><dd>{forecast ? usd.format(forecast.totals.revenue) : "—"}</dd></div><div><dt>Margen</dt><dd>{forecast ? percent.format(forecast.totals.marginPercent) : "—"}</dd></div><div><dt>Cash final</dt><dd>{forecast ? usd.format(forecast.totals.endingCash) : "—"}</dd></div></dl><button className={scenario.id === selected ? "ghost-button" : "primary-action compact"} type="button" onClick={() => setSelected(scenario.id)}>Editar overrides</button></article>; })}</section>
    {selectedScenario && <article className="panel comparison-note"><div className="panel-heading"><div><span className="section-kicker">OVERRIDES · {selectedScenario.name.toUpperCase()}</span><h2>Supuestos del escenario</h2></div><span className="method-chip">Se hereda desde Base</span></div><div className="assumption-grid"><label>Multiplicador revenue<input type="number" min="0" step="0.01" value={selectedScenario.revenueMultiplier} onChange={(event) => patchScenario(selectedScenario.id, { revenueMultiplier: Number(event.target.value) || 0 })} /></label><label>Multiplicador costos directos<input type="number" min="0" step="0.01" value={selectedScenario.directCostMultiplier} onChange={(event) => patchScenario(selectedScenario.id, { directCostMultiplier: Number(event.target.value) || 0 })} /></label><label>Go Live Payouts<input type="month" value={selectedScenario.payoutsGoLiveMonth} onChange={(event) => patchScenario(selectedScenario.id, { payoutsGoLiveMonth: event.target.value })} /></label><label>Estado<select value={selectedScenario.status} onChange={(event) => patchScenario(selectedScenario.id, { status: event.target.value as ScenarioOverride["status"] })}><option>Base</option><option>Borrador</option><option>Publicado</option></select></label></div><p>El resultado se recalcula sobre Enterprise, B2C, SMB, OPEX y Transversal. El escenario Base no debe modificarse para representar el presupuesto oficial.</p></article>}
  </>;
}
