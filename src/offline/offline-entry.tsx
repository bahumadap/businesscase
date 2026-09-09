import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import yol1Mark from "../../public/yol1-mark.svg?raw";
import { ACTUALS_SEED } from "../actuals/seed";
import { B2C_SEED } from "../b2c/seed";
import { AuditViewer } from "../components/AuditViewer";
import { ActualsManager } from "../components/ActualsManager";
import { B2CPlanner } from "../components/B2CPlanner";
import { ConsolidatedPlanner } from "../components/ConsolidatedPlanner";
import { DashboardPlanner } from "../components/DashboardPlanner";
import { DataExchangeManager } from "../components/DataExchangeManager";
import { EnterprisePlanner } from "../components/EnterprisePlanner";
import { InputsCenter } from "../components/InputsCenter";
import { OpexPlanner } from "../components/OpexPlanner";
import { PlanningShell } from "../components/PlanningShell";
import { ProductsManager } from "../components/ProductsManager";
import { ProvidersManager } from "../components/ProvidersManager";
import { RoadmapPlanner } from "../components/RoadmapPlanner";
import { SMBPlanner } from "../components/SMBPlanner";
import { TransversalPlanner } from "../components/TransversalPlanner";
import { VerticalsManager } from "../components/VerticalsManager";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import { MILESTONES_SEED } from "../milestones/seed";
import { OPEX_SEED } from "../opex/seed";
import { PROVIDERS_SEED } from "../providers/seed";
import { SMB_SEED } from "../smb/seed";
import { TRANSVERSAL_SEED } from "../transversal/seed";

declare global {
  interface Window {
    __YOL1_OFFLINE_API__?: Record<string, unknown>;
  }
}

type RouteDefinition = {
  path: string;
  active: string;
  eyebrow: string;
  title: string;
  actionLabel?: string;
  actionHref?: string;
  content: () => ReactNode;
};

const routes: Record<string, RouteDefinition> = {
  dashboard: { path: "/", active: "Dashboard", eyebrow: "YOL1 CONSOLIDADO", title: "Executive Dashboard", actionLabel: "Modelo conectado", content: () => <DashboardPlanner /> },
  consolidated: { path: "/consolidated", active: "Consolidado", eyebrow: "YOL1 CONSOLIDADO", title: "Flujo de caja consolidado", actionLabel: "Editar inputs", actionHref: "/inputs", content: () => <ConsolidatedPlanner /> },
  enterprise: { path: "/enterprise", active: "Enterprise", eyebrow: "VERTICAL ENTERPRISE", title: "Modelo Enterprise", actionLabel: "Centro de Inputs", actionHref: "/inputs", content: () => <EnterprisePlanner /> },
  b2c: { path: "/b2c", active: "B2C", eyebrow: "VERTICAL PERSONAS", title: "Modelo B2C", actionLabel: "Centro de Inputs", actionHref: "/inputs", content: () => <B2CPlanner /> },
  smb: { path: "/smb", active: "SMB", eyebrow: "VERTICAL PYME", title: "Modelo SMB", actionLabel: "Centro de Inputs", actionHref: "/inputs", content: () => <SMBPlanner /> },
  transversal: { path: "/transversal", active: "Transversal", eyebrow: "NEGOCIOS TRANSVERSALES", title: "Economía transversal YOL1", actionLabel: "Centro de Inputs", actionHref: "/inputs", content: () => <TransversalPlanner /> },
  opex: { path: "/opex", active: "OPEX", eyebrow: "YOL1 CORPORATIVO", title: "OPEX", actionLabel: "Centro de Inputs", actionHref: "/inputs", content: () => <OpexPlanner /> },
  inputs: { path: "/inputs", active: "Centro de Inputs", eyebrow: "MODELO CENTRALIZADO", title: "Centro de Inputs", actionLabel: "Guardar desde cada módulo", content: () => <InputsCenter /> },
  actuals: { path: "/actuals", active: "Presupuesto vs. Real", eyebrow: "CONTROL DE GESTIÓN", title: "Presupuesto vs. Real", actionLabel: "Escenario Real", actionHref: "#escenario-real", content: () => <ActualsManager /> },
  providers: { path: "/providers", active: "Proveedores", eyebrow: "FUENTE CENTRAL DE COSTOS", title: "Proveedores y condiciones", actionLabel: "Mantenedor central", content: () => <ProvidersManager /> },
  roadmap: { path: "/roadmap", active: "Roadmap", eyebrow: "PLANIFICACIÓN", title: "Roadmap", actionLabel: "", content: () => <RoadmapPlanner /> },
  imports: { path: "/imports", active: "Importaciones", eyebrow: "GESTIÓN DE DATOS", title: "Descarga y carga de registros", actionLabel: "Intercambio de datos", content: () => <DataExchangeManager /> },
  audit: { path: "/audit", active: "Auditoría", eyebrow: "GOBIERNO DE DATOS", title: "Auditoría y trazabilidad", actionLabel: "Log consolidado", content: () => <AuditViewer /> },
  verticals: { path: "/verticals", active: "Verticales", eyebrow: "MODELO ORGANIZACIONAL", title: "Verticales", actionLabel: "", content: () => <VerticalsManager /> },
  products: { path: "/products", active: "Productos", eyebrow: "ECONOMICS", title: "Productos", actionLabel: "", content: () => <ProductsManager /> },
};

