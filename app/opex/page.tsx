import { OpexPlanner } from "../../src/components/OpexPlanner";
import { PlanningShell } from "../../src/components/PlanningShell";

export default function OpexPage() {
  return <PlanningShell active="OPEX" eyebrow="YOL1 CORPORATIVO" title="OPEX" actionLabel="Centro de Inputs" actionHref="/inputs"><OpexPlanner /></PlanningShell>;
}
