"use client";

import { useEffect, useMemo, useState } from "react";
import { B2C_SEED } from "../b2c/seed";
import type { B2CPlan, B2CProduct } from "../b2c/types";
import { calculateDashboardForecast } from "../dashboard/engine";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import type { EnterprisePlan, VolumeSegment } from "../enterprise/types";
import { OPEX_SEED } from "../opex/seed";
import type { OpexExpense, OpexPlan } from "../opex/types";
import { SMB_SEED } from "../smb/seed";
import type { SmbPlan } from "../smb/types";
import { TRANSVERSAL_SEED } from "../transversal/seed";
import type { TransversalPlan } from "../transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });

function InputCell({ value, onChange, step = "any", min }: { value: number; onChange: (value: number) => void; step?: string; min?: number }) {
  return <input className="table-input" type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} />;
}

export function InputsCenter() {
  const [enterprise, setEnterprise] = useState<EnterprisePlan>(() => structuredClone(ENTERPRISE_SEED));
  const [b2c, setB2C] = useState<B2CPlan>(() => structuredClone(B2C_SEED));
  const [smb, setSmb] = useState<SmbPlan>(() => structuredClone(SMB_SEED));
  const [opex, setOpex] = useState<OpexPlan>(() => structuredClone(OPEX_SEED));
  const [transversal, setTransversal] = useState<TransversalPlan>(() => structuredClone(TRANSVERSAL_SEED));
  const [saveState, setSaveState] = useState<"loading" | "saved" | "dirty" | "error">("loading");

  useEffect(() => {
    let active = true;
    Promise.all(["enterprise", "b2c", "smb", "opex", "transversal"].map((model) => fetch(`/api/${model}`, { cache: "no-store" }).then((response) => response.json())))
      .then(([enterpriseData, b2cData, smbData, opexData, transversalData]) => {
        if (!active) return;
        if (enterpriseData.plan) setEnterprise({ ...enterpriseData.plan, assumptions: { ...enterpriseData.plan.assumptions, payoutApiCostClp: enterpriseData.plan.assumptions.payoutApiCostClp ?? 10 } });
        if (b2cData.plan) setB2C(b2cData.plan);
        if (smbData.plan) setSmb(smbData.plan);
        if (opexData.plan) setOpex(opexData.plan);
        if (transversalData.plan) setTransversal(transversalData.plan);
        setSaveState("saved");
      }).catch(() => active && setSaveState("error"));
    return () => { active = false; };
  }, []);

  const markDirty = () => setSaveState("dirty");
  const fx = enterprise.clpPerUsd || 1;
  const ufUsd = transversal.ufClp / fx;
  const dashboard = useMemo(() => calculateDashboardForecast(enterprise, b2c, smb, opex, transversal), [enterprise, b2c, smb, opex, transversal]);

  function patchEnterprise(update: (current: EnterprisePlan) => EnterprisePlan) { setEnterprise((current) => update(current)); markDirty(); }
  function patchB2C(update: (current: B2CPlan) => B2CPlan) { setB2C((current) => update(current)); markDirty(); }
  function patchSmb(update: (current: SmbPlan) => SmbPlan) { setSmb((current) => update(current)); markDirty(); }
  function patchOpex(update: (current: OpexPlan) => OpexPlan) { setOpex((current) => update(current)); markDirty(); }
  function patchTransversal(update: (current: TransversalPlan) => TransversalPlan) { setTransversal((current) => update(current)); markDirty(); }

  async function saveAll() {
    setSaveState("loading");
    const now = new Date().toISOString();
    const plans = [
      ["enterprise", { ...enterprise, version: enterprise.version + 1, updatedAt: now }],
      ["b2c", { ...b2c, version: b2c.version + 1, updatedAt: now }],
      ["smb", { ...smb, version: smb.version + 1, updatedAt: now }],
      ["opex", { ...opex, version: opex.version + 1, updatedAt: now }],
      ["transversal", { ...transversal, modelStartMonth: enterprise.modelStartMonth, version: transversal.version + 1, updatedAt: now }],
    ] as const;
    try {
      const responses = await Promise.all(plans.map(([model, plan]) => fetch(`/api/${model}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(plan) })));
      if (responses.some((response) => !response.ok)) throw new Error("save");
      setEnterprise(plans[0][1]); setB2C(plans[1][1]); setSmb(plans[2][1]); setOpex(plans[3][1]); setTransversal(plans[4][1]); setSaveState("saved");
    } catch { setSaveState("error"); }
  }

  const updateSegment = (id: string, patch: Partial<VolumeSegment>) => patchEnterprise((current) => ({ ...current, volumeSegments: current.volumeSegments.map((segment) => segment.id === id ? { ...segment, ...patch } : segment) }));
  const updateB2CProduct = (id: string, patch: Partial<B2CProduct>) => patchB2C((current) => ({ ...current, products: current.products.map((product) => product.id === id ? { ...product, ...patch } : product) }));
  const updateExpense = (id: string, patch: Partial<OpexExpense>) => patchOpex((current) => ({ ...current, expenses: current.expenses.map((expense) => expense.id === id ? { ...expense, ...patch } : expense) }));

  return <>
    <div className="enterprise-toolbar"><div className={`save-state ${saveState}`}><i></i><span>{saveState === "saved" ? "Todos los inputs están guardados" : saveState === "dirty" ? "Cambios sin guardar" : saveState === "loading" ? "Guardando modelos…" : "No se pudo conectar"}</span></div><button className="primary-action compact" type="button" onClick={saveAll} disabled={saveState === "loading"}>Guardar todos los inputs</button></div>
    <section className="enterprise-kpis cash-kpis"><article><span>Revenue recalculado · 36M</span><strong>{usd.format(dashboard.totals.revenue)}</strong><small>Vista previa en tiempo real</small></article><article className={dashboard.totals.contributionMargin >= 0 ? "positive-card" : "negative-card"}><span>Margen recalculado</span><strong>{usd.format(dashboard.totals.contributionMargin)}</strong><small>{percent.format(dashboard.totals.marginPercent)}</small></article><article className={dashboard.totals.operatingResult >= 0 ? "positive-card" : "negative-card"}><span>Resultado operacional</span><strong>{usd.format(dashboard.totals.operatingResult)}</strong><small>Después de OPEX</small></article><article><span>Unidad de reporte</span><strong>USD</strong><small>UF convertida: {usd.format(ufUsd)}</small></article></section>
    <article className="panel enterprise-method"><span className="section-kicker">CENTRO DE INPUTS</span><strong>Editar driver → recalcular producto → transversal → consolidado</strong><p>Los flujos siguen siendo resultados protegidos. Cada cambio realizado aquí conserva la fórmula y queda registrado en Auditoría al guardar.</p></article>

    <section className="input-center-sections">
      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">CORPORATIVO Y TRANSVERSAL</span><h2>Monedas, UF y red interbancaria</h2></div><a className="method-chip" href="/transversal">Abrir detalle</a></div><div className="table-wrap"><table><thead><tr><th>Input</th><th>Valor editable</th><th>Unidad contractual</th><th>Equivalente USD</th><th>Impacto</th></tr></thead><tbody><tr><td><strong>FX corporativo</strong></td><td><InputCell min={1} value={enterprise.clpPerUsd} onChange={(value) => patchEnterprise((current) => ({ ...current, clpPerUsd: value }))} /></td><td>CLP/USD</td><td>1 USD</td><td>Todos los modelos</td></tr><tr><td><strong>UF base</strong></td><td><InputCell min={0} value={transversal.ufClp} onChange={(value) => patchTransversal((current) => ({ ...current, ufClp: value }))} /></td><td>CLP/UF</td><td>{usd.format(ufUsd)}</td><td>Interbancaria</td></tr>{([['bancoEstadoInboundUf','BancoEstado · entrada'],['bancoEstadoOutboundUf','BancoEstado · salida'],['otherBanksInboundUf','Otros bancos · entrada'],['otherBanksOutboundUf','Otros bancos · salida']] as [keyof TransversalPlan["interbankRates"],string][]).map(([field,label]) => <tr key={field}><td><strong>{label}</strong></td><td><InputCell min={0} value={transversal.interbankRates[field]} onChange={(value) => patchTransversal((current) => ({ ...current, interbankRates: { ...current.interbankRates, [field]: value } }))} /></td><td>UF/tx</td><td>{usd.format(transversal.interbankRates[field] * ufUsd)}</td><td>Ingreso/costo de red</td></tr>)}</tbody></table></div></article>

      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">ENTERPRISE</span><h2>Precios y costos unitarios · USD</h2></div><a className="method-chip" href="/enterprise">Abrir detalle</a></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Input</th><th>USD por unidad</th><th>Estado</th></tr></thead><tbody><tr><td>Iniciación de Pagos</td><td>Precio cliente</td><td><InputCell min={0} value={enterprise.assumptions.paymentInitiationPriceClp / fx} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, paymentInitiationPriceClp: value * current.clpPerUsd } }))} /></td><td>{usd.format((enterprise.assumptions.paymentInitiationPriceClp - enterprise.assumptions.paymentInitiationProviderCostClp) / fx)} margen</td></tr><tr><td>Iniciación de Pagos</td><td>Costo Floid</td><td><InputCell min={0} value={enterprise.assumptions.paymentInitiationProviderCostClp / fx} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, paymentInitiationProviderCostClp: value * current.clpPerUsd } }))} /></td><td>Directo</td></tr><tr><td>Payouts</td><td>Precio BancoEstado</td><td><InputCell min={0} value={enterprise.assumptions.payoutPriceBancoEstadoClp / fx} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, payoutPriceBancoEstadoClp: value * current.clpPerUsd } }))} /></td><td>Revenue</td></tr><tr><td>Payouts</td><td>Precio otros bancos</td><td><InputCell min={0} value={enterprise.assumptions.payoutPriceOtherBanksClp / fx} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, payoutPriceOtherBanksClp: value * current.clpPerUsd } }))} /></td><td>Revenue</td></tr><tr><td>Payouts</td><td>Costo API</td><td><InputCell min={0} value={(enterprise.assumptions.payoutApiCostClp ?? 10) / fx} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, payoutApiCostClp: value * current.clpPerUsd } }))} /></td><td>Único costo del producto</td></tr><tr><td>Payouts</td><td>Mix BancoEstado</td><td><InputCell min={0} value={enterprise.assumptions.payoutDefaultBancoEstadoMix * 100} onChange={(value) => patchEnterprise((current) => ({ ...current, assumptions: { ...current.assumptions, payoutDefaultBancoEstadoMix: value / 100 } }))} /></td><td>%</td><td>Precio ponderado</td></tr></tbody></table></div></article>

      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">ENTERPRISE · VOLUMEN</span><h2>Clientes, Go Lives y curvas</h2></div><span className="method-chip">Mes 0 → 35</span></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Producto</th><th>Go Live</th><th>Tramo</th><th>Volumen</th><th>Estado</th></tr></thead><tbody>{enterprise.clients.flatMap((client) => enterprise.volumeSegments.filter((segment) => segment.clientId === client.id).map((segment, index) => <tr key={segment.id}><td><strong>{client.name}</strong><small>{client.country}</small></td><td>{enterprise.products.find((product) => product.id === client.productId)?.name}</td><td>{index === 0 ? <input className="table-input" type="month" value={client.goLiveMonth} onChange={(event) => patchEnterprise((current) => ({ ...current, clients: current.clients.map((item) => item.id === client.id ? { ...item, goLiveMonth: event.target.value } : item) }))} /> : "↳"}</td><td>Mes {segment.fromMonth}–{segment.toMonth}</td><td><input className="table-input" type="number" min="0" placeholder="Por validar" value={segment.volume ?? ""} onChange={(event) => updateSegment(segment.id, { volume: event.target.value === "" ? null : Number(event.target.value), status: event.target.value === "" ? "Por validar" : "Validado" })} /></td><td><span className={segment.volume === null ? "pending-chip" : "validated-chip"}>{segment.volume === null ? "Por validar" : "Validado"}</span></td></tr>))}</tbody></table></div></article>

      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">B2C / PERSONAS</span><h2>Growth y unit economics · USD</h2></div><a className="method-chip" href="/b2c">Abrir detalle</a></div><div className="input-highlight"><label>Crecimiento anual MAU<input type="number" step="any" value={b2c.annualMauGrowthRate * 100} onChange={(event) => patchB2C((current) => ({ ...current, annualMauGrowthRate: Number(event.target.value) / 100 }))} /></label></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Go Live</th><th>% MAU</th><th>Usos/mes</th><th>Ticket USD</th><th>Ingreso fijo USD</th><th>Costo fijo USD</th><th>Estado</th></tr></thead><tbody>{b2c.products.map((product) => <tr key={product.id}><td><strong>{product.segment}</strong><small>{product.line}</small></td><td><input className="table-input" type="month" value={product.goLiveMonth} onChange={(event) => updateB2CProduct(product.id, { goLiveMonth: event.target.value })} /></td><td><InputCell min={0} value={product.adoptionRate * 100} onChange={(value) => updateB2CProduct(product.id, { adoptionRate: value / 100 })} /></td><td><InputCell min={0} value={product.usesPerMonth} onChange={(value) => updateB2CProduct(product.id, { usesPerMonth: value })} /></td><td><InputCell min={0} value={product.ticketClp / fx} onChange={(value) => updateB2CProduct(product.id, { ticketClp: value * fx })} /></td><td><InputCell min={0} value={product.fixedRevenueClpPerTx / fx} onChange={(value) => updateB2CProduct(product.id, { fixedRevenueClpPerTx: value * fx })} /></td><td><InputCell min={0} value={product.fixedCostClpPerTx / fx} onChange={(value) => updateB2CProduct(product.id, { fixedCostClpPerTx: value * fx })} /></td><td><span className={product.providerStatus === "Validado" ? "validated-chip" : "pending-chip"}>{product.providerStatus}</span></td></tr>)}</tbody></table></div></article>

      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">SMB</span><h2>Drivers centrales</h2></div><a className="method-chip" href="/smb">Abrir detalle</a></div><div className="input-card-grid"><label>Crecimiento mensual empresas Año 2 (%)<input type="number" step="any" value={smb.commercial.monthlyCompanyGrowthYear2 * 100} onChange={(event) => patchSmb((current) => ({ ...current, commercial: { ...current.commercial, monthlyCompanyGrowthYear2: Number(event.target.value) / 100 } }))} /></label><label>Comisión Factor Place (%)<input type="number" step="any" value={smb.factorPlace.effectiveCommissionRate * 100} onChange={(event) => patchSmb((current) => ({ ...current, factorPlace: { ...current.factorPlace, effectiveCommissionRate: Number(event.target.value) / 100 } }))} /></label><label>Precio Plan Empresa (UF/mes)<input type="number" step="any" value={smb.commercial.planPriceUf} onChange={(event) => patchSmb((current) => ({ ...current, commercial: { ...current.commercial, planPriceUf: Number(event.target.value) } }))} /></label><label>Margen objetivo SGR (%)<input type="number" step="any" value={smb.sgr.targetOperatingMargin * 100} onChange={(event) => patchSmb((current) => ({ ...current, sgr: { ...current.sgr, targetOperatingMargin: Number(event.target.value) / 100 } }))} /></label></div></article>

      <article className="panel data-panel input-center-panel"><div className="panel-heading"><div><span className="section-kicker">OPEX</span><h2>Run-rates y crecimiento · USD</h2></div><a className="method-chip" href="/opex">Abrir detalle</a></div><div className="table-wrap"><table><thead><tr><th>Partida</th><th>Categoría</th><th>Run-rate USD</th><th>Método</th><th>Tasa %</th><th>Estado</th></tr></thead><tbody>{opex.expenses.filter((expense) => expense.enabled).map((expense) => <tr key={expense.id}><td><strong>{expense.name}</strong></td><td>{expense.category}</td><td><InputCell min={0} value={expense.baseAmountClp / fx} onChange={(value) => updateExpense(expense.id, { baseAmountClp: value * fx })} /></td><td>{expense.growthMode === "monthly" ? "Mensual" : expense.growthMode === "annual" ? "Anual" : "Fijo"}</td><td><InputCell value={expense.growthRate * 100} onChange={(value) => updateExpense(expense.id, { growthRate: value / 100 })} /></td><td><span className={expense.status === "Validado" ? "validated-chip" : "pending-chip"}>{expense.status}</span></td></tr>)}</tbody></table></div></article>
    </section>
  </>;
}
