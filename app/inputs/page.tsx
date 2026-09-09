import { InputsCenter } from "../../src/components/InputsCenter";
import { PlanningShell } from "../../src/components/PlanningShell";

export default function InputsPage() {
  return <PlanningShell active="Centro de Inputs" eyebrow="MODELO CENTRALIZADO" title="Centro de Inputs" actionLabel="Guardar desde cada módulo"><InputsCenter /></PlanningShell>;
}
