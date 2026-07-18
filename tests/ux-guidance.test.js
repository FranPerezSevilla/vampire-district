import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  WEAPON_GUIDANCE_STATES,
  aimPresentation,
  normalizeBooleanPreference,
  recoveryGuidanceState,
  weaponGuidanceState
} from "../phaser/src/data/ux-guidance.js";

function downed(type, recoverAt, overrides = {}) {
  return {
    id: `${type}-ux`,
    type,
    dead: false,
    inactive: false,
    hiddenBody: false,
    intercepted: false,
    drainVictim: false,
    combat: { state: COMBAT_STATES.DOWNED },
    ai: { recoverAt },
    ...overrides
  };
}

test("boolean accessibility preferences accept stored string values", () => {
  assert.equal(normalizeBooleanPreference("true"), true);
  assert.equal(normalizeBooleanPreference("ON"), true);
  assert.equal(normalizeBooleanPreference("0", true), false);
  assert.equal(normalizeBooleanPreference(null, true), true);
  assert.equal(normalizeBooleanPreference("unknown", false), false);
});

test("weapon guidance waits for full tutorial control and completes after one cycle", () => {
  assert.equal(
    weaponGuidanceState({ tutorialComplete: false, weaponChanges: 0 }),
    WEAPON_GUIDANCE_STATES.LOCKED
  );
  assert.equal(
    weaponGuidanceState({ tutorialComplete: true, weaponChanges: 0 }),
    WEAPON_GUIDANCE_STATES.AWAITING_CYCLE
  );
  assert.equal(
    weaponGuidanceState({ tutorialComplete: true, weaponChanges: 1 }),
    WEAPON_GUIDANCE_STATES.COMPLETE
  );
});

test("downed police expose a rounded recovery countdown and urgent state", () => {
  const cop = downed(NPC_TYPES.POLICE, 19_000);
  const normal = recoveryGuidanceState(cop, 1_100);
  assert.equal(normal.visible, true);
  assert.equal(normal.seconds, 18);
  assert.equal(normal.label, "POLICE RISES 18s");
  assert.equal(normal.urgent, false);

  const urgent = recoveryGuidanceState(cop, 15_001);
  assert.equal(urgent.visible, true);
  assert.equal(urgent.seconds, 4);
  assert.equal(urgent.urgent, true);
});

test("hunter recovery uses a distinct label while civilians never show a timer", () => {
  const hunter = recoveryGuidanceState(downed(NPC_TYPES.HUNTER, 25_000), 1_000);
  assert.equal(hunter.label, "HUNTER RISES 24s");

  const civilian = recoveryGuidanceState(downed(NPC_TYPES.CIVILIAN, Number.POSITIVE_INFINITY), 1_000);
  assert.equal(civilian.visible, false);
  assert.equal(civilian.label, "");
});

test("draining, death and leaving the downed state hide recovery guidance", () => {
  assert.equal(
    recoveryGuidanceState(downed(NPC_TYPES.POLICE, 10_000, { drainVictim: true }), 1_000).visible,
    false
  );
  assert.equal(
    recoveryGuidanceState(downed(NPC_TYPES.POLICE, 10_000, { dead: true }), 1_000).visible,
    false
  );
  assert.equal(
    recoveryGuidanceState(downed(NPC_TYPES.POLICE, 10_000, {
      combat: { state: COMBAT_STATES.STAGGERED }
    }), 1_000).visible,
    false
  );
});

test("high-contrast aim adds a thick outline, white core and larger crosshair", () => {
  const normal = aimPresentation(false);
  const high = aimPresentation(true);

  assert.equal(normal.enabled, false);
  assert.equal(high.enabled, true);
  assert.ok(high.outerWidth > high.innerWidth);
  assert.ok(high.reticleRadius > normal.reticleRadius);
  assert.ok(high.crossRadius > 0);
  assert.notEqual(high.outerColor, high.innerColor);
});
