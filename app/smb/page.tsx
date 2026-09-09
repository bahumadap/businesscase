import { PlanningShell } from "../../src/components/PlanningShell";
import { SMBPlanner } from "../../src/components/SMBPlanner";

export default function SMBPage() {
  return <PlanningShell active="SMB" eyebrow="VERTICAL PYME" title="Modelo SMB" actionLabel="Centro de Inputs" actionHref="/inputs"><SMBPlanner /></PlanningShell>;
}
