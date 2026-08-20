import { AI_STATES } from "../data/ai.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { POLICE_FIREARM } from "../data/player-combat.js";
import {
  advanceBallisticProjectile,
  commitBallisticAdvance,
  createBallisticProjectile
} from "./BallisticProjectile.js";
import { resolveHitscanWorldImpact } from "./HitscanWorldCollision.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalize(direction = {}) {
  const x = finite(direction.x);
  const y = finite(direction.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));
}

export function policeFirearmShooterLimit(level) {
  const wanted = Math.max(0, Math.min(3, Math.floor(finite(level))));
  if (wanted >= 3) return 2;
  if (wanted >= 2) return 1;
  return 0;
}

export function segmentCircleHitDistance(origin, direction, range, center, radius = 8) {
  const aim = normalize(direction);
  const maximum = Math.max(0, finite(range));
  const dx = finite(origin?.x) - finite(center?.x);
  const dy = finite(origin?.y) - finite(center?.y);
  const b = dx * aim.x + dy * aim.y;
  const c = dx * dx + dy * dy - Math.max(0, finite(radius, 8)) ** 2;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  const far = -b + root;
  if (near >= 0 && near <= maximum) return near;
  if (far >= 0 && far <= maximum) return far;
  return null;
}

export function policeCanUseFirearm(cop, level = 0) {
  return Boolean(
    Math.floor(finite(level)) >= 2
    && cop?.type === NPC_TYPES.POLICE
    && !cop.dead
    && !cop.inactive
    && !cop.hiddenBody
    && !cop.intercepted
    && !cop.drainVictim
    && !cop.retiringFromResponse
    && finite(cop.stunnedTimer) <= 0
    && cop.combat?.state !== COMBAT_STATES.DOWNED
    && cop.ai?.state === AI_STATES.CHASING
    && cop.chasingPlayer
  );
}

export class PoliceFirearmSystem {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.impactEffects = [];
    this.labels = new Map();
    this.shotSerial = 0;
    this.graphics = scene.add.graphics().setDepth(72.5);
    scene.policeFirearmSystem = this;
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  wantedLevel() {
    return Math.max(0, Math.min(3, Math.floor(finite(
      this.scene.policeSystem?.wantedLevel?.() ?? this.scene.heatSystem?.level?.() ?? this.scene.exposureSystem?.level?.()
    ))));
  }

  canSimulate(frame, level = this.wantedLevel()) {
    return Boolean(
      frame?.worldEnabled
      && level >= 2
      && this.scene.currentLayer === LAYERS.STREET
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.missionSystem?.failed
    );
  }

  police() {
    return (this.scene.npcSystem?.npcs || []).filter(npc => npc.type === NPC_TYPES.POLICE);
  }

  target() {
    const vehicle = this.scene.vehicleSystem?.currentVehicle?.();
    if (vehicle) {
      return {
        kind: "vehicle",
        id: vehicle.id,
        entity: vehicle,
        x: finite(vehicle.x) + finite(vehicle.velocityX) * POLICE_FIREARM.vehicleLeadSeconds,
        y: finite(vehicle.y) + finite(vehicle.velocityY) * POLICE_FIREARM.vehicleLeadSeconds,
        layer: vehicle.layer ?? LAYERS.STREET
      };
    }
    const player = this.scene.player;
    if (!player) return null;
    return {
      kind: "player",
      id: "player",
      entity: player,
      x: finite(player.x) + finite(player.body?.velocity?.x, finite(player.vx)) * POLICE_FIREARM.playerLeadSeconds,
      y: finite(player.y) + finite(player.body?.velocity?.y, finite(player.vy)) * POLICE_FIREARM.playerLeadSeconds,
      layer: this.scene.currentLayer
    };
  }

  stateFor(cop) {
    cop.policeFirearm ||= {
      phase: "idle",
      timerMs: 0,
      cooldownUntil: 0,
      reloadUntil: 0,
      magazine: POLICE_FIREARM.magazineSize,
      shotsRemaining: 0,
      targetKind: null,
      targetId: null,
      aimDirection: { x: cop.dirX || 1, y: cop.dirY || 0 },
      muzzleUntil: 0
    };
    return cop.policeFirearm;
  }

