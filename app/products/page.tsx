import { PlanningShell } from "../../src/components/PlanningShell";
import { ProductsManager } from "../../src/components/ProductsManager";

export default function ProductsPage() {
  return <PlanningShell active="Productos" eyebrow="ECONOMICS" title="Productos" actionLabel=""><ProductsManager /></PlanningShell>;
}
