export type MilestoneStatus = "Planificado" | "En curso" | "Completado" | "Atrasado";
export type Milestone = { id: string; name: string; area: "Enterprise" | "B2C" | "SMB" | "Corporativo"; country: string; client: string; productKey?: string; product: string; owner: string; startDate: string; endDate: string; targetDate: string; status: MilestoneStatus; progress: number; notes: string };
export type MilestonesPlan = { version: number; milestones: Milestone[]; updatedAt: string };