  muzzleOrigin(cop, direction) {
    const aim = normalize(direction);
    return {
      x: finite(cop.x) + aim.x * POLICE_FIREARM.muzzleOffset,
      y: finite(cop.y) + aim.y * POLICE_FIREARM.muzzleOffset
    };
  }

  projectileVehicles() {
    const colliders = [
      ...(this.scene.vehicleSystem?.vehicles || []),
      ...(this.scene.trafficLocalBehaviorSystem?.projectileColliders?.() || []),
      ...(this.scene.motorizedPoliceSystem?.projectileColliders?.() || [])
    ];
    const unique = new Map();
    for (const vehicle of colliders) {
      if (!vehicle?.id || unique.has(vehicle.id)) continue;
      unique.set(vehicle.id, vehicle);
    }
    return [...unique.values()];
  }

  friendlyPoliceImpact(origin, direction, range, shooterId = null) {
    let best = null;
    for (const cop of this.police()) {
      if (!cop || cop.id === shooterId || cop.dead || cop.inactive || cop.hiddenBody || cop.drainVictim) continue;
      if (cop.layer !== LAYERS.STREET || cop.combat?.state === COMBAT_STATES.DOWNED) continue;
      const hit = segmentCircleHitDistance(origin, direction, range, cop, POLICE_FIREARM.friendlyRadius);
      if (hit == null || (best && best.distance <= hit)) continue;
      best = { kind: "friendly-police", distance: hit, cop };
    }
    return best;
  }

  lineOfFire(cop, target, rangeOverride = null) {
    if (!cop || !target) return { clear: false, reason: "missing-target" };
    const direction = normalize({ x: target.x - cop.x, y: target.y - cop.y });
    const origin = this.muzzleOrigin(cop, direction);
    const targetDistance = rangeOverride == null
      ? Math.hypot(target.x - origin.x, target.y - origin.y)
      : Math.max(0, finite(rangeOverride));
    if (targetDistance < POLICE_FIREARM.minRange || targetDistance > POLICE_FIREARM.range) {
      return { clear: false, reason: "range", direction, origin, targetDistance };
    }

    const friendly = this.friendlyPoliceImpact(origin, direction, targetDistance, cop.id);
    if (friendly && friendly.distance < targetDistance - POLICE_FIREARM.friendlyClearance) {
      return { clear: false, reason: "friendly", direction, origin, targetDistance, impact: friendly };
    }

    const worldImpact = resolveHitscanWorldImpact({
      origin,
      direction,
      range: targetDistance,
      layer: LAYERS.STREET,
      vehicles: this.projectileVehicles(),
      currentVehicleId: null,
      minimumVehicleDistance: 0
    });
    if (worldImpact) {
      const hitsTargetVehicle = target.kind === "vehicle"
        && worldImpact.kind === "vehicle"
        && worldImpact.vehicle?.id === target.id;
      if (!hitsTargetVehicle && worldImpact.distance < targetDistance - POLICE_FIREARM.worldClearance) {
        return { clear: false, reason: "world", direction, origin, targetDistance, impact: worldImpact };
      }
    }

    return { clear: true, direction, origin, targetDistance, impact: worldImpact };
  }

  eligibleShooters(level, target) {
    return this.police()
      .filter(cop => policeCanUseFirearm(cop, level))
      .filter(cop => !cop.enemyAttack)
      .map(cop => ({ cop, line: this.lineOfFire(cop, target) }))
      .filter(entry => entry.line.clear)
      .sort((left, right) => (
        distance(left.cop, target) - distance(right.cop, target)
        || String(left.cop.id).localeCompare(String(right.cop.id))
      ))
      .slice(0, policeFirearmShooterLimit(level));
  }

