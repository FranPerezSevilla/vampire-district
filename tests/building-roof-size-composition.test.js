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

function industrialPlan({ id, w, h, seed }) {
  return createBuildingPresentationPlan({
    id,
    sign: "WORKS",
    x: 100,
    y: 140,
    w,
    h,
    color: 0x393231,
    trim: 0x70645e,
    presentation: {
      profile: "industrial",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed
    }
  });
}

function props(plan) {
  return plan.modules.filter(module => PROP_KINDS.has(module.kind));
}

function overlaps(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

test("small standard roofs stay deliberately sparse while large roofs earn hero plus support", () => {
  const small = industrialPlan({ id: "small-roof-rule", w: 180, h: 130, seed: 18101 });
  const large = industrialPlan({ id: "large-roof-rule", w: 340, h: 240, seed: 18101 });
  const smallProps = props(small);
  const largeProps = props(large);

  assert.ok(180 * 130 < 70000);
  assert.ok(340 * 240 >= 70000);
  assert.ok(
    smallProps.length <= 1,
    "a small standard roof must never grow a hero-plus-support cluster"
  );
  assert.equal(
    largeProps.length,
    2,
    "a large standard industrial roof should use exactly hero plus one support prop"
  );
  assert.equal(largeProps[0].kind, MODULE_KINDS.HVAC);
  assert.match(largeProps[0].id, /:prop:0:hvac$/);
  assert.match(largeProps[1].id, /:prop:1:/);
  assert.equal(
    overlaps(largeProps[0].bounds, largeProps[1].bounds),
    false,
    "large-roof support must remain physically separate from its hero"
  );
});

test("roof-size composition remains deterministic for the same authored footprint", () => {
  const smallArgs = { id: "small-roof-deterministic", w: 180, h: 130, seed: 18107 };
  const largeArgs = { id: "large-roof-deterministic", w: 340, h: 240, seed: 18109 };

  assert.deepEqual(props(industrialPlan(smallArgs)), props(industrialPlan(smallArgs)));
  assert.deepEqual(props(industrialPlan(largeArgs)), props(industrialPlan(largeArgs)));
});