const routeByPath = new Map(Object.entries(routes).map(([key, route]) => [route.path, key]));
const fallbackApi: Record<string, unknown> = {
  enterprise: { plan: ENTERPRISE_SEED },
  b2c: { plan: B2C_SEED },
  smb: { plan: SMB_SEED },
  opex: { plan: OPEX_SEED },
  providers: { plan: PROVIDERS_SEED },
  transversal: { plan: TRANSVERSAL_SEED },
  actuals: { plan: ACTUALS_SEED },
  milestones: { plan: MILESTONES_SEED },
  audit: { entries: [] },
};
const offlineApi = new Map(Object.entries({ ...fallbackApi, ...(window.__YOL1_OFFLINE_API__ ?? {}) }));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const source = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(source, "https://presentacion.yol1.local");
  if (!url.pathname.startsWith("/api/")) return jsonResponse({ error: "Recurso no disponible en la presentación" }, 404);
  const key = url.pathname.slice(5);
  const method = (init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method) ?? "GET").toUpperCase();
  if (method === "GET") return jsonResponse(offlineApi.get(key) ?? { plan: null });
  if (method === "PUT") {
    try {
      const plan = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      offlineApi.set(key, { plan });
      return jsonResponse({ plan });
    } catch {
      return jsonResponse({ error: "Datos inválidos" }, 400);
    }
  }
  return jsonResponse({ error: "Acción no disponible" }, 405);
};

function hashRoute() {
  const key = window.location.hash.replace(/^#\/?/, "").split(/[?&]/)[0];
  return routes[key] ? key : null;
}

function OfflineApp() {
  const [routeKey, setRouteKey] = useState(() => hashRoute() ?? "dashboard");
  const route = routes[routeKey] ?? routes.dashboard;

  useEffect(() => {
    const onHashChange = () => {
      const next = hashRoute();
      if (next) setRouteKey(next);
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      const href = anchor?.getAttribute("href");
      if (!href?.startsWith("/")) return;
      const next = routeByPath.get(href.replace(/\/$/, "") || "/");
      if (!next) return;
      event.preventDefault();
      window.location.hash = next;
    };
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    document.title = `${route.title} · YOL1 Financial Planning`;
    document.querySelector<HTMLImageElement>(".brand img")?.setAttribute("src", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(yol1Mark)}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);

  return <PlanningShell active={route.active} eyebrow={route.eyebrow} title={route.title} actionLabel={route.actionLabel} actionHref={route.actionHref}>{route.content()}</PlanningShell>;
}

document.body.classList.add("offline-presentation");
createRoot(document.getElementById("root")!).render(<OfflineApp />);
