import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILDING_SIDEWALK_CLEARANCE_POLICY_ID,
  fitBuildingToSidewalks,
  rectsOverlapWithMargin
} from "../phaser/src/data/BuildingSidewalkClearance.js";

test("NEON footprint is pulled clear of touching bottom and right sidewalks", () => {
  const building = { id: "club", sign: "NEON", x: 100, y: 200, w: 300, h: 190 };
  const surfaces = [
    { id: "club-south-walk", x: 90, y: 390, w: 330, h: 24 },
    { id: "club-east-walk", x: 400, y: 180, w: 24, h: 230 }
  ];

  const adjusted = fitBuildingToSidewalks(building, surfaces, { clearance: 4 });

  assert.notEqual(adjusted, building);
  assert.equal(adjusted.clearancePolicy, BUILDING_SIDEWALK_CLEARANCE_POLICY_ID);
  assert.deepEqual(
    { x: adjusted.x, y: adjusted.y, w: adjusted.w, h: adjusted.h },
    { x: 100, y: 200, w: 296, h: 186 }
  );
  assert.equal(surfaces.some(surface => rectsOverlapWithMargin(adjusted, surface, 3)), false);
  assert.deepEqual(building, { id: "club", sign: "NEON", x: 100, y: 200, w: 300, h: 190 });
});

test("unrelated buildings keep their original footprint and reference", () => {
  const building = { id: "office", sign: "OFFICE", x: 100, y: 200, w: 300, h: 190 };
  assert.equal(fitBuildingToSidewalks(building, [{ x: 100, y: 390, w: 300, h: 20 }]), building);
});

test("NEON still receives a conservative inset when sidewalk data is not resident", () => {
  const building = { id: "club", sign: "NEON", x: 100, y: 200, w: 300, h: 190 };
  const adjusted = fitBuildingToSidewalks(building, []);
  assert.deepEqual(
    { x: adjusted.x, y: adjusted.y, w: adjusted.w, h: adjusted.h },
    { x: 100, y: 200, w: 294, h: 184 }
  );
});