  beginAim(cop, target, level) {
    const state = this.stateFor(cop);
    const line = this.lineOfFire(cop, target);
    if (!line.clear) return false;
    state.phase = "aim";
    state.timerMs = level >= 3 ? POLICE_FIREARM.wantedThreeAimMs : POLICE_FIREARM.aimMs;
    state.shotsRemaining = Math.min(POLICE_FIREARM.burstSize, state.magazine);
    state.targetKind = target.kind;
    state.targetId = target.id;
    state.aimDirection = { ...line.direction };
    this.faceTarget(cop, target);
    this.scene.events?.emit?.("police:firearm-aimed", {
      officerId: cop.id,
      targetKind: target.kind,
      targetId: target.id,
      aimMs: state.timerMs
    });
    return true;
  }

  faceTarget(cop, target) {
    const aim = normalize({ x: target.x - cop.x, y: target.y - cop.y });
    cop.dirX = aim.x;
    cop.dirY = aim.y;
  }

  finishBurst(state, now) {
    state.targetKind = null;
    state.targetId = null;
    state.shotsRemaining = 0;
    if (state.magazine <= 0) {
      state.phase = "reload";
      state.reloadUntil = now + POLICE_FIREARM.reloadMs;
      return;
    }
    state.phase = "idle";
    state.cooldownUntil = now + POLICE_FIREARM.burstCooldownMs;
  }

  updateOfficer(cop, target, dt, level, selected) {
    const state = this.stateFor(cop);
    const now = finite(this.scene.time?.now);
    state.muzzleUntil = Math.max(0, state.muzzleUntil);

    if (!selected || !policeCanUseFirearm(cop, level) || !target) {
      if (["aim", "burst-gap"].includes(state.phase)) state.phase = "idle";
      return;
    }

    if (state.phase === "reload") {
      if (now < state.reloadUntil) return;
      state.magazine = POLICE_FIREARM.magazineSize;
      state.phase = "idle";
      state.cooldownUntil = now + POLICE_FIREARM.postReloadPauseMs;
    }
    if (state.phase === "idle") {
      if (now < state.cooldownUntil) return;
      this.beginAim(cop, target, level);
      return;
    }

    const line = this.lineOfFire(cop, target);
    if (!line.clear) {
      state.phase = "idle";
      state.cooldownUntil = now + POLICE_FIREARM.blockedRetryMs;
      return;
    }
    state.aimDirection = { ...line.direction };
    this.faceTarget(cop, target);
    cop.vx = 0;
    cop.vy = 0;

    state.timerMs = Math.max(0, state.timerMs - Math.max(0, finite(dt)) * 1000);
    if (state.timerMs > 0) return;

    if (state.phase === "aim" || state.phase === "burst-gap") {
      if (!this.fire(cop, target, line)) {
        state.phase = "idle";
        state.cooldownUntil = now + POLICE_FIREARM.blockedRetryMs;
        return;
      }
      state.magazine = Math.max(0, state.magazine - 1);
      state.shotsRemaining = Math.max(0, state.shotsRemaining - 1);
      if (state.shotsRemaining > 0 && state.magazine > 0) {
        state.phase = "burst-gap";
        state.timerMs = POLICE_FIREARM.shotGapMs;
      } else {
        this.finishBurst(state, now);
      }
    }
  }

  fire(cop, target, suppliedLine = null) {
    const line = suppliedLine || this.lineOfFire(cop, target);
    if (!line.clear) return false;
    const state = this.stateFor(cop);
    const projectile = createBallisticProjectile({
      id: `police-shot-${++this.shotSerial}`,
      attackId: this.shotSerial,
      config: POLICE_FIREARM,
      layer: LAYERS.STREET,
      origin: line.origin,
      direction: line.direction,
      range: POLICE_FIREARM.range,
      speed: POLICE_FIREARM.projectileSpeed
    });
    projectile.shooterId = cop.id;
    projectile.shooter = cop;
    projectile.targetKind = target.kind;
    projectile.targetId = target.id;
    this.projectiles.push(projectile);
    state.muzzleUntil = finite(this.scene.time?.now) + POLICE_FIREARM.muzzleFlashMs;
    RawAudio.play("weaponFire", { cooldown: 0.035 });
    this.scene.events?.emit?.("police:firearm-fired", {
      officerId: cop.id,
      projectileId: projectile.id,
      targetKind: target.kind,
      targetId: target.id,
      x: projectile.x,
      y: projectile.y,
      direction: { ...projectile.direction }
    });
    return true;
  }

