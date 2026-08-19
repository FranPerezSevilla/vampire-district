import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILDING_PRESENTATION_KINDS,
  buildingPresentationPlan,
  buildingPresentationSeed,
  classifyBuildingPresentation
} from "../phaser/src/rendering/BuildingPresentation.js";

function building(overrides = {}) {
  return {
    id: "generic-block",
    sign: "FLATS",
    x: 100,
    y: 200,
    w: 180,
    h: 120,
    color: 0x343742,
    trim: 0x636879,
    ...overrides
  };
}

test("landmark semantics select police, club and church presentation families", () => {
  assert.equal(classifyBuildingPresentation(building({ id: "police", sign: "POLICE" })), BUILDING_PRESENTATION_KINDS.POLICE);
  assert.equal(classifyBuildingPresentation(building({ id: "club", sign: "CLUB" })), BUILDING_PRESENTATION_KINDS.CLUB);
  assert.equal(classifyBuildingPresentation(building({ id: "church", sign: "CHURCH" })), BUILDING_PRESENTATION_KINDS.CHURCH);
  assert.equal(classifyBuildingPresentation(building({ id: "cathedral", sign: "CATHEDRAL" })), BUILDING_PRESENTATION_KINDS.CHURCH);
  assert.equal(classifyBuildingPresentation(building()), BUILDING_PRESENTATION_KINDS.GENERIC);
});

test("building plans are deterministic for one authored building", () => {
  const source = building({ id: "marketBlock", sign: "MARKET" });
  assert.equal(buildingPresentationSeed(source), buildingPresentationSeed(source));
  assert.deepEqual(buildingPresentationPlan(source), buildingPresentationPlan(source));
});

test("presentation never changes the authored collision footprint", () => {
  const source = building({ x: 44, y: 77, w: 221, h: 143 });
  const plan = buildingPresentationPlan(source);
  assert.deepEqual(plan.footprint, { x: 44, y: 77, w: 221, h: 143 });
  assert.ok(plan.roof.x >= source.x);
  assert.ok(plan.roof.y >= source.y);
  assert.ok(plan.roof.x + plan.roof.w <= source.x + source.w);
  assert.ok(plan.roof.y + plan.roof.h <= source.y + source.h);
});

test("all generic rooftop props stay inside the inset roof", () => {
  for (let index = 0; index < 20; index++) {
    const plan = buildingPresentationPlan(building({
      id: `block-${index}`,
      x: 20 + index * 3,
      y: 60 + index * 5,
      w: 110 + index * 7,
      h: 80 + index * 4
    }));
    for (const prop of plan.props) {
      assert.ok(prop.x >= plan.roof.x);
      assert.ok(prop.y >= plan.roof.y);
      assert.ok(prop.x + prop.w <= plan.roof.x + plan.roof.w + 1e-9);
      assert.ok(prop.y + prop.h <= plan.roof.y + plan.roof.h + 1e-9);
    }
  }
});

test("generic blocks gain stable rooftop variety rather than one repeated template", () => {
  const signatures = new Set(
    Array.from({ length: 16 }, (_, index) => {
      const plan = buildingPresentationPlan(building({ id: `city-block-${index}` }));
      return JSON.stringify(plan.props.map(prop => [prop.kind, Math.round(prop.x), Math.round(prop.y)]));
    })
  );
  assert.ok(signatures.size >= 8);
});

test("landmark families retain distinct visual plans without special collision geometry", () => {
  const police = buildingPresentationPlan(building({ id: "police", sign: "POLICE", w: 368, h: 228 }));
  const club = buildingPresentationPlan(building({ id: "club", sign: "CLUB", w: 208, h: 98 }));
  const church = buildingPresentationPlan(building({ id: "church", sign: "CHURCH", w: 208, h: 148 }));

  assert.equal(police.kind, BUILDING_PRESENTATION_KINDS.POLICE);
  assert.ok(police.props.some(prop => prop.kind === "antenna"));
  assert.equal(club.kind, BUILDING_PRESENTATION_KINDS.CLUB);
  assert.ok(club.props.some(prop => prop.kind === "club-skylight"));
  assert.equal(church.kind, BUILDING_PRESENTATION_KINDS.CHURCH);
  assert.equal(church.props.length, 0);
  assert.ok(["horizontal", "vertical"].includes(church.ridgeOrientation));
});
