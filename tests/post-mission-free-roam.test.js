import test from "node:test";
import assert from "node:assert/strict";
import { CombatSystem } from "../phaser/src/combat/CombatSystem.js";
import { DrainSystem } from "../phaser/src/combat/DrainSystem.js";
import { PlayerDamageSystem } from "../phaser/src/combat/PlayerDamageSystem.js";
import { WeaponSystem } from "../phaser/src/systems/WeaponSystem.js";

function completedScene() {
  return {
    transitionSystem: { active: false },
    interactionSystem: { isOpen: false },
    feedingSystem: { isActive: () => false },
    combatSystem: { isBusy: () => false },
    playerDamageSystem: { isHitStunned: () => false },
    missionSystem: { failed: false, completed: true }
  };
}

test("successful mission completion does not disable free-roam weapons or combat", () => {
  const scene = completedScene();
  const frame = {
    worldEnabled: true,
    drainHeld: true
  };

  const combat = Object.create(CombatSystem.prototype);
  combat.scene = scene;
  assert.equal(combat.canStartAttack(frame), true);

  const weapons = Object.create(WeaponSystem.prototype);
  weapons.scene = scene;
  assert.equal(weapons.canCycle(frame), true);

  const drain = Object.create(DrainSystem.prototype);
  drain.scene = scene;
  assert.equal(drain.canStart(frame), true);

  const damage = Object.create(PlayerDamageSystem.prototype);
  damage.scene = scene;
  assert.equal(damage.canSimulate(frame), true);
});

test("mission failure still blocks post-run combat actions", () => {
  const scene = completedScene();
  scene.missionSystem.failed = true;
  const frame = {
    worldEnabled: true,
    drainHeld: true
  };

  const combat = Object.create(CombatSystem.prototype);
  combat.scene = scene;
  assert.equal(combat.canStartAttack(frame), false);

  const weapons = Object.create(WeaponSystem.prototype);
  weapons.scene = scene;
  assert.equal(weapons.canCycle(frame), false);

  const drain = Object.create(DrainSystem.prototype);
  drain.scene = scene;
  assert.equal(drain.canStart(frame), false);

  const damage = Object.create(PlayerDamageSystem.prototype);
  damage.scene = scene;
  assert.equal(damage.canSimulate(frame), false);
});
