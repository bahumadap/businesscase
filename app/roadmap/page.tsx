import { PlanningShell } from "../../src/components/PlanningShell";
import { RoadmapPlanner } from "../../src/components/RoadmapPlanner";

export default function RoadmapPage() {
  return <PlanningShell active="Roadmap" eyebrow="PLANIFICACIÓN" title="Roadmap" actionLabel=""><RoadmapPlanner /></PlanningShell>;
}
