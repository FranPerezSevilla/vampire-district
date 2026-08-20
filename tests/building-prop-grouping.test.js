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

function plan(seed = 12491) {
  return createBuildingPresentationPlan({
    id: "grouped-industrial-roof",
    sign: "WORKS",
    x: 100,
    y: 140,
    w: 340,
    h: 240,
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

function props(value) {
  return value.modules.filter(module => PROP_KINDS.has(module.kind));
}

function center(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function inside(inner, outer) {
  const epsilon = 0.001;
  return inner.x >= outer.x - epsilon
    && inner.y >= outer.y - epsilon
    && inner.x + inner.w <= outer.x + outer.w + epsilon
    && inner.y + inner.h <= outer.y + outer.h + epsilon;
}

test("hero and support props form one deterministic readable roof group", () => {
  const value = plan();
  const items = props(value);
  assert.equal(items.length, 2);
  assert.equal(items[0].kind, MODULE_KINDS.HVAC);
  assert.match(items[0].id, /:prop:0:hvac$/);
  assert.match(items[1].id, /:prop:1:/);

  assert.equal(overlaps(items[0].bounds, items[1].bounds), false, "grouped props must remain physically distinct");
  assert.ok(items.every(item => inside(item.bounds, value.visualFootprint)));

  const hero = center(items[0].bounds);
  const support = center(items[1].bounds);
  const separation = Math.hypot(hero.x - support.x, hero.y - support.y);
  const diagonal = Math.hypot(value.silhouette.bounds.w, value.silhouette.bounds.h);
  assert.ok(separation > 8, "support should not collapse onto the hero prop");
  assert.ok(
    separation < diagonal * 0.65,
    "support should remain compositionally related to the hero instead of occupying an arbitrary remote corner"
  );
});

test("same authored roof and seed reproduce exactly the same prop group", () => {
  assert.deepEqual(props(plan()), props(plan()));
});
