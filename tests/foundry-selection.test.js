import test from "node:test";
import assert from "node:assert/strict";

import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { SELECTED_FOUNDRY_SEED, selectedFoundryCandidate } from "../tools/city-compiler/foundry-selection.js";
import { scoreCityBlueprint } from "../tools/city-compiler/score.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

test("foundry-pilot-04 is the locked production candidate", () => {
  assert.equal(SELECTED_FOUNDRY_SEED, "foundry-pilot-04");

  const selected = selectedFoundryCandidate();
  const validation = validateCityBlueprint(selected);
  const baselineValidation = validateCityBlueprint(currentCityBlueprint);
  const score = scoreCityBlueprint(selected, validation);
  const baselineScore = scoreCityBlueprint(currentCityBlueprint, baselineValidation);
  const generated = item => String(item?.id || "").startsWith("foundry:");
  const roofs = Object.values(selected.runtime.roofAreas || {}).flat().filter(generated);
  const routes = selected.runtime.rooftopRoutes.filter(generated);

  assert.equal(selected.seed, SELECTED_FOUNDRY_SEED);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(score.total >= baselineScore.total);
  assert.ok(roofs.length >= 4);
  assert.ok(routes.length >= 3);
  assert.ok(selected.runtime.vehicles.some(vehicle => vehicle.id === "foundry:vehicle:utility"));
});
