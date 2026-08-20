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

function expand(bounds, amount) {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    w: bounds.w + amount * 2,
    h: bounds.h + amount * 2
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function props(plan) {
  return plan.modules.filter(module => PROP_KINDS.has(module.kind));
}

function makePlan({ id, sign, profile, archetype = "generic", layoutId = "rectangle", detailLevel = "standard", seed = 17011 }) {
  return createBuildingPresentationPlan({
    id,
    sign,
    x: 100,
    y: 140,
    w: 360,
    h: 260,
    color: 0x34343a,
    trim: 0x6f6c72,
    presentation: { profile, archetype, layoutId, detailLevel, seed }
  });
}

function assertClearOf(plan, reservedModules, padding, label) {
  for (const prop of props(plan)) {
    for (const reserved of reservedModules) {
      assert.equal(
        overlaps(prop.bounds, expand(reserved.bounds, padding)),
        false,
        `${label}: ${prop.kind} must stay clear of ${reserved.kind}`
      );
    }
  }
}

test("industrial and medical props preserve breathing room around service/entrance architecture", () => {
  const industrial = makePlan({
    id: "avoidance-works",
    sign: "WORKS",
    profile: "industrial",
    archetype: "generic",
    seed: 17011
  });
  const industrialReserved = industrial.modules.filter(module => [
    MODULE_KINDS.ROOF_ANNEX,
    MODULE_KINDS.SERVICE_STRIP
  ].includes(module.kind));
  assert.ok(industrialReserved.length >= 2);
  assertClearOf(industrial, industrialReserved, 5, "industrial");

  const medical = makePlan({
    id: "avoidance-hospital",
    sign: "CITY HOSPITAL",
    profile: "medical",
    archetype: "generic",
    seed: 17013
  });
  const medicalReserved = medical.modules.filter(module => [
    MODULE_KINDS.ROOF_ANNEX,
    MODULE_KINDS.FRONTAGE
  ].includes(module.kind));
  assert.ok(medicalReserved.length >= 2);
  assertClearOf(medical, medicalReserved, 5, "medical");
});

test("landmark props stay clear of local identity modules", () => {
  const church = makePlan({
    id: "avoidance-church",
    sign: "CHURCH",
    profile: "church",
    archetype: "church",
    layoutId: "cross",
    detailLevel: "rich",
    seed: 17017
  });
  const churchMarker = church.modules.find(module => module.kind === MODULE_KINDS.CROSS_MARKER);
  assert.ok(churchMarker);
  assert.ok(props(church).length >= 1, "rich large church fixture should exercise prop/identity avoidance");
  assertClearOf(church, [churchMarker], 2, "church");

  const club = makePlan({
    id: "avoidance-club",
    sign: "NEON CLUB",
    profile: "club",
    archetype: "club",
    layoutId: "irregular",
    seed: 17019
  });
  const clubIdentity = club.modules.filter(module => module.kind === MODULE_KINDS.ACCENT_STRIP);
  assert.ok(clubIdentity.length >= 1);
  assertClearOf(club, clubIdentity, 2, "club");

  const police = makePlan({
    id: "avoidance-police",
    sign: "POLICE",
    profile: "police",
    archetype: "police",
    seed: 17023
  });
  const policeIdentity = police.modules.filter(module => module.kind === MODULE_KINDS.ACCENT_STRIP);
  assert.ok(policeIdentity.length >= 1);
  assertClearOf(police, policeIdentity, 2, "police");
});
