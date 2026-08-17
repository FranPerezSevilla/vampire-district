from pathlib import Path

policy = '''export const VEHICLE_DESTRUCTION = Object.freeze({
  severeImpactSpeed: 92,
  explosionRadius: 112,
  playerMaxDamage: 52,
  playerMinDamage: 10,
  npcMaxDamage: 3,
  npcMinDamage: 1,
  occupantVitalityDamage: 250
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function vehicleDestructionTransition(vehicle, damage, { destructive = false } = {}) {
  const amount = Math.max(0, finite(damage));
  const before = Math.max(0, finite(vehicle?.health));
  const exploded = Boolean(vehicle?.exploded);
  const critical = Boolean(vehicle?.criticalDamage || (vehicle?.disabled && before <= 0));
  if (!vehicle || exploded || amount <= 0) {
    return { action: "none", before, after: before, critical, exploded };
  }
  if (critical) {
    return { action: "explode", before, after: 0, critical: false, exploded: true };
  }
  const after = Math.max(0, before - amount);
  if (after > 0) {
    return { action: "damage", before, after, critical: false, exploded: false };
  }
  if (destructive) {
    return { action: "explode", before, after: 0, critical: false, exploded: true };
  }
  return { action: "critical", before, after: 0, critical: true, exploded: false };
}

export function explosionDamageAtDistance(distance, {
  radius = VEHICLE_DESTRUCTION.explosionRadius,
  maxDamage = VEHICLE_DESTRUCTION.playerMaxDamage,
  minDamage = VEHICLE_DESTRUCTION.playerMinDamage
} = {}) {
  const range = Math.max(1, finite(radius, VEHICLE_DESTRUCTION.explosionRadius));
  const d = Math.max(0, finite(distance));
  if (d >= range) return 0;
  const maximum = Math.max(0, finite(maxDamage));
  const minimum = Math.max(0, Math.min(maximum, finite(minDamage)));
  const t = 1 - d / range;
  return minimum + (maximum - minimum) * t * t;
}
'''
Path('phaser/src/vehicles/VehicleDestructionPolicy.js').write_text(policy, encoding='utf-8')

path = Path('phaser/src/vehicles/VehicleSystem.js')
text = path.read_text(encoding='utf-8')
anchor = 'import { canEnterVehicle, collectVehicleInteractions, enterVehicle, exitVehicle, inspectVehicleTrunk, removeVehicleTrunkItem, storeVehicleTrunkItem, vehicleStatusLabel, vehicleTrunkLabel } from "./VehicleInteractions.js";\n'
if 'VehicleDestructionPolicy.js' not in text:
    if anchor not in text:
        raise SystemExit('VehicleSystem import anchor missing')
    text = text.replace(anchor, anchor + 'import { VEHICLE_DESTRUCTION, explosionDamageAtDistance, vehicleDestructionTransition } from "./VehicleDestructionPolicy.js";\n', 1)
old = '      transient: Boolean(definition.transient),\n      transientSequence: Number(definition.transientSequence) || 0,\n'
new = '      transient: Boolean(definition.transient),\n      transientSequence: Number(definition.transientSequence) || 0,\n      criticalDamage: Boolean(state.disabled && state.health <= 0),\n      exploded: false,\n'
if old not in text:
    raise SystemExit('VehicleSystem createVehicle anchor missing')
