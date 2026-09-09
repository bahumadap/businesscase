import { PlanningShell } from "../../src/components/PlanningShell";
import { B2CPlanner } from "../../src/components/B2CPlanner";

export default function B2CPage() {
  return <PlanningShell active="B2C" eyebrow="VERTICAL PERSONAS" title="Modelo B2C" actionLabel="Centro de Inputs" actionHref="/inputs"><B2CPlanner /></PlanningShell>;
}
