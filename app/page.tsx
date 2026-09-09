import { DashboardPlanner } from "../src/components/DashboardPlanner";
import { PlanningShell } from "../src/components/PlanningShell";

export default function DashboardPage() {
  return <PlanningShell active="Dashboard" eyebrow="YOL1 CONSOLIDADO" title="Executive Dashboard" actionLabel="Modelo conectado"><DashboardPlanner /></PlanningShell>;
}