text = text.replace(old, new, 1)
start = text.index('  damageVehicle(vehicleId, amount,')
end = text.index('\n  syncFromCampaign(vehicleId)', start)
replacement = '''  damageVehicle(vehicleId, amount, { reason = "damage", persist = true, destructive = false } = {}) {
    const vehicle = this.vehicle(vehicleId);
    const damage = Math.max(0, Number(amount) || 0);
    if (!vehicle || !damage || vehicle.exploded) return false;
    const transition = vehicleDestructionTransition(vehicle, damage, { destructive });
    if (transition.action === "none") return false;
    vehicle.health = transition.after;
    if (transition.action === "explode") {
      this.explodeVehicle(vehicle, { reason });
    } else if (transition.action === "critical") {
      this.markVehicleCritical(vehicle, { reason });
    }
    if (persist) this.persistVehicle(vehicle);
    this.updateHud();
    this.publish();
    return true;
  }

  markVehicleCritical(vehicle, { reason = "damage" } = {}) {
    if (!vehicle || vehicle.exploded) return false;
    vehicle.health = 0;
    vehicle.disabled = true;
    vehicle.criticalDamage = true;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.gear = 1;
    vehicle.gearShiftTimer = 0;
    vehicle.handbrake = false;
    vehicle.parked = true;
    this.handbrakeActive = false;
    vehicle.container?.setAlpha?.(0.52);
    vehicle.visual?.hood?.setFillStyle?.(0x3f2027, 0.92);
    this.scene.lastActionText = this.currentVehicleId === vehicle.id
      ? `${vehicle.name} is critically damaged. Get out before another hit ignites it.`
      : `${vehicle.name} is critically damaged by ${reason}.`;
    this.scene.events?.emit?.("vehicle:critical", {
      vehicleId: vehicle.id,
      occupied: this.currentVehicleId === vehicle.id,
      reason
    });
    this.scene.events?.emit?.("vehicle:disabled", {
      vehicleId: vehicle.id,
      occupied: this.currentVehicleId === vehicle.id,
      reason
    });
    return true;
  }

  explosionNpcDamage(vehicle) {
    const radius = VEHICLE_DESTRUCTION.explosionRadius;
    const candidates = this.scene.npcSystem?.queryRadius?.(
      vehicle.x,
      vehicle.y,
      radius,
      this.scene.currentLayer
    ) || this.scene.npcSystem?.npcs || [];
    let affected = 0;
    for (const npc of candidates) {
      if (!npc || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted || npc.layer !== this.scene.currentLayer) continue;
      const distance = Math.hypot(npc.x - vehicle.x, npc.y - vehicle.y);
      const damage = explosionDamageAtDistance(distance, {
        radius,
        maxDamage: VEHICLE_DESTRUCTION.npcMaxDamage,
        minDamage: VEHICLE_DESTRUCTION.npcMinDamage
      });
      if (damage <= 0) continue;
      this.scene.combatSystem?.applyHit?.(npc, {
        id: "vehicle_explosion",
        name: "Vehicle explosion",
        attackType: "explosion",
        damage: Math.max(1, Math.round(damage)),
        staggerMs: 900,
        feedbackMs: 700
      }, 0);
      affected++;
    }
    return affected;
  }

  explodeVehicle(vehicle, { reason = "destructive damage" } = {}) {
    if (!vehicle || vehicle.exploded) return false;
    const occupied = this.currentVehicleId === vehicle.id;
    vehicle.health = 0;
    vehicle.disabled = true;
    vehicle.criticalDamage = false;
    vehicle.exploded = true;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.gear = 1;
    vehicle.gearShiftTimer = 0;
    vehicle.handbrake = false;
    vehicle.parked = true;
    this.handbrakeActive = false;
    RawAudio.stopVehicleEngine?.(`player:${vehicle.id}`);
    vehicle.container?.setAlpha?.(0.30);
    vehicle.visual?.hood?.setFillStyle?.(0x1c0b0b, 1);

    const playerDamageSystem = this.scene.playerDamageSystem;
    let playerDamage = 0;
    if (occupied) {
      this.currentVehicleId = null;
      this.scene.registry?.set?.("vehicleOccupied", null);
      this.scene.player?.setActive?.(true);
      this.scene.player?.setVisible?.(true);
      this.scene.player?.setPosition?.(vehicle.x, vehicle.y);
      if (this.scene.player?.body) {
        this.scene.player.body.enable = true;
        this.scene.player.body.setEnable?.(true);
        this.scene.player.body.setVelocity?.(0, 0);
      }
      if (playerDamageSystem && !playerDamageSystem.isDead?.()) {
        playerDamageSystem.state.invulnerableUntil = 0;
        playerDamageSystem.damagePlayer(vehicle, {
          id: "vehicle_explosion",
          label: `${vehicle.name} explosion`,
          damageKind: "explosion",
          vitalityDamage: VEHICLE_DESTRUCTION.occupantVitalityDamage
        });
        playerDamage = VEHICLE_DESTRUCTION.occupantVitalityDamage;
      }
      this.scene.cameras?.main?.setFollowOffset?.(0, 0);
      this.scene.cameras?.main?.startFollow?.(this.scene.player, true, 0.12, 0.12);
    } else if (playerDamageSystem && !playerDamageSystem.isDead?.() && this.scene.currentLayer === vehicle.layer) {
      const distance = Math.hypot(this.scene.player.x - vehicle.x, this.scene.player.y - vehicle.y);
      playerDamage = explosionDamageAtDistance(distance, {
        radius: VEHICLE_DESTRUCTION.explosionRadius,
        maxDamage: VEHICLE_DESTRUCTION.playerMaxDamage,
        minDamage: VEHICLE_DESTRUCTION.playerMinDamage
      });
      if (playerDamage > 0) {
        playerDamageSystem.damagePlayer(vehicle, {
          id: "vehicle_explosion",
          label: `${vehicle.name} explosion`,
          damageKind: "explosion",
          vitalityDamage: playerDamage
        });
      }
    }

    const affectedNpcs = this.explosionNpcDamage(vehicle);
    this.scene.cameras?.main?.shake?.(220, 0.0042);
    this.scene.lastActionText = occupied
      ? `${vehicle.name} explodes with you inside.`
      : `${vehicle.name} explodes after ${reason}.`;
    this.scene.events?.emit?.("vehicle:exploded", {
      vehicleId: vehicle.id,
      occupied,
      reason,
      x: vehicle.x,
      y: vehicle.y,
      radius: VEHICLE_DESTRUCTION.explosionRadius,
      affectedNpcs,
      playerDamage
    });
    return true;
  }
'''
text = text[:start] + replacement + text[end:]
sync_old = '    vehicle.health = condition.health;\n    vehicle.disabled = condition.disabled;\n    vehicle.parked = condition.parked;\n'
sync_new = '    vehicle.health = condition.health;\n    vehicle.disabled = condition.disabled;\n    vehicle.criticalDamage = Boolean(vehicle.disabled && vehicle.health <= 0);\n    vehicle.exploded = false;\n    vehicle.parked = condition.parked;\n'
if sync_old not in text:
    raise SystemExit('VehicleSystem sync anchor missing')