  resolveProjectileImpact(projectile, movement) {
    const origin = movement.from;
    const range = movement.distance;
    const candidates = [];
    const world = resolveHitscanWorldImpact({
      origin,
      direction: projectile.direction,
      range,
      layer: projectile.layer,
      vehicles: this.projectileVehicles(),
      currentVehicleId: null,
      minimumVehicleDistance: 0
    });
    if (world) candidates.push(world);

    const friendly = this.friendlyPoliceImpact(origin, projectile.direction, range, projectile.shooterId);
    if (friendly) {
      candidates.push({
        ...friendly,
        x: origin.x + projectile.direction.x * friendly.distance,
        y: origin.y + projectile.direction.y * friendly.distance
      });
    }

    const occupiedVehicle = this.scene.vehicleSystem?.currentVehicle?.();
    if (!occupiedVehicle && this.scene.player && this.scene.currentLayer === projectile.layer) {
      const playerDistance = segmentCircleHitDistance(
        origin,
        projectile.direction,
        range,
        this.scene.player,
        POLICE_FIREARM.playerHitRadius
      );
      if (playerDistance != null) {
        candidates.push({
          kind: "player",
          distance: playerDistance,
          x: origin.x + projectile.direction.x * playerDistance,
          y: origin.y + projectile.direction.y * playerDistance
        });
      }
    }

    return candidates.sort((left, right) => left.distance - right.distance)[0] || null;
  }

