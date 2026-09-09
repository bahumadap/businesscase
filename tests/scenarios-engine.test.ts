import assert from "node:assert/strict";
import test from "node:test";
import { B2C_SEED } from "../src/b2c/seed";
import { ENTERPRISE_SEED } from "../src/enterprise/seed";
import { OPEX_SEED } from "../src/opex/seed";
import { applyProviderConditionsToEnterprise } from "../src/providers/engine";
import { PROVIDERS_SEED } from "../src/providers/seed";
import { calculateScenarioForecast } from "../src/scenarios/engine";
import { SCENARIOS_SEED } from "../src/scenarios/seed";
import { SMB_SEED } from "../src/smb/seed";
import { TRANSVERSAL_SEED } from "../src/transversal/seed";

test("scenario forecast applies revenue and direct cost overrides", () => {
  const enterprise = applyProviderConditionsToEnterprise(ENTERPRISE_SEED, PROVIDERS_SEED);
  const base = calculateScenarioForecast(enterprise, B2C_SEED, SMB_SEED, OPEX_SEED, TRANSVERSAL_SEED, SCENARIOS_SEED.scenarios[0]);
  const upside = calculateScenarioForecast(enterprise, B2C_SEED, SMB_SEED, OPEX_SEED, TRANSVERSAL_SEED, SCENARIOS_SEED.scenarios[1]);
  assert(upside.totals.revenue > base.totals.revenue);
  assert(upside.totals.directCosts < base.totals.directCosts);
  assert.equal(upside.months.length, 36);
});

test("scenario payout Go Live changes the forecast without mutating the base plan", () => {
  const enterprise = applyProviderConditionsToEnterprise(ENTERPRISE_SEED, PROVIDERS_SEED);
  const base = calculateScenarioForecast(enterprise, B2C_SEED, SMB_SEED, OPEX_SEED, TRANSVERSAL_SEED, SCENARIOS_SEED.scenarios[0]);
  const delayed = calculateScenarioForecast(enterprise, B2C_SEED, SMB_SEED, OPEX_SEED, TRANSVERSAL_SEED, { ...SCENARIOS_SEED.scenarios[0], payoutsGoLiveMonth: "2027-04" });
  assert.notEqual(delayed.totals.revenue, base.totals.revenue);
  assert.equal(enterprise.clients.find((client) => client.productId === "payouts")?.goLiveMonth, "2027-02");
});