text = text.replace(sync_old, sync_new, 1)
path.write_text(text, encoding='utf-8')

path = Path('phaser/src/vehicles/VehicleDriving.js')
text = path.read_text(encoding='utf-8')
import_anchor = 'import { vehicleCollisionAudioEvent } from "./VehicleCollisionAudioModel.js";\n'
if 'VehicleDestructionPolicy.js' not in text:
    if import_anchor not in text:
        raise SystemExit('VehicleDriving import anchor missing')
    text = text.replace(import_anchor, import_anchor + 'import { VEHICLE_DESTRUCTION } from "./VehicleDestructionPolicy.js";\n', 1)
old = '  if (damage > 0) system.damageVehicle(vehicle.id, damage, { reason: "collision", persist: false });\n'
new = '''  if (damage > 0) system.damageVehicle(vehicle.id, damage, {
    reason: "collision",
    persist: false,
    destructive: impact >= VEHICLE_DESTRUCTION.severeImpactSpeed
  });
'''
if old not in text:
    raise SystemExit('VehicleDriving damage anchor missing')
text = text.replace(old, new, 1)
marker = '  if (vehicle.gear > previousGear) {\n'
guard = '''  if (vehicle.disabled) {
    RawAudio.stopVehicleEngine(`player:${vehicle.id}`);
    system.updateHud();
    system.publish();
    return false;
  }

'''
if guard not in text:
    if marker not in text:
        raise SystemExit('VehicleDriving post-collision anchor missing')
    text = text.replace(marker, guard + marker, 1)
path.write_text(text, encoding='utf-8')