  updateProjectiles(dt, active) {
    if (!active) {
      this.projectiles.length = 0;
      this.impactEffects.length = 0;
      return;
    }
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;
      const movement = advanceBallisticProjectile(projectile, dt);
      if (movement.distance <= EPSILON) {
        projectile.alive = false;
        continue;
      }
      const impact = this.resolveProjectileImpact(projectile, movement);
      if (impact) {
        this.completeProjectileImpact(projectile, impact);
        continue;
      }
      commitBallisticAdvance(projectile, movement);
    }
    this.projectiles = this.projectiles.filter(projectile => projectile.alive);
    for (const effect of this.impactEffects) effect.ttl -= Math.max(0, finite(dt));
    this.impactEffects = this.impactEffects.filter(effect => effect.ttl > 0);
  }

  completeProjectileImpact(projectile, impact) {
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.x = impact.x;
    projectile.y = impact.y;
    projectile.alive = false;
    this.impactEffects.push({
      x: impact.x,
      y: impact.y,
      kind: impact.kind,
      ttl: POLICE_FIREARM.impactSeconds,
      duration: POLICE_FIREARM.impactSeconds
    });

    if (impact.kind === "player") {
      RawAudio.play("bulletHitBody", { cooldown: 0.04 });
      this.scene.playerDamageSystem?.damagePlayer?.(projectile.shooter, POLICE_FIREARM);
    } else {
      RawAudio.play("bulletHitWorld", { cooldown: 0.035 });
      const current = this.scene.vehicleSystem?.currentVehicle?.();
      if (impact.kind === "vehicle" && current && impact.vehicle?.id === current.id) {
        this.scene.vehicleSystem.damageVehicle?.(current.id, POLICE_FIREARM.vehicleDamage, {
          reason: "police gunfire",
          persist: !current.transient
        });
      }
    }

    this.scene.events?.emit?.("police:firearm-impact", {
      officerId: projectile.shooterId,
      projectileId: projectile.id,
      targetKind: impact.kind,
      targetId: impact.vehicle?.id || impact.cop?.id || (impact.kind === "player" ? "player" : null),
      x: impact.x,
      y: impact.y
    });
  }

  update(dt = 0, frame = this.scene.currentInputFrame) {
    const level = this.wantedLevel();
    const active = this.canSimulate(frame, level);
    this.updateProjectiles(dt, active);
    if (!active) {
      for (const cop of this.police()) {
        const state = this.stateFor(cop);
        if (["aim", "burst-gap"].includes(state.phase)) state.phase = "idle";
      }
      this.draw(frame);
      return false;
    }

    const target = this.target();
    const selected = new Set(this.eligibleShooters(level, target).map(entry => entry.cop.id));
    for (const cop of this.police()) {
      this.updateOfficer(cop, target, dt, level, selected.has(cop.id));
    }
    this.draw(frame);
    return Boolean(selected.size || this.projectiles.length);
  }

  ensureLabel(cop) {
    if (this.labels.has(cop.id)) return this.labels.get(cop.id);
    const label = this.scene.add.text(cop.x, cop.y - 22, "AIM", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#fff4b8",
      backgroundColor: "rgba(72, 8, 16, .88)",
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    label.setResolution?.(3);
    label.setStroke?.("#100207", 2);
    this.labels.set(cop.id, label);
    return label;
  }

  draw(frame) {
    const graphics = this.graphics;
    graphics.clear();
    const worldVisible = Boolean(frame?.worldEnabled && this.scene.currentLayer === LAYERS.STREET);
    const now = finite(this.scene.time?.now);
    const visibleLabels = new Set();

    if (worldVisible) {
      for (const cop of this.police()) {
        const state = this.stateFor(cop);
        if (!["aim", "burst-gap"].includes(state.phase) || cop.layer !== LAYERS.STREET || cop.hiddenBody) continue;
        const target = this.target();
        if (!target) continue;
        const line = this.lineOfFire(cop, target);
        if (!line.clear) continue;
        const pulse = 0.42 + Math.abs(Math.sin(now / 95)) * 0.38;
        graphics.lineStyle(1, POLICE_FIREARM.color, pulse);
        graphics.beginPath();
        graphics.moveTo(line.origin.x, line.origin.y);
        graphics.lineTo(
          line.origin.x + line.direction.x * Math.min(line.targetDistance, POLICE_FIREARM.range),
          line.origin.y + line.direction.y * Math.min(line.targetDistance, POLICE_FIREARM.range)
        );
        graphics.strokePath();
        this.ensureLabel(cop).setPosition(cop.x, cop.y - 22).setVisible(true);
        visibleLabels.add(cop.id);

        if (now < state.muzzleUntil) {
          graphics.fillStyle(0xfff2a8, 0.95).fillCircle(line.origin.x, line.origin.y, 4);
        }
      }

      for (const projectile of this.projectiles) {
        const tail = 10;
        graphics.lineStyle(3, POLICE_FIREARM.color, 0.95);
        graphics.beginPath();
        graphics.moveTo(
          projectile.x - projectile.direction.x * tail,
          projectile.y - projectile.direction.y * tail
        );
        graphics.lineTo(projectile.x, projectile.y);
        graphics.strokePath();
        graphics.fillStyle(0xffffff, 0.95).fillCircle(projectile.x, projectile.y, 2);
      }

      for (const effect of this.impactEffects) {
        const alpha = Math.max(0, effect.ttl / effect.duration);
        const progress = 1 - alpha;
        graphics.lineStyle(2, effect.kind === "player" ? 0xff8f9d : 0xfff2a8, alpha)
          .strokeCircle(effect.x, effect.y, 3 + progress * 6);
      }
    }

    for (const [id, label] of this.labels.entries()) {
      if (!visibleLabels.has(id)) label.setVisible(false);
    }
  }

  destroy() {
    this.projectiles.length = 0;
    this.impactEffects.length = 0;
    this.graphics?.destroy?.();
    for (const label of this.labels.values()) label.destroy?.();
    this.labels.clear();
  }
}
