import test from "node:test";
import assert from "node:assert/strict";
import { DrainSystem } from "../phaser/src/combat/DrainSystem.js";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import {
  DRAIN_KINDS,
  DRAIN_RULES,
  evaluateDrainCandidate
} from "../phaser/src/data/drain.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";

function downedThug(overrides = {}) {
  return {
    id: "rooftop_thug",
    type: NPC_TYPES.THUG,
    x: 24,
    y: 0,
    layer: 2,
    dead: false,
    inactive: false,
    hiddenBody: false,
    intercepted: false,
    missionInformant: false,
    combat: { state: COMBAT_STATES.DOWNED },
    ...overrides
  };
}

test("DrainSystem queries a finite acquisition radius and finds the downed rooftop thug", () => {
  const thug = downedThug();
  let queriedRadius = null;
  const system = Object.create(DrainSystem.prototype);
  system.scene = {
    player: { x: 0, y: 0 },
    currentLayer: 2,
    tutorialDirector: { state: "drain-thug" },
    combatSystem: { aimDirection: { x: 1, y: 0 } },
    npcSystem: {
      npcs: [thug],
      queryRadius(_x, _y, radius) {
        queriedRadius = radius;
        return [thug];
      },
      lineClear() {
        return true;
      }
    }
  };

  const candidate = system.findCandidate();

  assert.equal(queriedRadius, DRAIN_RULES.range + DRAIN_RULES.acquisitionPadding);
  assert.ok(Number.isFinite(queriedRadius));
  assert.equal(candidate?.npc, thug);
  assert.equal(candidate?.kind, DRAIN_KINDS.DOWNED);
});

test("downed bodies have forgiving aim assistance without relaxing standing drains", () => {
  const angle = 1.18;
  const target = downedThug({
    x: Math.cos(angle) * 24,
    y: Math.sin(angle) * 24
  });
  const player = { x: 0, y: 0, layer: 2 };
  const aim = { x: 1, y: 0 };

  const downed = evaluateDrainCandidate(player, aim, target, { currentLayer: 2 });
  assert.equal(downed.eligible, true);
  assert.equal(downed.kind, DRAIN_KINDS.DOWNED);

  const standing = evaluateDrainCandidate(player, aim, {
    ...target,
    combat: { state: COMBAT_STATES.ACTIVE },
    dirX: 1,
    dirY: 0
  }, { currentLayer: 2 });
  assert.equal(standing.eligible, false);
  assert.equal(standing.reason, "not-aimed");
});

test("the tutorial does not expose the rooftop thug as drainable while standing", () => {
  const thug = downedThug({ combat: { state: COMBAT_STATES.ACTIVE } });
  const system = Object.create(DrainSystem.prototype);
  system.scene = {
    player: { x: 0, y: 0 },
    currentLayer: 2,
    tutorialDirector: { state: "drain-thug" },
    combatSystem: { aimDirection: { x: 1, y: 0 } },
    npcSystem: {
      npcs: [thug],
      queryRadius() {
        return [thug];
      },
      lineClear() {
        return true;
      }
    }
  };

  assert.equal(system.findCandidate(), null);
});
