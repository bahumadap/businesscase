import { PlanningShell } from "../../src/components/PlanningShell";
import { ScenariosManager } from "../../src/components/ScenariosManager";

export default function ScenariosPage() {
  return <PlanningShell active="Escenarios" eyebrow="WHAT-IF" title="Escenarios" actionLabel=""><ScenariosManager /></PlanningShell>;
}
