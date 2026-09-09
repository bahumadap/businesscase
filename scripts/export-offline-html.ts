import { writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateB2CForecast } from "../src/b2c/engine";
import { B2C_SEED } from "../src/b2c/seed";
import type { B2CPlan } from "../src/b2c/types";
import { buildBudgetRecords, compareBudgetActual } from "../src/actuals/engine";
import { ACTUALS_SEED } from "../src/actuals/seed";
import type { ActualsPlan } from "../src/actuals/types";
import { buildProductCatalog, reconcileMilestonesWithCatalog } from "../src/catalog/products";
import { calculateDashboardForecast } from "../src/dashboard/engine";
import { calculateEnterpriseForecast } from "../src/enterprise/engine";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import type { EnterprisePlan } from "../src/enterprise/types";
import { MILESTONES_SEED } from "../src/milestones/seed";
import type { MilestonesPlan } from "../src/milestones/types";
import { calculateOpexForecast, OPEX_CATEGORIES } from "../src/opex/engine";
import { OPEX_SEED } from "../src/opex/seed";
import type { OpexPlan } from "../src/opex/types";
import { PROVIDERS_SEED } from "../src/providers/seed";
import type { ProvidersPlan } from "../src/providers/types";
import { calculateSmbForecast } from "../src/smb/engine";
import { SMB_SEED } from "../src/smb/seed";
import type { SmbPlan } from "../src/smb/types";
import { calculateTransversalForecast } from "../src/transversal/engine";
import { TRANSVERSAL_SEED } from "../src/transversal/seed";
import type { TransversalPlan } from "../src/transversal/types";

const usd = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdUnit = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function money(value: number) {
  return usd.format(Number.isFinite(value) ? value : 0);
}