tests = '''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VEHICLE_DESTRUCTION,
  explosionDamageAtDistance,
  vehicleDestructionTransition
} from "../phaser/src/vehicles/VehicleDestructionPolicy.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("zero hull becomes critical instead of exploding on ordinary damage", () => {
  const result = vehicleDestructionTransition({ health: 6, disabled: false }, 6);
  assert.equal(result.action, "critical");
  assert.equal(result.after, 0);
  assert.equal(result.critical, true);
  assert.equal(result.exploded, false);
});

test("a follow-up hit on a critical vehicle triggers the explosion", () => {
  const result = vehicleDestructionTransition({ health: 0, disabled: true, criticalDamage: true }, 1);
  assert.equal(result.action, "explode");
  assert.equal(result.exploded, true);
});

test("a severe final impact may explode immediately when it destroys the remaining hull", () => {
  const result = vehicleDestructionTransition({ health: 4, disabled: false }, 5, { destructive: true });
  assert.equal(result.action, "explode");
  assert.equal(result.after, 0);
});

test("explosion damage falls off with distance and ends at the blast radius", () => {
  const near = explosionDamageAtDistance(0);
  const middle = explosionDamageAtDistance(VEHICLE_DESTRUCTION.explosionRadius / 2);
  const edge = explosionDamageAtDistance(VEHICLE_DESTRUCTION.explosionRadius);
  assert.ok(near > middle);
  assert.ok(middle > 0);
  assert.equal(edge, 0);
});

test("runtime routes critical vehicles, occupant death and radial damage through one explosion authority", () => {
  const system = source("phaser/src/vehicles/VehicleSystem.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(system, /vehicleDestructionTransition/);
  assert.match(system, /markVehicleCritical/);
  assert.match(system, /explodeVehicle/);
  assert.match(system, /playerDamageSystem\.damagePlayer/);
  assert.match(system, /explosionNpcDamage/);
  assert.match(system, /"vehicle:exploded"/);
  assert.match(driving, /destructive: impact >= VEHICLE_DESTRUCTION\.severeImpactSpeed/);
});
'''
Path('tests/vehicle-destruction.test.js').write_text(tests, encoding='utf-8')

path = Path('docs/PLAYTEST_ESCALATION_DAMAGE_RECOVERY.md')
text = path.read_text(encoding='utf-8')
old_state = '**State: in progress on PR #55. Player Vitality foundation is implemented; vehicle critical-damage/explosion remains next.**'
new_state = '**State: implemented on PR #55; pending grouped in-game validation.**'
if old_state not in text:
    raise SystemExit('Roadmap Slice 5 state anchor missing')
text = text.replace(old_state, new_state, 1)
old_section = '''### Remaining Slice 5 work

- A vehicle at zero hull becomes critically damaged; destructive follow-up damage or a severe final impact triggers an explosion rather than every minor zero-health contact exploding immediately.
- An occupant caught in their vehicle's explosion dies; nearby entities receive distance-based damage.
- Route vehicle explosion and later civilian run-over damage through the same authoritative player Vitality state.

### Acceptance

- Hunger can reach 100% without directly reducing Vitality or killing the player.
- The same police bullet removes more Vitality at 100% Hunger than below 100% Hunger.
- Vitality recovers after the damage-free delay below 100% Hunger and does not recover at 100% Hunger.
- Lethal damage produces exactly one dead state and locks movement, weapons, feeding and vehicle input.
- Vehicle explosion behaviour is required before Slice 5 is complete.
'''
new_section = '''### Implemented increment — vehicle critical damage and explosion

- Ordinary damage that reaches zero hull now leaves a **critical wreck** first instead of exploding on the same minor hit.
- Any destructive follow-up hit on that critical wreck explodes it; a severe world impact at **92+ impact speed** may explode immediately when it destroys the remaining hull.
- An occupied vehicle explosion clears vehicle occupancy, restores the player entity to the street and applies lethal explosion damage through the existing authoritative `PlayerDamageSystem`, bypassing only the short overlap-invulnerability window required to guarantee occupant death.
- On-foot players and nearby NPCs receive distance-based radial blast damage inside a **112-unit radius**. The blast publishes one `vehicle:exploded` event with affected-entity metadata for later presentation/audio work.
- Persistent zero-hull vehicles restore as critical wrecks after campaign synchronization; active exploded presentation remains transient runtime state.

### Acceptance

- Hunger can reach 100% without directly reducing Vitality or killing the player.
- The same police bullet removes more Vitality at 100% Hunger than below 100% Hunger.
- Vitality recovers after the damage-free delay below 100% Hunger and does not recover at 100% Hunger.
- Lethal damage produces exactly one dead state and locks movement, weapons, feeding and vehicle input.
- Ordinary zero-hull damage produces a critical wreck; follow-up destructive damage or a severe final collision produces one explosion.
- An occupant dies through the same Vitality authority, while nearby player/NPC damage falls off with distance.
'''
if old_section not in text:
    raise SystemExit('Roadmap Slice 5 section anchor missing')
text = text.replace(old_section, new_section, 1)
path.write_text(text, encoding='utf-8')
