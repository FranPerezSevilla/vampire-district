import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_STATES, UNARMED_ATTACK } from "../phaser/src/data/combat.js";
import {
  DRAIN_KINDS,
  DRAIN_RULES,
  evaluateDrainCandidate,
  selectDrainCandidate
} from "../phaser/src/data/drain.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";

const player = { x: 0, y: 0, layer: 0 };
const aimRight = { x: 1, y: 0 };

function npc(overrides = {}) {
  return {
    id: "npc",
    type: NPC_TYPES.CIVILIAN,
    x: 20,
    y: 0,
    layer: 0,
    dirX: 1,
    dirY: 0,
    combat: { state: COMBAT_STATES.ACTIVE },
    ...overrides
  };
}

test("a downed target is drainable from any approach angle", () => {
  const target = npc({
    dirX: -1,
    combat: { state: COMBAT_STATES.DOWNED }
  });
  const result = evaluateDrainCandidate(player, aimRight, target);
  assert.equal(result.eligible, true);
  assert.equal(result.kind, DRAIN_KINDS.DOWNED);
});

test("a target downed at maximum punch range is immediately drainable", () => {
  assert.ok(DRAIN_RULES.range >= UNARMED_ATTACK.range);
  const thug = npc({
    type: NPC_TYPES.THUG,
    x: UNARMED_ATTACK.range,
    combat: { state: COMBAT_STATES.DOWNED }
  });
  const result = evaluateDrainCandidate(player, aimRight, thug);
  assert.equal(result.eligible, true);
  assert.equal(result.kind, DRAIN_KINDS.DOWNED);
});

test("an unaware standing target is drainable only from its rear arc", () => {
  const facingAway = npc({ dirX: 1, dirY: 0 });
  const rear = evaluateDrainCandidate(player, aimRight, facingAway);
  assert.equal(rear.eligible, true);
  assert.equal(rear.kind, DRAIN_KINDS.REAR);

  const facingPlayer = npc({ dirX: -1, dirY: 0 });
  const front = evaluateDrainCandidate(player, aimRight, facingPlayer);
  assert.equal(front.eligible, false);
  assert.equal(front.reason, "not-behind");
});

test("alert or attacking standing targets cannot be stealth drained", () => {
  assert.equal(evaluateDrainCandidate(player, aimRight, npc({ alarmed: true })).eligible, false);
  assert.equal(evaluateDrainCandidate(player, aimRight, npc({ chasingPlayer: true })).eligible, false);
  assert.equal(evaluateDrainCandidate(player, aimRight, npc({ enemyAttack: { phase: "windup" } })).eligible, false);
});

test("drain targeting requires range, aim alignment and clear geometry", () => {
  assert.equal(evaluateDrainCandidate(player, aimRight, npc({ x: 50 })).reason, "out-of-range");
  assert.equal(evaluateDrainCandidate(player, { x: -1, y: 0 }, npc()).reason, "not-aimed");
  assert.equal(evaluateDrainCandidate(player, aimRight, npc(), { lineClear: () => false }).reason, "blocked");
});

test("downed candidates outrank standing candidates", () => {
  const standing = npc({ id: "standing", x: 12, dirX: 1 });
  const downed = npc({ id: "downed", x: 24, combat: { state: COMBAT_STATES.DOWNED } });
  const selected = selectDrainCandidate(player, aimRight, [standing, downed]);
  assert.equal(selected.npc.id, "downed");
  assert.equal(selected.kind, DRAIN_KINDS.DOWNED);
});

test("rats remain directly drainable within range", () => {
  const rat = npc({ type: NPC_TYPES.RAT, combat: null, dirX: -1 });
  const result = evaluateDrainCandidate(player, aimRight, rat);
  assert.equal(result.eligible, true);
  assert.equal(result.kind, DRAIN_KINDS.RAT);
});
