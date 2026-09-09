import { PlanningShell } from "../../src/components/PlanningShell";
import { TransversalPlanner } from "../../src/components/TransversalPlanner";

export default function TransversalPage() {
  return <PlanningShell active="Transversal" eyebrow="NEGOCIOS TRANSVERSALES" title="Economía transversal YOL1" actionLabel="Centro de Inputs" actionHref="/inputs"><TransversalPlanner /></PlanningShell>;
}
