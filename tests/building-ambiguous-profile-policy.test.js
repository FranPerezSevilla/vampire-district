import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_VISUAL_PROFILES,
  classifyBuildingVisualProfile,
  resolveBuildingVisualProfile
} from "../phaser/src/rendering/BuildingPresentation.js";

test("untagged buildings do not inherit a family from their district name", () => {
  assert.equal(
    classifyBuildingVisualProfile({
      id: "block-17",
      sign: "BLOCK 17",
      districtId: "warehouse-district"
    }, "generic"),
    "default"
  );
  assert.equal(
    classifyBuildingVisualProfile({
      id: "lot-9",
      sign: "LOT 9",
      districtId: "medical-quarter"
    }, "generic"),
    "default"
  );
});

test("profile inference remains whole-word and building-local", () => {
  assert.equal(
    classifyBuildingVisualProfile({ id: "warehouseman-house", sign: "WAREHOUSEMAN HOUSE" }, "generic"),
    "default"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "hospitality-house", sign: "HOSPITALITY HOUSE" }, "generic"),
    "default"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "warehouse-4", sign: "WAREHOUSE 4" }, "generic"),
    "warehouse"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "clinic-4", sign: "CLINIC 4" }, "generic"),
    "medical"
  );
  assert.equal(
    classifyBuildingVisualProfile({ id: "office-4", sign: "OFFICE 4" }, "generic"),
    "commercial"
  );
});

test("explicit profile remains authoritative over conservative inference", () => {
  const profile = resolveBuildingVisualProfile({
    id: "block-17",
    sign: "BLOCK 17",
    districtId: "warehouse-district",
    presentation: { profile: "residential" }
  }, "generic");
  assert.equal(profile.id, "residential");
});

test("default profile stays quiet and non-monumental for genuinely ambiguous blocks", () => {
  const profile = BUILDING_VISUAL_PROFILES.default;
  assert.deepEqual(profile.signatureProps, []);
  assert.equal(profile.serviceStrip, null);
  assert.equal(profile.serviceLight, false);
  assert.equal(profile.annex, null);
  assert.equal(profile.showLabel, false);
  assert.equal(profile.layoutCandidates.includes("t-shape"), false);
  assert.ok(
    profile.layoutCandidates.filter(layout => layout === "rectangle").length >= 5,
    "ambiguous layout weighting should strongly prefer a simple neutral rectangle"
  );
});
