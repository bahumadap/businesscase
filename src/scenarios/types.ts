export type ScenarioOverride = {
  id: string;
  name: string;
  status: "Base" | "Borrador" | "Publicado";
  revenueMultiplier: number;
  directCostMultiplier: number;
  payoutsGoLiveMonth: string;
};

export type ScenariosPlan = { version: number; scenarios: ScenarioOverride[]; updatedAt: string };
