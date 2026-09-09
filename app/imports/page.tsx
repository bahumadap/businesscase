import { PlanningShell } from "../../src/components/PlanningShell";
import { DataExchangeManager } from "../../src/components/DataExchangeManager";

export default function ImportsPage() {
  return <PlanningShell active="Importaciones" eyebrow="GESTIÓN DE DATOS" title="Descarga y carga de registros" actionLabel="Intercambio de datos"><DataExchangeManager /></PlanningShell>;
}
