import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  createBuildingPresentationPlan
} from "../phaser/src/rendering/BuildingPresentation.js";

const PROP_KINDS = new Set([
  MODULE_KINDS.SKYLIGHT,
  MODULE_KINDS.HVAC,
  MODULE_KINDS.VENT,
  MODULE_KINDS.HATCH,
  MODULE_KINDS.ANTENNA,
  MODULE_KINDS.SATELLITE_DISH
]);

const FIXTURES = [
  { id: "mixed-residential", sign: "RIVER FLATS", profile: "residential", archetype: "generic", layoutId: "l-shape", seed: 19101 },
  { id: "mixed-commercial", sign: "NIGHT MARKET", profile: "commercial", archetype: "generic", layoutId: "stepped", seed: 19103 },
  { id: "mixed-warehouse", sign: "WAREHOUSE", profile: "warehouse", archetype: "generic", layoutId: "rectangle", seed: 19107 },
  { id: "mixed-industrial", sign: "WORKS", profile: "industrial", archetype: "generic", layoutId: "rectangle", seed: 19109 },
  { id: "mixed-medical", sign: "CITY HOSPITAL", profile: "medical", archetype: "generic", layoutId: "l-shape", seed: 19111 },
  { id: "mixed-police", sign: "POLICE", profile: "police", archetype: "police", layoutId: "rectangle", seed: 19113 },
  { id: "mixed-club", sign: "NEON CLUB", profile: "club", archetype: "club", layoutId: "irregular", seed: 19117 },
  { id: "mixed-church", sign: "CHURCH", profile: "church", archetype: "church", layoutId: "cross", seed: 19121 }
];

function plan(fixture) {
  return createBuildingPresentationPlan({
    id: fixture.id,
    sign: fixture.sign,
    x: 100,
    y: 140,
    w: 300,
    h: 220,
    color: 0x34343a,
    trim: 0x6f6c72,
    presentation: {
      profile: fixture.profile,
      archetype: fixture.archetype,
      layoutId: fixture.layoutId,
      detailLevel: "standard",
      seed: fixture.seed
    }
  });
}

function visualSignature(value) {
  const roof = value.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const frontage = value.modules.find(module => module.kind === MODULE_KINDS.FRONTAGE);
  const service = value.modules.find(module => module.kind === MODULE_KINDS.SERVICE_STRIP);
  const annex = value.modules.find(module => module.kind === MODULE_KINDS.ROOF_ANNEX);
  const props = value.modules
    .filter(module => PROP_KINDS.has(module.kind))
    .map(module => module.kind)
    .join(",");
  const identity = value.modules
    .filter(module => [MODULE_KINDS.ACCENT_STRIP, MODULE_KINDS.ROOF_RIDGE, MODULE_KINDS.CROSS_MARKER].includes(module.kind))
    .map(module => `${module.kind}:${module.variant || ""}`)
    .sort()
    .join(",");

  return [
    roof?.surfaceKind || "none",
    roof?.layoutId || "none",
    frontage?.variant || "none",
    service?.variant || "none",
    annex?.variant || "none",
    props || "none",
    identity || "none"
  ].join("|");
}

test("mixed street keeps family compositions varied without relying on profile labels", () => {
  const values = FIXTURES.map(plan);
  const signatures = values.map(visualSignature);
  const counts = new Map();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) || 0) + 1);

  assert.ok(
    new Set(signatures).size >= 7,
    "a representative eight-building street should expose at least seven distinct visual compositions"
  );
  assert.ok(
    [...counts.values()].every(count => count <= 2),
    "no visual composition may repeat across more than two representative buildings"
  );

  const surfaceKinds = new Set(values.map(value => (
    value.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS)?.surfaceKind
  )));
  assert.ok(surfaceKinds.size >= 5, "mixed street should retain broad material diversity");
});

test("mixed-street composition audit is deterministic", () => {
  assert.deepEqual(FIXTURES.map(fixture => visualSignature(plan(fixture))), FIXTURES.map(fixture => visualSignature(plan(fixture))));
});
