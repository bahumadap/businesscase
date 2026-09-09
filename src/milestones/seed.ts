import { B2C_SEED } from "../b2c/seed";
import { buildProductCatalog, reconcileMilestonesWithCatalog } from "../catalog/products";
import { ENTERPRISE_SEED } from "../enterprise/seed";
import { SMB_SEED } from "../smb/seed";
import type { Milestone, MilestonesPlan } from "./types";

const importedMilestones: Milestone[] = [
  { id: "gl-xtransfer-pe", name: "Go Live XTransfer Perú", area: "Enterprise", country: "Perú", client: "XTransfer", product: "Cuentas Virtuales + FX", owner: "Por asignar", startDate: "2026-09-01", endDate: "2026-09-01", targetDate: "2026-09-01", status: "Planificado", progress: 0, notes: "Hito importado desde Go Live; duración por validar." },
  { id: "gl-xtransfer-cl", name: "Go Live XTransfer Chile", area: "Enterprise", country: "Chile", client: "XTransfer", product: "Cuentas Virtuales + FX", owner: "Por asignar", startDate: "2026-10-01", endDate: "2026-10-01", targetDate: "2026-10-01", status: "Planificado", progress: 0, notes: "Hito importado desde Go Live; duración por validar." },
  { id: "gl-prontopaga-payouts", name: "Go Live Payouts ProntoPaga", area: "Enterprise", country: "Chile", client: "ProntoPaga", product: "Payouts", owner: "Por asignar", startDate: "2027-02-01", endDate: "2027-02-01", targetDate: "2027-02-01", status: "Planificado", progress: 0, notes: "Hito importado desde Go Live; duración por validar." },
];

const seedCatalog = buildProductCatalog(ENTERPRISE_SEED, B2C_SEED, SMB_SEED);

export const MILESTONES_SEED: MilestonesPlan = {
  version: 2,
  milestones: reconcileMilestonesWithCatalog(importedMilestones, seedCatalog),
  updatedAt: "2026-08-24T00:00:00.000Z",
};