function unitMoney(value: number) {
  return usdUnit.format(Number.isFinite(value) ? value : 0);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function chip(label: string) {
  const tone = /validado|activo|completo|fuente/i.test(label) ? "ok" : /negativo|atrasado|inactivo/i.test(label) ? "bad" : "pending";
  return `<span class="chip ${tone}">${esc(label)}</span>`;
}

async function apiPlan<T>(endpoint: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`http://localhost:3000${endpoint}`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return structuredClone(fallback);
    const payload = await response.json() as { plan?: T };
    return payload.plan ?? structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

type AuditEntry = { id: string; actor: string; entity: string; action: "create" | "update" | "delete"; before_json: string | null; after_json: string | null; changed_at: string };

async function apiAudit(): Promise<AuditEntry[]> {
  try {
    const response = await fetch("http://localhost:3000/api/audit?limit=100", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return [];
    const payload = await response.json() as { entries?: AuditEntry[] };
    return payload.entries ?? [];
  } catch {
    return [];
  }
}

const [enterprisePlan, b2cPlan, smbPlan, opexPlan, providersPlan, transversalPlan, actualsPlan, milestonesPlan, auditEntries] = await Promise.all([
  apiPlan<EnterprisePlan>("/api/enterprise", ENTERPRISE_SEED),
  apiPlan<B2CPlan>("/api/b2c", B2C_SEED),
  apiPlan<SmbPlan>("/api/smb", SMB_SEED),
  apiPlan<OpexPlan>("/api/opex", OPEX_SEED),
  apiPlan<ProvidersPlan>("/api/providers", PROVIDERS_SEED),
  apiPlan<TransversalPlan>("/api/transversal", TRANSVERSAL_SEED),
  apiPlan<ActualsPlan>("/api/actuals", ACTUALS_SEED),
  apiPlan<MilestonesPlan>("/api/milestones", MILESTONES_SEED),
  apiAudit(),
]);

const enterprise = calculateEnterpriseForecast(enterprisePlan);
const b2c = calculateB2CForecast(b2cPlan);
const smb = calculateSmbForecast(smbPlan);
const opex = calculateOpexForecast(opexPlan, enterprisePlan.modelStartMonth, enterprisePlan.horizonMonths);
const transversal = calculateTransversalForecast(transversalPlan, enterprise.clientForecasts, enterprisePlan.clpPerUsd);
const dashboard = calculateDashboardForecast(enterprisePlan, b2cPlan, smbPlan, opexPlan, transversalPlan);
const catalog = buildProductCatalog(enterprisePlan, b2cPlan, smbPlan);
const milestones = reconcileMilestonesWithCatalog(milestonesPlan.milestones, catalog);
const budgetRecords = buildBudgetRecords(enterprisePlan, b2cPlan, smbPlan, opexPlan, transversalPlan);
const actualComparison = compareBudgetActual(budgetRecords, actualsPlan.records, "year", { area: "", country: "", provider: "", client: "", product: "", category: "" });
const fx = enterprisePlan.clpPerUsd;
const exportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(new Date());
const chartMax = Math.max(...dashboard.months.flatMap((month) => [month.revenue, month.totalCosts]), 1);

const monthlyChart = dashboard.months.map((month, index) => {
  const revenueHeight = Math.max(2, Math.round(month.revenue / chartMax * 142));
  const costHeight = Math.max(2, Math.round(month.totalCosts / chartMax * 142));
  return `<div class="chart-month"><div class="chart-bars"><i class="revenue-bar" style="height:${revenueHeight}px" title="Ingresos ${money(month.revenue)}"></i><i class="cost-bar" style="height:${costHeight}px" title="Costos ${money(month.totalCosts)}"></i></div><span>${index % 3 === 0 ? esc(monthLabel(month.month)) : "·"}</span></div>`;
}).join("");

const enterpriseRows = enterprise.byProduct.map((product) => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.driver)}</small></td><td>${esc(product.goLive)}</td>${product.annualRevenue.map((value, year) => `<td>${product.pendingYears[year] ? chip("Parcial") : money(value)}</td>`).join("")}<td class="${product.margin >= 0 ? "positive" : "negative"}">${money(product.margin)}</td><td>${percent.format(product.marginPercent)}</td></tr>`).join("");
const clientRows = enterprisePlan.clients.map((client) => `<tr><td><strong>${esc(client.name)}</strong></td><td>${esc(client.country)}</td><td>${esc(enterprisePlan.products.find((product) => product.id === client.productId)?.name ?? client.productId)}</td><td>${esc(client.goLiveMonth)}</td><td>${chip(client.status)}</td></tr>`).join("");

const b2cRows = b2c.byProduct.map((line) => `<tr><td><strong>${esc(line.name)}</strong></td><td>${esc(line.goLiveMonth)}</td>${line.annualRevenue.map((value) => `<td>${money(value / fx)}</td>`).join("")}<td class="${line.margin >= 0 ? "positive" : "negative"}">${money(line.margin / fx)}</td><td>${percent.format(line.marginPercent)}</td></tr>`).join("");

const smbRows = smb.byProduct.map((product) => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.category)}</small></td><td>${esc(product.goLiveMonth)}</td>${product.annualRevenue.map((value) => `<td>${money(value / fx)}</td>`).join("")}<td class="${product.margin >= 0 ? "positive" : "negative"}">${money(product.margin / fx)}</td><td>${chip(product.sourceStatus)}</td></tr>`).join("");

const opexRows = opexPlan.expenses.filter((expense) => expense.enabled).map((expense) => `<tr><td><strong>${esc(expense.name)}</strong></td><td>${esc(expense.category)}</td><td>${money(expense.baseAmountClp / fx)}</td><td>${esc(expense.growthMode === "monthly" ? "Mensual" : expense.growthMode === "annual" ? "Anual" : "Fijo")}</td><td>${percent.format(expense.growthRate)}</td><td>${chip(expense.status)}</td></tr>`).join("");

const catalogRows = catalog.map((product) => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.productId)}</small></td><td>${esc(product.vertical)}</td><td>${esc(product.goLiveMonth)}</td><td>${esc(product.detail)}</td><td>${chip(product.status)}</td></tr>`).join("");

const providerRows = providersPlan.conditions.map((condition) => {
  const provider = providersPlan.providers.find((item) => item.id === condition.providerId);
  const unitUsd = condition.currency === "USD" ? condition.unitFee : condition.unitFee / condition.fxToUsd;
  return `<tr><td><strong>${esc(provider?.name ?? condition.providerId)}</strong><small>${esc(condition.service)}</small></td><td>${esc(condition.product)}</td><td>${esc(condition.pricingModel)}</td><td>${unitMoney(unitUsd)}</td><td>${number.format(condition.assumedMonthlyVolume)}</td><td>${esc(condition.validFrom)} → ${esc(condition.validTo)}</td><td>${chip(condition.status)}</td></tr>`;
}).join("");

const transversalLinkRows = transversal.byLink.map((link) => {
  const inbound = link.rows.reduce((sum, row) => sum + row.inboundTransactions, 0);
  const outbound = link.rows.reduce((sum, row) => sum + row.outboundTransactions, 0);
  const source = link.sourceMode === "enterprise_client"
    ? enterprisePlan.clients.find((client) => client.id === link.enterpriseClientId)?.name ?? "Cliente Enterprise"
    : link.sourceMode === "enterprise_product"
      ? `${enterprisePlan.products.find((product) => product.id === link.enterpriseProductId)?.name ?? "Producto Enterprise"} · todos los clientes`
      : "Volumen manual";
  return `<tr><td><strong>${esc(link.name)}</strong><small>${esc(source)}</small></td><td>${esc(link.goLiveMonth)}</td><td>${number.format(inbound)}</td><td>${number.format(outbound)}</td><td>${percent.format(link.bancoEstadoMix)}</td><td>${money(link.revenueUsd)}</td><td class="negative">${money(link.costUsd ? -link.costUsd : 0)}</td><td class="${link.contributionMarginUsd >= 0 ? "positive" : "negative"}">${money(link.contributionMarginUsd)}</td><td>${chip(link.status)}</td></tr>`;
}).join("");

const transversalAnnualRows = [0, 1, 2].map((year) => {
  const rows = transversal.months.slice(year * 12, year * 12 + 12);
  const inbound = rows.reduce((sum, row) => sum + row.inboundTransactions, 0);
  const outbound = rows.reduce((sum, row) => sum + row.outboundTransactions, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenueUsd, 0);
  const cost = rows.reduce((sum, row) => sum + row.costUsd, 0);
  return `<tr><td><strong>Año ${year + 1}</strong></td><td>${number.format(inbound)}</td><td>${number.format(outbound)}</td><td>${money(revenue)}</td><td class="negative">${money(-cost)}</td><td class="${revenue - cost >= 0 ? "positive" : "negative"}"><strong>${money(revenue - cost)}</strong></td></tr>`;
}).join("");

const inputRows = [
  ["Corporativo", "FX corporativo", number.format(enterprisePlan.clpPerUsd), "CLP/USD", "Conversión de todos los modelos"],
  ["Transversal", "UF base", number.format(transversalPlan.ufClp), "CLP/UF", `1 UF = ${unitMoney(transversal.ufUsd)}`],
  ["Transversal", "BancoEstado · entrada", String(transversalPlan.interbankRates.bancoEstadoInboundUf), "UF/tx", unitMoney(transversalPlan.interbankRates.bancoEstadoInboundUf * transversal.ufUsd)],
  ["Transversal", "BancoEstado · salida", String(transversalPlan.interbankRates.bancoEstadoOutboundUf), "UF/tx", unitMoney(transversalPlan.interbankRates.bancoEstadoOutboundUf * transversal.ufUsd)],
  ["Transversal", "Otros bancos · entrada", String(transversalPlan.interbankRates.otherBanksInboundUf), "UF/tx", unitMoney(transversalPlan.interbankRates.otherBanksInboundUf * transversal.ufUsd)],
  ["Transversal", "Otros bancos · salida", String(transversalPlan.interbankRates.otherBanksOutboundUf), "UF/tx", unitMoney(transversalPlan.interbankRates.otherBanksOutboundUf * transversal.ufUsd)],
  ["Enterprise", "Iniciación · precio cliente", number.format(enterprisePlan.assumptions.paymentInitiationPriceClp), "CLP/tx", `Margen ${number.format(enterprisePlan.assumptions.paymentInitiationPriceClp - enterprisePlan.assumptions.paymentInitiationProviderCostClp)} CLP`],
  ["Enterprise", "Iniciación · costo Floid", number.format(enterprisePlan.assumptions.paymentInitiationProviderCostClp), "CLP/tx", "Costo directo"],
  ["Enterprise", "Payouts · costo API", number.format(enterprisePlan.assumptions.payoutApiCostClp ?? 10), "CLP/payout", "Único costo directo del producto"],
  ["Enterprise", "Payouts · mix BancoEstado", percent.format(enterprisePlan.assumptions.payoutDefaultBancoEstadoMix), "%", "Precio ponderado e interbancaria"],
  ["B2C", "Crecimiento anual MAU", percent.format(b2cPlan.annualMauGrowthRate), "% anual", "Volumen y revenue B2C"],
  ["SMB", "Crecimiento empresas Año 2", percent.format(smbPlan.commercial.monthlyCompanyGrowthYear2), "% mensual", "Servicios comerciales"],
  ["SMB", "Comisión Factor Place", percent.format(smbPlan.factorPlace.effectiveCommissionRate), "%", "Revenue Factor Place"],
  ["SMB", "Plan Empresa", String(smbPlan.commercial.planPriceUf), "UF/mes", "Revenue recurrente"],
  ["SMB", "Margen objetivo SGR", percent.format(smbPlan.sgr.targetOperatingMargin), "%", "Calibración SGR"],
].map(([area, driver, value, unit, impact]) => `<tr><td>${chip(area)}</td><td><strong>${esc(driver)}</strong></td><td>${esc(value)}</td><td>${esc(unit)}</td><td>${esc(impact)}</td></tr>`).join("");

const actualComparisonRows = actualComparison.map((row) => actualsPlan.records.length
  ? `<tr><td><strong>${esc(row.period)}</strong></td><td>${esc(row.category)}</td><td>${money(row.budget)}</td><td>${money(row.actual)}</td><td class="${row.variance >= 0 ? "positive" : "negative"}">${money(row.variance)}</td><td>${row.variancePercent === null ? "—" : percent.format(row.variancePercent)}</td></tr>`
  : `<tr><td><strong>${esc(row.period)}</strong></td><td>${esc(row.category)}</td><td>${money(row.budget)}</td><td>${chip("Por cargar")}</td><td>—</td><td>—</td></tr>`).join("");

const auditRows = auditEntries.slice(0, 20).map((entry) => `<tr><td>${esc(new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(entry.changed_at)))}</td><td><strong>${esc(entry.actor)}</strong></td><td>${chip(entry.action === "create" ? "Creación" : entry.action === "delete" ? "Eliminación" : "Actualización")}</td><td>${esc(entry.entity)}</td><td>${entry.before_json ? "Valor anterior disponible" : "Sin valor anterior"}</td><td>${entry.after_json ? "Valor nuevo registrado" : "Registro eliminado"}</td></tr>`).join("");

const roadmapStart = new Date("2026-09-01T00:00:00Z").getTime();
const roadmapSpan = 36 * 30.4375 * 24 * 60 * 60 * 1000;
const roadmapRows = milestones.map((milestone) => {
  const start = new Date(`${milestone.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${milestone.endDate}T00:00:00Z`).getTime();
  const left = Math.max(0, Math.min(100, (start - roadmapStart) / roadmapSpan * 100));
  const width = Math.max(1.5, Math.min(100 - left, (Math.max(end, start + 14 * 86400000) - start) / roadmapSpan * 100));
  return `<tr><td><strong>${esc(milestone.name)}</strong><small>${esc(milestone.area)} · ${esc(milestone.owner)}</small></td><td>${esc(milestone.targetDate)}</td><td>${chip(milestone.status)}</td><td><div class="gantt"><i style="left:${left}%;width:${width}%"></i></div></td></tr>`;
}).join("");

const annualRows = dashboard.annual.map((year) => `<tr><td><strong>Año ${year.year}</strong></td><td>${money(year.revenue)}</td><td class="negative">${money(-year.directCosts)}</td><td>${money(year.contributionMargin)}</td><td class="negative">${money(-year.opexTotal)}</td><td class="${year.operatingResult >= 0 ? "positive" : "negative"}"><strong>${money(year.operatingResult)}</strong></td><td>${percent.format(year.marginPercent)}</td></tr>`).join("");

const opexCategoryCards = OPEX_CATEGORIES.map((category) => {
  const value = opex.months.reduce((sum, month) => sum + month.byCategory[category], 0) / fx;
  return `<article class="mini-card"><span>${esc(category)}</span><strong>${money(value)}</strong><small>36 meses</small></article>`;
}).join("");

const pages = `
<section class="page active" data-page="dashboard">
  <div class="page-title"><div><span class="eyebrow">VISIÓN EJECUTIVA · 36 MESES</span><h1>Dashboard general</h1><p>Ingresos, costos, margen y caja consolidados en USD.</p></div>${chip(dashboard.pending ? "Modelo parcial" : "Modelo completo")}</div>
  <div class="kpis"><article><span>Revenue consolidado</span><strong>${money(dashboard.totals.revenue)}</strong><small>Horizonte completo</small></article><article><span>Margen de contribución</span><strong>${money(dashboard.totals.contributionMargin)}</strong><small>${percent.format(dashboard.totals.marginPercent)}</small></article><article class="${dashboard.totals.operatingResult >= 0 ? "good" : "risk"}"><span>Resultado operacional</span><strong>${money(dashboard.totals.operatingResult)}</strong><small>Después de OPEX</small></article><article><span>Primer mes positivo</span><strong>${dashboard.firstPositiveMonth ? esc(monthLabel(dashboard.firstPositiveMonth)) : "Pendiente"}</strong><small>Resultado mensual</small></article></div>
  <article class="panel"><div class="panel-head"><div><span class="eyebrow">INGRESOS VS COSTOS</span><h2>Evolución mensual</h2></div><div class="legend"><span><i class="lime"></i>Ingresos</span><span><i class="pink"></i>Costos</span></div></div><div class="monthly-chart">${monthlyChart}</div></article>
  <div class="two-cols"><article class="panel"><div class="panel-head"><div><span class="eyebrow">MOTORES DEL MODELO</span><h2>Negocio y costo corporativo</h2></div></div><div class="vertical-list">${dashboard.verticals.map((vertical) => `<button data-go="${esc(vertical.id === "enterprise" ? "enterprise" : vertical.id)}"><i style="background:${vertical.color}"></i><span><strong>${esc(vertical.name)}</strong><small>${vertical.id === "transversal" ? `Costo 36M ${money(Math.abs(vertical.margin))}` : `${money(vertical.revenue)} · Margen ${money(vertical.margin)}`}</small></span><b>${vertical.id === "transversal" ? "Corporativo" : percent.format(vertical.share)}</b></button>`).join("")}</div></article><article class="panel"><div class="panel-head"><div><span class="eyebrow">RESUMEN ANUAL</span><h2>Resultado operacional</h2></div></div><div class="year-cards">${dashboard.annual.map((year) => `<div><span>Año ${year.year}</span><strong class="${year.operatingResult >= 0 ? "positive" : "negative"}">${money(year.operatingResult)}</strong><small>Revenue ${money(year.revenue)}</small></div>`).join("")}</div></article></div>
</section>

<section class="page" data-page="consolidated"><div class="page-title"><div><span class="eyebrow">FLUJO CONSOLIDADO · USD</span><h1>Presupuesto consolidado</h1><p>Lectura horizontal: revenue → costos directos → margen → OPEX → resultado.</p></div></div><article class="panel table-panel"><table><thead><tr><th>Período</th><th>Revenue</th><th>Costos directos</th><th>Contribución</th><th>OPEX</th><th>Resultado</th><th>Margen</th></tr></thead><tbody>${annualRows}</tbody></table></article><article class="panel"><div class="panel-head"><div><span class="eyebrow">DETALLE MENSUAL</span><h2>Resultado operacional</h2></div></div><div class="monthly-result">${dashboard.months.map((month) => `<div class="${month.operatingResult >= 0 ? "up" : "down"}"><span>${esc(monthLabel(month.month))}</span><strong>${money(month.operatingResult)}</strong></div>`).join("")}</div></article></section>

<section class="page" data-page="enterprise"><div class="page-title"><div><span class="eyebrow">VERTICAL ENTERPRISE</span><h1>Productos, clientes y economía</h1><p>Go Live → mes desde Go Live → volumen → revenue → costos directos → margen.</p></div>${chip(enterprise.pendingAssumptions ? `${enterprise.pendingAssumptions} supuestos pendientes` : "Completo")}</div><article class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">RESUMEN POR PRODUCTO</span><h2>Revenue y margen · USD</h2></div></div><table><thead><tr><th>Producto</th><th>Go Live</th><th>Año 1</th><th>Año 2</th><th>Año 3</th><th>Margen 36M</th><th>Margen %</th></tr></thead><tbody>${enterpriseRows}</tbody></table></article><article class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">PIPELINE</span><h2>Clientes y Go Lives</h2></div></div><table><thead><tr><th>Cliente</th><th>País</th><th>Producto</th><th>Go Live</th><th>Estado</th></tr></thead><tbody>${clientRows}</tbody></table></article></section>

<section class="page" data-page="b2c"><div class="page-title"><div><span class="eyebrow">VERTICAL B2C / PERSONAS</span><h1>Growth model y unit economics</h1><p>MAU → adopción → usos → transacciones netas → revenue → costos → margen.</p></div></div><article class="panel table-panel"><table><thead><tr><th>Línea</th><th>Go Live</th><th>Año 1</th><th>Año 2</th><th>Año 3</th><th>Margen 36M</th><th>Margen %</th></tr></thead><tbody>${b2cRows}</tbody></table></article></section>

<section class="page" data-page="smb"><div class="page-title"><div><span class="eyebrow">VERTICAL SMB</span><h1>Productos y supuestos PyME</h1><p>Empresas y volumen → uso del producto → revenue → costos directos → margen.</p></div>${chip("Fuente parcial · 24 meses")}</div><article class="panel table-panel"><table><thead><tr><th>Producto</th><th>Go Live</th><th>Año 1</th><th>Año 2</th><th>Año 3</th><th>Margen 36M</th><th>Estado</th></tr></thead><tbody>${smbRows}</tbody></table></article></section>

<section class="page" data-page="transversal"><div class="page-title"><div><span class="eyebrow">NEGOCIOS TRANSVERSALES</span><h1>Interbancaria y negocios generales</h1><p>Volumen de entrada/salida → tarifa en UF → conversión USD → consolidado YOL1.</p></div>${chip(transversal.pendingAssumptions ? `${transversal.pendingAssumptions} supuestos pendientes` : "Modelo validado")}</div><div class="kpis"><article><span>Entradas interbancarias</span><strong>${number.format(transversal.totals.inboundTransactions)}</strong><small>Transacciones · 36 meses</small></article><article><span>Salidas interbancarias</span><strong>${number.format(transversal.totals.outboundTransactions)}</strong><small>Transacciones · 36 meses</small></article><article class="risk"><span>Costo transversal</span><strong>${money(transversal.totals.costUsd)}</strong><small>Red y otros costos</small></article><article class="${transversal.totals.contributionMarginUsd >= 0 ? "good" : "risk"}"><span>Margen transversal</span><strong>${money(transversal.totals.contributionMarginUsd)}</strong><small>Ingresos menos costos</small></article></div><article class="callout"><strong>Separación financiera clave</strong><span>Los pay-ins suman automáticamente todos los clientes de Iniciación de Pagos como ingreso de red. Payouts conserva solamente el costo API en Enterprise y la salida interbancaria vive aquí.</span></article><article class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">ORÍGENES DE VOLUMEN</span><h2>Economía por vínculo</h2></div><span class="chip ok">1 UF = ${unitMoney(transversal.ufUsd)}</span></div><table><thead><tr><th>Origen</th><th>Go Live</th><th>Entradas 36M</th><th>Salidas 36M</th><th>Mix BE</th><th>Ingresos</th><th>Costos</th><th>Margen</th><th>Estado</th></tr></thead><tbody>${transversalLinkRows}</tbody></table></article><article class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">RESUMEN ANUAL</span><h2>Flujo transversal · USD</h2></div></div><table><thead><tr><th>Período</th><th>Entradas</th><th>Salidas</th><th>Ingresos</th><th>Costos</th><th>Margen</th></tr></thead><tbody>${transversalAnnualRows}</tbody></table></article></section>

<section class="page" data-page="opex"><div class="page-title"><div><span class="eyebrow">OPEX CORPORATIVO</span><h1>Partidas y drivers de crecimiento</h1><p>Valores normalizados a USD. Marketing y SEO están excluidos.</p></div></div><div class="mini-grid">${opexCategoryCards}</div><article class="panel table-panel"><table><thead><tr><th>Código</th><th>Partida</th><th>Categoría</th><th>Run-rate USD</th><th>Método</th><th>Tasa</th><th>Estado</th></tr></thead><tbody>${opexRows}</tbody></table></article></section>

<section class="page" data-page="inputs"><div class="page-title"><div><span class="eyebrow">CENTRO DE INPUTS</span><h1>Drivers que gobiernan la proyección</h1><p>Los cambios de estos supuestos recalculan verticales, Transversal, consolidado y dashboard.</p></div>${chip(`${inputRows.match(/<tr>/g)?.length ?? 0} drivers destacados`)}</div><article class="panel method-flow"><div><b>1</b><strong>Editar driver</strong><span>Precio, volumen, fecha, FX o tarifa</span></div><i>→</i><div><b>2</b><strong>Recalcular motor</strong><span>Economics por producto y vertical</span></div><i>→</i><div><b>3</b><strong>Consolidar</strong><span>Presupuesto, cash flow y dashboard</span></div></article><article class="panel table-panel"><table><thead><tr><th>Área</th><th>Driver</th><th>Valor</th><th>Unidad</th><th>Impacto</th></tr></thead><tbody>${inputRows}</tbody></table></article><article class="callout"><strong>Gobierno del modelo</strong><span>El flujo de caja es una salida calculada. Para cambiarlo se modifica el driver correspondiente, no una celda de resultado.</span></article></section>

<section class="page" data-page="verticals"><div class="page-title"><div><span class="eyebrow">ESTRUCTURA COMERCIAL</span><h1>Verticales de negocio</h1><p>Cada vertical administra sus productos, drivers, ingresos y costos directos.</p></div>${chip("3 verticales conectadas")}</div><div class="vertical-cards">${dashboard.verticals.filter((vertical) => ["enterprise", "b2c", "smb"].includes(vertical.id)).map((vertical, index) => `<article style="--vertical-color:${vertical.color}"><span>V${String(index + 1).padStart(2, "0")}</span><h2>${esc(vertical.name)}</h2><p>${vertical.id === "enterprise" ? "Clientes corporativos, cuentas virtuales, iniciación y payouts." : vertical.id === "b2c" ? "Productos de personas, adquisición, MAU y unit economics." : "Factor Place, servicios PyME, Plan Empresa y SGR."}</p><dl><div><dt>Productos</dt><dd>${catalog.filter((product) => product.vertical.toLowerCase() === vertical.id).length}</dd></div><div><dt>Revenue 36M</dt><dd>${money(vertical.revenue)}</dd></div><div><dt>Margen 36M</dt><dd>${money(vertical.margin)}</dd></div></dl><button data-go="${esc(vertical.id)}">Ver modelo →</button></article>`).join("")}</div><article class="callout"><strong>Transversal es corporativo</strong><span>Interbancaria y otros negocios generales se consolidan en YOL1, pero no se presentan como una cuarta vertical comercial.</span></article></section>

<section class="page" data-page="products"><div class="page-title"><div><span class="eyebrow">CATÁLOGO MAESTRO</span><h1>Productos de todas las verticales</h1><p>Inventario sincronizado con Enterprise, B2C y SMB.</p></div>${chip(`${catalog.length} productos`)}</div><article class="panel table-panel"><table><thead><tr><th>Producto</th><th>Vertical</th><th>Go Live</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>${catalogRows}</tbody></table></article></section>

<section class="page" data-page="providers"><div class="page-title"><div><span class="eyebrow">PROVEEDORES Y COSTOS</span><h1>Condiciones comerciales</h1><p>Fuente central para presupuestar tarifas fijas, unitarias y porcentuales.</p></div></div><article class="panel table-panel"><table><thead><tr><th>Proveedor / servicio</th><th>Producto</th><th>Modelo</th><th>Fee unitario USD</th><th>Volumen supuesto</th><th>Vigencia</th><th>Estado</th></tr></thead><tbody>${providerRows}</tbody></table></article></section>

<section class="page" data-page="roadmap"><div class="page-title"><div><span class="eyebrow">CALENDARIO Y GANTT</span><h1>Pipeline de productos</h1><p>Go Lives e hitos sincronizados con el catálogo.</p></div></div><article class="panel table-panel"><table><thead><tr><th>Hito</th><th>Fecha objetivo</th><th>Estado</th><th>Sep 2026 → Ago 2029</th></tr></thead><tbody>${roadmapRows}</tbody></table></article></section>

<section class="page" data-page="actuals"><div class="page-title"><div><span class="eyebrow">PRESUPUESTO VS REAL</span><h1>Control de desviaciones</h1><p>Comparación por período y categoría financiera, lista para filtrar por área, país, proveedor, cliente y producto.</p></div>${chip(actualsPlan.records.length ? `${actualsPlan.records.length} registros reales` : "Real por cargar")}</div><div class="kpis"><article><span>Registros de ejecución</span><strong>${number.format(actualsPlan.records.length)}</strong><small>Escenario Real</small></article><article><span>Granularidades</span><strong>5</strong><small>Año · trimestre · mes · semana · día</small></article><article><span>Dimensiones</span><strong>6</strong><small>Área · país · proveedor · cliente · producto · categoría</small></article><article class="${actualsPlan.records.length ? "good" : "risk"}"><span>Estado</span><strong>${actualsPlan.records.length ? "Cargado" : "Pendiente"}</strong><small>No se inventa ejecución</small></article></div><article class="panel table-panel"><table><thead><tr><th>Período</th><th>Categoría</th><th>Presupuesto</th><th>Real</th><th>Desviación</th><th>Desviación %</th></tr></thead><tbody>${actualComparisonRows}</tbody></table></article><article class="callout"><strong>Flujo funcional</strong><span>Condiciones de proveedores → costos → presupuesto → carga Real → análisis de desviaciones</span></article></section>

<section class="page" data-page="imports"><div class="page-title"><div><span class="eyebrow">INTERCAMBIO DE DATOS</span><h1>Importaciones y exportaciones</h1><p>Cada conjunto puede descargarse, revisarse y volver a cargarse conservando su esquema y trazabilidad.</p></div>${chip("JSON + CSV")}</div><article class="panel method-flow"><div><b>1</b><strong>Descargar</strong><span>Obtener la versión vigente</span></div><i>→</i><div><b>2</b><strong>Revisar</strong><span>Editar sin perder identificadores</span></div><i>→</i><div><b>3</b><strong>Cargar y auditar</strong><span>Validar y registrar diferencias</span></div></article><div class="dataset-grid">${[
  ["Enterprise", `${enterprisePlan.products.length} productos · ${enterprisePlan.clients.length} clientes`, enterprisePlan.updatedAt],
  ["B2C", `${b2cPlan.products.length} productos · MAU y economics`, b2cPlan.updatedAt],
  ["SMB", `${smbPlan.products.length} productos · Factor, Comercial y SGR`, smbPlan.updatedAt],
  ["Transversal", `${transversalPlan.links.length} vínculos · ${transversalPlan.entries.length} otras partidas`, transversalPlan.updatedAt],
  ["OPEX", `${opexPlan.expenses.filter((expense) => expense.enabled).length} partidas activas`, opexPlan.updatedAt],
  ["Proveedores", `${providersPlan.providers.length} proveedores · ${providersPlan.conditions.length} condiciones`, providersPlan.updatedAt],
  ["Escenario Real", `${actualsPlan.records.length} registros`, actualsPlan.updatedAt],
  ["Pipeline / Gantt", `${milestones.length} hitos`, milestonesPlan.updatedAt],
].map(([name, detail, updated]) => `<article><span class="chip ok">JSON</span><h3>${esc(name)}</h3><p>${esc(detail)}</p><small>Actualizado ${esc(new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(updated)))}</small></article>`).join("")}</div></section>

<section class="page" data-page="audit"><div class="page-title"><div><span class="eyebrow">TRAZABILIDAD CONSOLIDADA</span><h1>Auditoría de cambios</h1><p>Usuario, fecha, entidad, acción y disponibilidad de valores anteriores y nuevos.</p></div>${chip(`${auditEntries.length} evento${auditEntries.length === 1 ? "" : "s"} exportado${auditEntries.length === 1 ? "" : "s"}`)}</div><div class="kpis"><article><span>Eventos</span><strong>${number.format(auditEntries.length)}</strong><small>Últimos 100 disponibles</small></article><article><span>Usuarios</span><strong>${new Set(auditEntries.map((entry) => entry.actor)).size}</strong><small>Actores identificados</small></article><article><span>Actualizaciones</span><strong>${auditEntries.filter((entry) => entry.action === "update").length}</strong><small>Registros modificados</small></article><article><span>Creaciones / eliminaciones</span><strong>${auditEntries.filter((entry) => entry.action !== "update").length}</strong><small>Trazabilidad estructural</small></article></div><article class="panel table-panel"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Antes</th><th>Después</th></tr></thead><tbody>${auditRows || `<tr><td colspan="6"><div class="empty-state"><strong>Sin eventos históricos en esta copia</strong><span>Los próximos cambios guardados aparecerán en la auditoría de la aplicación.</span></div></td></tr>`}</tbody></table></article></section>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YOL1 · Planificación Financiera · Presentación para Finanzas</title>
<style>
:root{--navy:#092a39;--navy2:#113a49;--cream:#f5efdf;--paper:#fffdf8;--lime:#80ef0c;--cyan:#28b6be;--pink:#d73169;--ink:#173241;--muted:#70818a;--line:#d9ddd7;--soft:#eef7e6}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13px}.app{display:grid;grid-template-columns:238px 1fr;min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:24px 16px;background:var(--navy);color:white;overflow:auto}.brand{display:flex;align-items:center;gap:12px;margin:0 7px 25px}.mark{display:grid;place-items:center;width:39px;height:39px;border-radius:12px;background:var(--lime);color:var(--navy);font-weight:950;font-size:20px}.brand strong{display:block;font-size:18px;letter-spacing:.08em}.brand small{display:block;color:#9db1b9;font-size:9px;margin-top:2px}.nav-label{margin:18px 9px 8px;color:#718b96;font-size:8px;font-weight:800;letter-spacing:.16em}.nav button{display:flex;width:100%;align-items:center;gap:10px;margin:3px 0;padding:10px 11px;border:0;border-radius:9px;background:transparent;color:#c8d4d8;text-align:left;font:inherit;font-size:10px;cursor:pointer}.nav button:hover,.nav button.active{background:#173f4d;color:white}.nav button.active{box-shadow:inset 3px 0 var(--lime)}.nav b{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#204956;color:var(--lime);font-size:9px}.offline-note{margin-top:24px;padding:12px;border:1px solid #31525e;border-radius:11px;color:#a9bcc3;font-size:9px;line-height:1.5}.offline-note strong{display:block;color:var(--lime);margin-bottom:4px}.workspace{min-width:0}.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;min-height:61px;padding:0 30px;border-bottom:1px solid var(--line);background:rgba(255,253,248,.94);backdrop-filter:blur(10px)}.topbar div span{display:block;color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.12em}.topbar div strong{display:block;margin-top:3px;font-size:11px}.print{min-height:34px;padding:0 13px;border:1px solid var(--navy);border-radius:9px;background:white;color:var(--navy);font-weight:800;cursor:pointer}.content{padding:28px 30px 50px}.page{display:none;max-width:1440px;margin:auto}.page.active{display:block}.page-title{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.eyebrow{color:var(--muted);font-size:8px;font-weight:850;letter-spacing:.15em}.page-title h1{margin:5px 0 4px;font-size:29px;letter-spacing:-.04em}.page-title p{margin:0;color:var(--muted);font-size:11px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.kpis article,.mini-card{padding:17px;border:1px solid var(--line);border-top:3px solid var(--lime);border-radius:14px;background:var(--paper)}.kpis article:nth-child(2){border-top-color:var(--cyan)}.kpis article.risk{border-top-color:var(--pink)}.kpis article.good{border-top-color:#4f9700}.kpis span,.kpis strong,.kpis small,.mini-card span,.mini-card strong,.mini-card small{display:block}.kpis span,.mini-card span{color:var(--muted);font-size:9px}.kpis strong{margin:10px 0 5px;font-size:23px}.kpis small,.mini-card small{color:var(--muted);font-size:8px}.panel{margin-bottom:14px;padding:17px;border:1px solid var(--line);border-radius:14px;background:var(--paper);box-shadow:0 5px 18px rgba(23,50,65,.035)}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}.panel-head h2{margin:4px 0 0;font-size:17px}.legend{display:flex;gap:14px;color:var(--muted);font-size:9px}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:8px;height:8px;border-radius:2px}.lime{background:var(--lime)}.pink{background:var(--pink)}.monthly-chart{display:grid;grid-template-columns:repeat(36,minmax(13px,1fr));gap:4px;align-items:end;min-width:720px;overflow:hidden}.chart-month{text-align:center}.chart-bars{height:150px;display:flex;align-items:flex-end;justify-content:center;gap:2px;border-bottom:1px solid var(--line)}.chart-bars i{display:block;width:38%;max-width:9px;border-radius:3px 3px 0 0}.revenue-bar{background:var(--lime)}.cost-bar{background:var(--pink);opacity:.82}.chart-month span{display:block;margin-top:6px;color:var(--muted);font-size:7px;white-space:nowrap}.two-cols{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.vertical-list button{display:grid;grid-template-columns:6px 1fr auto;gap:12px;align-items:center;width:100%;padding:11px 4px;border:0;border-bottom:1px solid var(--line);background:transparent;color:inherit;text-align:left;cursor:pointer}.vertical-list button:hover{background:#f8f6ee}.vertical-list i{height:35px;border-radius:3px}.vertical-list strong,.vertical-list small{display:block}.vertical-list small{margin-top:4px;color:var(--muted);font-size:8px}.vertical-list b{font-size:15px}.year-cards{display:grid;gap:8px}.year-cards div{display:grid;grid-template-columns:60px 1fr;gap:4px;padding:11px;border-radius:10px;background:#f5f5ef}.year-cards strong{font-size:16px}.year-cards small{grid-column:2;color:var(--muted);font-size:8px}.chip{display:inline-flex;align-items:center;min-height:25px;padding:4px 9px;border-radius:14px;font-size:8px;font-weight:850;white-space:nowrap}.chip.ok{background:#e8f7d9;color:#437d12}.chip.pending{background:#fff0c6;color:#8a5914}.chip.bad{background:#fde5eb;color:#a5234d}.table-panel{padding:0;overflow:hidden}.table-panel .panel-head{padding:17px 17px 0}.table-panel{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:12px 14px;border-bottom:1px solid #e7e8e3;text-align:left;vertical-align:middle}th{background:#f3edde;color:#687980;font-size:8px;text-transform:uppercase;letter-spacing:.06em}td{font-size:10px}td small{display:block;margin-top:4px;color:var(--muted);font-size:8px}.positive{color:#397c12}.negative{color:#b42350}.monthly-result{display:grid;grid-template-columns:repeat(12,1fr);gap:7px}.monthly-result div{padding:9px 8px;border-radius:9px;background:#f4f4ee}.monthly-result div.up{border-top:3px solid #72bb2c}.monthly-result div.down{border-top:3px solid var(--pink)}.monthly-result span,.monthly-result strong{display:block}.monthly-result span{color:var(--muted);font-size:7px}.monthly-result strong{margin-top:5px;font-size:9px}.mini-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}.mini-card strong{margin:7px 0 3px;font-size:15px}.gantt{position:relative;width:100%;height:22px;border-radius:7px;background:repeating-linear-gradient(90deg,#f0f1ec 0,#f0f1ec calc(8.333% - 1px),#dfe3de calc(8.333% - 1px),#dfe3de 8.333%);overflow:hidden}.gantt i{position:absolute;top:6px;height:10px;border-radius:6px;background:linear-gradient(90deg,var(--navy2),var(--cyan))}.callout{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px;border-radius:14px;background:var(--navy);color:white}.callout span{color:#b7c7cd;font-size:10px}.method-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:18px;align-items:center;padding:22px;background:linear-gradient(135deg,#0b303f,#123e4c);color:white}.method-flow div{display:grid;grid-template-columns:34px 1fr;gap:2px 10px;align-items:center}.method-flow b{grid-row:1/3;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--lime);color:var(--navy)}.method-flow strong,.method-flow span{display:block}.method-flow span{color:#b7c7cd;font-size:9px}.method-flow>i{color:var(--lime);font-size:20px}.vertical-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.vertical-cards article{padding:22px;border:1px solid var(--line);border-top:5px solid var(--vertical-color);border-radius:15px;background:var(--paper)}.vertical-cards article>span{color:var(--muted);font-size:9px;font-weight:850}.vertical-cards h2{margin:8px 0;font-size:23px}.vertical-cards p{min-height:38px;color:var(--muted);font-size:10px;line-height:1.5}.vertical-cards dl{display:grid;gap:8px;margin:18px 0}.vertical-cards dl div{display:flex;justify-content:space-between;padding-bottom:7px;border-bottom:1px solid var(--line)}.vertical-cards dt{color:var(--muted);font-size:9px}.vertical-cards dd{margin:0;font-weight:800;font-size:10px}.vertical-cards button{width:100%;padding:10px;border:0;border-radius:9px;background:var(--navy);color:white;font-weight:800;cursor:pointer}.dataset-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.dataset-grid article{padding:17px;border:1px solid var(--line);border-radius:13px;background:var(--paper)}.dataset-grid h3{margin:13px 0 6px}.dataset-grid p{min-height:30px;color:var(--muted);font-size:9px;line-height:1.45}.dataset-grid small{color:var(--muted);font-size:8px}.empty-state{display:flex;flex-direction:column;align-items:center;gap:5px;padding:25px;color:var(--muted)}.empty-state strong{color:var(--ink)}@media(max-width:1000px){.app{grid-template-columns:190px 1fr}.content{padding:22px 18px}.kpis{grid-template-columns:repeat(2,1fr)}.two-cols{grid-template-columns:1fr}.mini-grid{grid-template-columns:repeat(3,1fr)}.monthly-result{grid-template-columns:repeat(6,1fr)}.vertical-cards{grid-template-columns:1fr}.dataset-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.app{display:block}.sidebar{position:static;height:auto;padding:14px}.brand{margin-bottom:12px}.nav{display:flex;overflow:auto}.nav-label,.offline-note{display:none}.nav button{min-width:max-content}.topbar{padding:0 14px}.content{padding:18px 12px}.kpis{grid-template-columns:1fr}.mini-grid{grid-template-columns:1fr 1fr}.page-title{display:block}.page-title>.chip{margin-top:10px}.callout{display:block}.callout span{display:block;margin-top:8px}.method-flow{display:block}.method-flow>i{display:block;margin:10px;text-align:center}.dataset-grid{grid-template-columns:1fr}}@media print{.app{display:block}.sidebar,.topbar{display:none}.content{padding:0}.page{display:block!important;page-break-after:always}.panel{box-shadow:none}.monthly-chart{min-width:0}}
</style></head><body><div class="app"><aside class="sidebar"><div class="brand"><div class="mark">Y1</div><div><strong>YOL1</strong><small>Financial Planning</small></div></div><div class="nav"><div class="nav-label">GESTIÓN</div><button class="active" data-go="dashboard"><b>01</b>Dashboard</button><button data-go="consolidated"><b>02</b>Consolidado</button><div class="nav-label">MODELOS</div><button data-go="enterprise"><b>03</b>Enterprise</button><button data-go="b2c"><b>04</b>B2C / Personas</button><button data-go="smb"><b>05</b>SMB</button><button data-go="transversal"><b>06</b>Transversal</button><button data-go="opex"><b>07</b>OPEX</button><div class="nav-label">CONTROL</div><button data-go="inputs"><b>08</b>Centro de Inputs</button><button data-go="actuals"><b>09</b>Presupuesto vs Real</button><button data-go="providers"><b>10</b>Proveedores</button><button data-go="roadmap"><b>11</b>Roadmap</button><div class="nav-label">GOBIERNO</div><button data-go="verticals"><b>12</b>Verticales</button><button data-go="products"><b>13</b>Productos</button><button data-go="imports"><b>14</b>Importaciones</button><button data-go="audit"><b>15</b>Auditoría</button></div><div class="offline-note"><strong>Presentación para Finanzas</strong>Copia autónoma, navegable y de solo lectura. No necesita internet ni instalar la aplicación.</div></aside><main class="workspace"><header class="topbar"><div><span>Presentación ejecutiva</span><strong>Datos exportados · ${esc(exportDate)} · USD</strong></div><button class="print" onclick="window.print()">Imprimir / guardar PDF</button></header><div class="content">${pages}</div></main></div><script>
const buttons=[...document.querySelectorAll('[data-go]')];const pages=[...document.querySelectorAll('[data-page]')];function openPage(id){pages.forEach(p=>p.classList.toggle('active',p.dataset.page===id));buttons.forEach(b=>b.classList.toggle('active',b.dataset.go===id&&b.closest('.nav')));if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);scrollTo(0,0)}buttons.forEach(button=>button.addEventListener('click',()=>openPage(button.dataset.go)));openPage(location.hash.slice(1)||'dashboard');
</script></body></html>`;

const output = path.resolve(process.argv[2] ?? path.join(process.cwd(), "..", "YOL1_Planning_Demo_Offline_2026-08-24.html"));
await writeFile(output, html, "utf8");
console.log(output);
