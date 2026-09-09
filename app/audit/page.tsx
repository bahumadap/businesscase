import { AuditViewer } from "../../src/components/AuditViewer";
import { PlanningShell } from "../../src/components/PlanningShell";

export default function AuditPage() {
  return <PlanningShell active="Auditoría" eyebrow="GOBIERNO DE DATOS" title="Auditoría y trazabilidad" actionLabel="Log consolidado"><AuditViewer /></PlanningShell>;
}
