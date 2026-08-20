import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  ROOF_SURFACE_KINDS,
  createBuildingPresentationPlan,
  resolveBuildingVisualProfile
} from "../phaser/src/rendering/BuildingPresentation.js";

function building(id, sign) {
  return {
    id,
    sign,
    x: 100,
    y: 140,
    w: 300,
    h: 210,
    color: 0x33343a,
    trim: 0x6b6d74,
    presentation: {
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 7031
    }
  };
}

function kinds(plan) {
  return new Set(plan.modules.map(module => module.kind));
}

test("default, residential and commercial profiles use intentionally different roof vocabularies", () => {
  const neutral = resolveBuildingVisualProfile(building("block-17", "BLOCK 17"), "generic");
  const residential = resolveBuildingVisualProfile(building("river-flats", "RIVER FLATS"), "generic");
  const commercial = resolveBuildingVisualProfile(building("north-offices", "NORTH OFFICES"), "generic");

  assert.equal(neutral.id, "default");
  assert.equal(neutral.surfaceKind, ROOF_SURFACE_KINDS.SMOOTH);
  assert.deepEqual(neutral.signatureProps, []);
  assert.equal(neutral.propPool.includes(MODULE_KINDS.HVAC), false);

  assert.equal(residential.id, "residential");
  assert.equal(residential.surfaceKind, ROOF_SURFACE_KINDS.SMOOTH);
  assert.deepEqual(residential.signatureProps, [MODULE_KINDS.HATCH]);
  assert.equal(residential.propPool.includes(MODULE_KINDS.HVAC), false);

  assert.equal(commercial.id, "commercial");
  assert.equal(commercial.surfaceKind, ROOF_SURFACE_KINDS.MEMBRANE);
  assert.deepEqual(commercial.signatureProps, [MODULE_KINDS.HVAC]);
  assert.equal(commercial.propPool.includes(MODULE_KINDS.VENT), false);
});

test("planned everyday roofs preserve the profile hierarchy instead of converging on random HVAC clutter", () => {
  const neutralPlan = createBuildingPresentationPlan(building("block-17", "BLOCK 17"));
  const residentialPlan = createBuildingPresentationPlan(building("river-flats", "RIVER FLATS"));
  const commercialPlan = createBuildingPresentationPlan(building("north-offices", "NORTH OFFICES"));

  const neutralKinds = kinds(neutralPlan);
  const residentialKinds = kinds(residentialPlan);
  const commercialKinds = kinds(commercialPlan);

  assert.equal(neutralKinds.has(MODULE_KINDS.HVAC), false, "ambiguous neutral blocks should not gain HVAC by random pool selection");
  assert.equal(residentialKinds.has(MODULE_KINDS.HATCH), true, "residential roof should keep its access-hatch signature");
  assert.equal(residentialKinds.has(MODULE_KINDS.HVAC), false, "residential roof should stay distinct from commercial plant language");
  assert.equal(commercialKinds.has(MODULE_KINDS.HVAC), true, "commercial roof should retain HVAC as its signature plant");

  const neutralFoundation = neutralPlan.modules.find(module => module.kind === MODULE_KINDS.FOUNDATION);
  const residentialFoundation = residentialPlan.modules.find(module => module.kind === MODULE_KINDS.FOUNDATION);
  const commercialFoundation = commercialPlan.modules.find(module => module.kind === MODULE_KINDS.FOUNDATION);
  for (const foundation of [neutralFoundation, residentialFoundation, commercialFoundation]) {
    assert.deepEqual(foundation.bounds, { x: 100, y: 140, w: 300, h: 210 });
  }
});
