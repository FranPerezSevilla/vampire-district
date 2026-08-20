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

const REPRESENTATIVE = [
  { id: "sparse-residential", sign: "RIVER FLATS", profile: "residential", archetype: "generic", layoutId: "rectangle", seed: 20101 },
  { id: "sparse-commercial", sign: "MARKET", profile: "commercial", archetype: "generic", layoutId: "rectangle", seed: 20103 },
  { id: "sparse-warehouse", sign: "WAREHOUSE", profile: "warehouse", archetype: "generic", layoutId: "rectangle", seed: 20107 },
  { id: "sparse-industrial", sign: "WORKS", profile: "industrial", archetype: "generic", layoutId: "rectangle", seed: 20109 },
  { id: "sparse-medical", sign: "CITY HOSPITAL", profile: "medical", archetype: "generic", layoutId: "rectangle", seed: 20111 },
  { id: "sparse-police", sign: "POLICE", profile: "police", archetype: "police", layoutId: "rectangle", seed: 20113 },
  { id: "sparse-club", sign: "NEON CLUB", profile: "club", archetype: "club", layoutId: "irregular", seed: 20117 },
  { id: "sparse-church", sign: "CHURCH", profile: "church", archetype: "church", layoutId: "cross", seed: 20119 }
];

function plan(fixture) {
  return createBuildingPresentationPlan({
    id: fixture.id,
    sign: fixture.sign,
    x: 100,
    y: 140,
    w: 340,
    h: 240,
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

function area(bounds) {
  return Math.max(0, Number(bounds?.w) || 0) * Math.max(0, Number(bounds?.h) || 0);
}

function props(value) {
  return value.modules.filter(module => PROP_KINDS.has(module.kind));
}

function compositionVolumes(value) {
  return value.modules.filter(module => (
    PROP_KINDS.has(module.kind)
      || [MODULE_KINDS.ROOF_ANNEX, MODULE_KINDS.FRONTAGE].includes(module.kind)
  ));
}

test("standard gameplay roofs keep hero/support density and occupied roof area restrained", () => {
  for (const fixture of REPRESENTATIVE) {
    const value = plan(fixture);
    const roof = value.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
    assert.ok(roof?.bounds, `${fixture.profile}: roof mass is required`);

    const rooftopProps = props(value);
    assert.ok(
      rooftopProps.length <= 2,
      `${fixture.profile}: standard detail must never exceed hero plus one support prop`
    );

    const propCoverage = rooftopProps.reduce((sum, module) => sum + area(module.bounds), 0) / area(roof.bounds);
    assert.ok(
      propCoverage <= 0.12,
      `${fixture.profile}: rooftop props should occupy at most 12% of the readable roof envelope`
    );

    const compositionCoverage = compositionVolumes(value)
      .reduce((sum, module) => sum + area(module.bounds), 0) / area(roof.bounds);
    assert.ok(
      compositionCoverage <= 0.25,
      `${fixture.profile}: frontage, annex and props together must leave most of the roof visually quiet`
    );
  }
});

test("sparse-readability limits are deterministic across the representative set", () => {
  const first = REPRESENTATIVE.map(fixture => props(plan(fixture)));
  const second = REPRESENTATIVE.map(fixture => props(plan(fixture)));
  assert.deepEqual(first, second);
});
