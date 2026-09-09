import type { ScenariosPlan } from "./types";

export const SCENARIOS_SEED: ScenariosPlan = {
  version: 1,
  scenarios: [
    { id: "base", name: "Base", status: "Base", revenueMultiplier: 1, directCostMultiplier: 1, payoutsGoLiveMonth: "2027-02" },
    { id: "upside", name: "Upside", status: "Publicado", revenueMultiplier: 1.15, directCostMultiplier: 0.95, payoutsGoLiveMonth: "2027-01" },
    { id: "downside", name: "Downside", status: "Borrador", revenueMultiplier: 0.85, directCostMultiplier: 1.1, payoutsGoLiveMonth: "2027-04" },
  ],
  updatedAt: "2026-08-25T00:00:00.000Z",
};
