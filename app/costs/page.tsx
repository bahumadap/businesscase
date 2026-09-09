import { PlanningShell } from "../../src/components/PlanningShell";
import { CostsManager } from "../../src/components/CostsManager";

export default function CostsPage() {
  return <PlanningShell active="Costos" eyebrow="MAPA DE COSTOS" title="Costos" actionLabel=""><CostsManager /></PlanningShell>;
}
