import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  ROOF_SURFACE_KINDS,
  classifyBuildingPresentation,
  classifyBuildingVisualProfile,
  createBuildingPresentationPlan,
  resolveBuildingVisualProfile
} from "../phaser/src/rendering/BuildingPresentation.js";

function hospitalBuilding(overrides = {}) {
  return {
    id: "city-hospital",
    sign: "CITY HOSPITAL",
    x: 120,
    y: 180,
    w: 300,
    h: 210,
    color: 0x34454d,
    trim: 0x7b8b91,
    presentation: {
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 8191
    },
    ...overrides
  };
}

test("hospital words select a dedicated medical visual profile without creating a semantic archetype", () => {
  const building = hospitalBuilding();

  assert.equal(classifyBuildingPresentation(building), "generic");
  assert.equal(classifyBuildingVisualProfile(building, "generic"), "medical");

  const profile = resolveBuildingVisualProfile(building, "generic");
  assert.equal(profile.id, "medical");
  assert.equal(profile.surfaceKind, ROOF_SURFACE_KINDS.SMOOTH);
  assert.deepEqual(profile.signatureProps, [MODULE_KINDS.HVAC, MODULE_KINDS.SKYLIGHT]);
  assert.deepEqual(profile.propPool, [MODULE_KINDS.HATCH, MODULE_KINDS.VENT]);
  assert.equal(profile.annex?.kind, "raised");
  assert.equal(profile.frontage, "generic");
});

test("medical visual classification remains conservative and whole-word based", () => {
  assert.equal(
    classifyBuildingVisualProfile({ id: "north-clinic", sign: "NORTH CLINIC" }, "generic"),
    "medical"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "medical-centre", sign: "MEDICAL CENTRE" }, "generic"),
    "medical"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "grand-hospitality", sign: "GRAND HOSPITALITY" }, "generic"),
    "default",
    "hospitality must not be misclassified as hospital"
  );
  assert.equal(
    resolveBuildingVisualProfile({ presentation: { profile: "hospital" } }, "generic").id,
    "medical",
    "explicit hospital alias should resolve through the same visual profile"
  );
});

test("medical profile assembles a cool institutional roof with physical annex and signature plant", () => {
  const building = hospitalBuilding();
  const authored = {
    x: building.x,
    y: building.y,
    w: building.w,
    h: building.h
  };
  const plan = createBuildingPresentationPlan(building);

  const foundation = plan.modules.find(module => module.kind === MODULE_KINDS.FOUNDATION);
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const annex = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_ANNEX);
  const hvac = plan.modules.find(module => module.kind === MODULE_KINDS.HVAC);
  const skylight = plan.modules.find(module => module.kind === MODULE_KINDS.SKYLIGHT);

  assert.ok(foundation);
  assert.ok(roof);
  assert.equal(roof.profileId, "medical");
  assert.equal(roof.surfaceKind, ROOF_SURFACE_KINDS.SMOOTH);
  assert.ok(annex, "large medical block should receive the raised clinical/service annex hierarchy");
  assert.equal(annex.variant, "raised");
  assert.ok(hvac, "medical profile should prioritize clean mechanical plant");
  assert.ok(skylight, "medical profile should prioritize controlled daylight/skylight structure");
  assert.deepEqual(
    foundation.bounds,
    authored,
    "visual medical classification must preserve authored building bounds"
  );
});
