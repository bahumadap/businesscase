import { ActualsManager } from "../../src/components/ActualsManager";
import { PlanningShell } from "../../src/components/PlanningShell";

export default function ActualsPage() {
  return <PlanningShell active="Presupuesto vs. Real" eyebrow="CONTROL DE GESTIÓN" title="Presupuesto vs. Real" actionLabel="Escenario Real" actionHref="#escenario-real"><ActualsManager /></PlanningShell>;
}
