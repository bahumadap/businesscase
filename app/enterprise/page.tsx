import { PlanningShell } from "../../src/components/PlanningShell";
import { EnterprisePlanner } from "../../src/components/EnterprisePlanner";

export default function EnterprisePage() {
  return <PlanningShell active="Enterprise" eyebrow="VERTICAL ENTERPRISE" title="Modelo Enterprise" actionLabel="Centro de Inputs" actionHref="/inputs"><EnterprisePlanner /></PlanningShell>;
}
