import test from "node:test";
import assert from "node:assert/strict";
import { UNARMED_ATTACK } from "../phaser/src/data/combat.js";
import { applyPropDamage, createDamageableProp, propInsideMeleeArc } from "../phaser/src/data/props.js";

const origin = { x: 0, y: 0 };
const aimRight = { x: 1, y: 0 };

function streetlight(overrides = {}) {
  return createDamageableProp({
    id: "lamp",
    name: "test streetlight",
    x: 26,
    y: 0,
    ...overrides
  });
}

test("an aimed punch can hit a streetlight inside the melee arc", () => {
  const prop = streetlight();
  assert.equal(propInsideMeleeArc(origin, aimRight, prop, UNARMED_ATTACK), true);
});

test("a punch misses streetlights behind the player or beyond expanded reach", () => {
  assert.equal(propInsideMeleeArc(origin, aimRight, streetlight({ x: -20 }), UNARMED_ATTACK), false);
  assert.equal(propInsideMeleeArc(origin, aimRight, streetlight({ x: 42 }), UNARMED_ATTACK), false);
});

test("a baseline streetlight breaks after exactly one damage point", () => {
  const prop = streetlight();
  const result = applyPropDamage(prop, 1);
  assert.equal(result.applied, true);
  assert.equal(result.broken, true);
  assert.equal(prop.durability, 0);
  assert.equal(prop.broken, true);
});

test("a broken prop ignores repeated damage", () => {
  const prop = streetlight();
  applyPropDamage(prop, 1);
  const repeated = applyPropDamage(prop, 1);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.broken, true);
  assert.equal(prop.durability, 0);
});
