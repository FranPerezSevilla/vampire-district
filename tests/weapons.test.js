import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEAPON_INVENTORY,
  WEAPON_IDS,
  WEAPON_TYPES,
  consumeWeaponAmmo,
  cycleWeaponIndex,
  hitscanCandidateMetrics,
  selectHitscanTarget,
  weaponById
} from "../phaser/src/data/weapons.js";

test("default inventory contains unarmed, pipe and pistol in wheel order", () => {
  assert.deepEqual(DEFAULT_WEAPON_INVENTORY, [
    WEAPON_IDS.UNARMED,
    WEAPON_IDS.PIPE,
    WEAPON_IDS.PISTOL
  ]);
});

test("mouse-wheel steps move one slot and wrap in both directions", () => {
  assert.equal(cycleWeaponIndex(0, 1, 3), 1);
  assert.equal(cycleWeaponIndex(1, 1, 3), 2);
  assert.equal(cycleWeaponIndex(2, 1, 3), 0);
  assert.equal(cycleWeaponIndex(0, -1, 3), 2);
  assert.equal(cycleWeaponIndex(2, 0, 3), 2);
});

test("iron pipe is a slower, longer and stronger melee weapon than unarmed", () => {
  const unarmed = weaponById(WEAPON_IDS.UNARMED);
  const pipe = weaponById(WEAPON_IDS.PIPE);
  assert.equal(unarmed.attackType, WEAPON_TYPES.MELEE);
  assert.equal(pipe.attackType, WEAPON_TYPES.MELEE);
  assert.ok(pipe.damage > unarmed.damage);
  assert.ok(pipe.range > unarmed.range);
  assert.ok(pipe.recoveryMs > unarmed.recoveryMs);
  assert.ok(pipe.soundRadius > unarmed.soundRadius);
});

test("pistol consumes finite ammunition and rejects an empty shot", () => {
  const pistol = weaponById(WEAPON_IDS.PISTOL);
  const first = consumeWeaponAmmo(pistol, pistol.ammoCapacity);
  assert.equal(first.fired, true);
  assert.equal(first.after, pistol.ammoCapacity - 1);

  const empty = consumeWeaponAmmo(pistol, 0);
  assert.equal(empty.fired, false);
  assert.equal(empty.after, 0);
});

test("hitscan chooses the closest aligned target across NPCs and props", () => {
  const pistol = weaponById(WEAPON_IDS.PISTOL);
  const origin = { x: 0, y: 0 };
  const direction = { x: 1, y: 0 };
  const candidates = [
    { id: "far-npc", kind: "npc", x: 120, y: 2, hitRadius: 7 },
    { id: "near-prop", kind: "prop", x: 70, y: 1, hitRadius: 7 },
    { id: "off-line", kind: "npc", x: 45, y: 20, hitRadius: 7 }
  ];

  const selected = selectHitscanTarget(origin, direction, candidates, pistol);
  assert.equal(selected.candidate.id, "near-prop");
});

test("hitscan rejects targets behind, outside width, beyond range or blocked", () => {
  const pistol = weaponById(WEAPON_IDS.PISTOL);
  const origin = { x: 0, y: 0 };
  const direction = { x: 1, y: 0 };

  assert.equal(hitscanCandidateMetrics(origin, direction, { x: -20, y: 0, hitRadius: 7 }, pistol).valid, false);
  assert.equal(hitscanCandidateMetrics(origin, direction, { x: 40, y: 20, hitRadius: 7 }, pistol).valid, false);
  assert.equal(hitscanCandidateMetrics(origin, direction, { x: pistol.range + 1, y: 0, hitRadius: 7 }, pistol).valid, false);

  const blocked = selectHitscanTarget(
    origin,
    direction,
    [{ id: "blocked", x: 60, y: 0, hitRadius: 7 }],
    pistol,
    { lineClear: () => false }
  );
  assert.equal(blocked, null);
});
