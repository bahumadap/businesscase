import { PlanningShell } from "../../src/components/PlanningShell";
import { ConsolidatedPlanner } from "../../src/components/ConsolidatedPlanner";

export default function ConsolidatedPage() {
  return <PlanningShell active="Consolidado" eyebrow="YOL1 CONSOLIDADO" title="Flujo de caja consolidado" actionLabel="Editar inputs" actionHref="/inputs"><ConsolidatedPlanner /></PlanningShell>;
}
