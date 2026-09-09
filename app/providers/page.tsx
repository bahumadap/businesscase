import { PlanningShell } from "../../src/components/PlanningShell";
import { ProvidersManager } from "../../src/components/ProvidersManager";

export default function ProvidersPage() {
  return <PlanningShell active="Proveedores" eyebrow="FUENTE CENTRAL DE COSTOS" title="Proveedores y condiciones" actionLabel="Mantenedor central"><ProvidersManager /></PlanningShell>;
}
