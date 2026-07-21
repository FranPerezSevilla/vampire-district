import {
  AI_ROLES,
  AI_RULES,
  policeContainmentTarget,
  selectPoliceAttackLeader
} from "../data/ai.js";
import { PLAYER } from "../data/balance.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const POLICE_STATION = Object.freeze({ x: 780, y: 178 });
const PATROL_ROUTES = Object.freeze({
  northEast: [
    { x: 780, y: 178 },
    { x: 740, y: 248 },
    { x: 604, y: 326 },
    { x: 520, y: 244 },
    { x: 780, y: 178 }
  ],
  westCross: [
    { x: 250, y: 326 },
    { x: 360, y: 326 },
    { x: 488, y: 326 },
    { x: 472, y: 242 },
    { x: 250, y: 326 }
  ],
  southClub: [
    { x: 676, y: 502 },
    { x: 604, y: 326 },
    { x: 740, y: 326 },
    { x: 842, y: 500 },
    { x: 676, y: 502 }
  ]
});
const ROUTE_KEYS = Object.freeze(Object.keys(PATROL_ROUTES));
const FORMATION_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: -18, y: 10 },
  { x: 18, y: -10 },
  { x: -12, y: -16 },
  { x: 12, y: 16 },
  { x: -28, y: -4 },
  { x: 28, y: 4 },
  { x: 0, y: 24 }
]);
const INVESTIGATION_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: -38, y: 20 },
  { x: 38, y: -20 },
  { x: -28, y: -30 },
  { x: 28, y: 30 },
  { x: -52, y: 0 },
  { x: 52, y: 0 },
  { x: 0, y: 46 }
]);
const LOCAL_ZONES = Object.freeze([
  { id: "cross", name: "Central crossroad", x: 392, y: 244, w: 170, h: 170 },
  { id: "north", name: "North avenue", x: 400, y: 38, w: 150, h: 250 },
  { id: "east", name: "East avenue", x: 520, y: 292, w: 374, h: 116 },
  { id: "west", name: "West avenue", x: 64, y: 292, w: 360, h: 116 },
  { id: "club", name: "Club", x: 574, y: 350, w: 208, h: 168 },
  { id: "church", name: "Church", x: 786, y: 404, w: 150, h: 176 },
  { id: "police", name: "Police station", x: 670, y: 70, w: 220, h: 204 },
  { id: "alleys", name: "Alleys", x: 80, y: 232, w: 820, h: 330 }
]);

const PATROL_SPEED = PLAYER.baseSpeed * 0.36;
const INVESTIGATE_SPEED = PLAYER.baseSpeed * 0.52;
const HELICOPTER_LIGHT_RADIUS = 38;
const HELICOPTER_LOCK_SECONDS = 0.72;

const WANTED_CONFIG = Object.freeze({
  0: { desired: 3, chaseSpeed: PLAYER.baseSpeed * 0.72, searchSpeed: INVESTIGATE_SPEED, sight: 150, shadowSight: 0, surroundRadius: 0 },
  1: { desired: 4, chaseSpeed: PLAYER.baseSpeed * 0.90, searchSpeed: PLAYER.baseSpeed * 0.64, sight: 190, shadowSight: 58, surroundRadius: 43 },
  2: { desired: 6, chaseSpeed: PLAYER.baseSpeed * 1.04, searchSpeed: PLAYER.baseSpeed * 0.80, sight: 238, shadowSight: 100, surroundRadius: 49 },
  3: { desired: 8, chaseSpeed: PLAYER.baseSpeed * 1.14, searchSpeed: PLAYER.baseSpeed * 0.92, sight: 286, shadowSight: 142, surroundRadius: 55 }
});

function clampLevel(level) {
  return Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
}

function configForLevel(level) {
  return WANTED_CONFIG[clampLevel(level)];
}

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.localHeat = Object.create(null);
    this.spawned = 0;
    this.spawnedThisTick = 0;
    this.previousLevel = 0;
    this.attackLeaderId = null;
    this.lastKnownPlayer = null;
    this.arrestTriggered = false;
    this.helicopter = {
      active: false,
      x: scene.player?.x || 480,
      y: (scene.player?.y || 320) - 110,
      spotX: scene.player?.x || 480,
      spotY: scene.player?.y || 320,
      phase: 0,
      lock: 0
    };
    this.helicopterGraphics = scene.add.graphics().setDepth(39);
  }

  update(dt) {
    if (this.arrestTriggered) return;

    this.ensurePatrolState();
    this.coolHeat(dt);

    const rawLevel = this.scene.exposureSystem.level();
    const level = clampLevel(rawLevel);
    this.handleWantedLevelChange(level);
    this.spawnForExposure(level);
    this.updatePolice(dt, level);
    this.updateHelicopter(dt, level);
    this.checkSurrounded(level);
    this.previousLevel = level;
  }

  ensurePatrolState() {
    let index = 0;
    for (const cop of this.police()) {
      cop.behavior = "guard";
      if (!cop.patrolRoute || !PATROL_ROUTES[cop.patrolRoute]) cop.patrolRoute = ROUTE_KEYS[index % ROUTE_KEYS.length];
      if (cop.patrolIndex == null) cop.patrolIndex = index % PATROL_ROUTES[cop.patrolRoute].length;
      if (cop.patrolOffsetIndex == null) cop.patrolOffsetIndex = index % FORMATION_OFFSETS.length;
      if (cop.searchIndex == null) cop.searchIndex = index % INVESTIGATION_OFFSETS.length;
      if (cop.patrolPause == null) cop.patrolPause = 0;
      index++;
    }
  }

  handleWantedLevelChange(level) {
    if (level <= this.previousLevel) return;

    this.rememberPlayerPosition();
    const zone = this.zoneAt(this.scene.player.x, this.scene.player.y);
    this.redirectNearbyPatrols(zone, level >= 2 ? 5 : 3);
    RawAudio.play("police");

    if (level === 1) {
      this.scene.lastActionText = "WANTED LEVEL 1: police actively search the last known area and chase on sight.";
    } else if (level === 2) {
      this.scene.lastActionText = "WANTED LEVEL 2: more units join the search and pursue aggressively, even through nearby shadows.";
    } else if (level >= 3) {
      this.scene.lastActionText = "WANTED LEVEL 3: police flood the district and a helicopter spotlight joins the hunt.";
    }
  }

  rememberPlayerPosition() {
    if (this.scene.currentLayer !== LAYERS.STREET) return;
    this.lastKnownPlayer = {
      x: this.scene.player.x,
      y: this.scene.player.y,
      zoneId: this.zoneAt(this.scene.player.x, this.scene.player.y).id
    };
  }

  addHeat(x, y, amount, reason = "disturbance") {
    if (!amount || amount <= 0) return;
    const zone = this.zoneAt(x, y);
    const before = this.localHeat[zone.id] || 0;
    this.localHeat[zone.id] = Math.min(100, before + amount);
    if (before < 18 && this.localHeat[zone.id] >= 18) this.redirectNearbyPatrols(zone, Math.max(1, Math.ceil(amount / 16)));
    if (before < 45 && this.localHeat[zone.id] >= 45) {
      RawAudio.play("police");
      this.scene.lastActionText = `${zone.name} heats up: ${reason}.`;
    }
  }

  redirectNearbyPatrols(zone, count = 1) {
    const cops = this.police()
      .filter(cop => !cop.hiddenBody && cop.stunnedTimer <= 0)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, zone.x + zone.w / 2, zone.y + zone.h / 2)
        - Phaser.Math.Distance.Between(b.x, b.y, zone.x + zone.w / 2, zone.y + zone.h / 2));

    for (let index = 0; index < Math.min(cops.length, count + 1); index++) {
      this.assignInvestigation(cops[index], zone, index);
    }
  }

  assignInvestigation(cop, zone, index = 0) {
    const offset = INVESTIGATION_OFFSETS[index % INVESTIGATION_OFFSETS.length];
    cop.investigateTarget = {
      x: zone.x + zone.w / 2 + offset.x,
      y: zone.y + zone.h / 2 + offset.y,
      kind: "heat",
      zoneId: zone.id
    };
    cop.patrolPause = 0;
  }

  coolHeat(dt) {
    for (const id of Object.keys(this.localHeat)) {
      this.localHeat[id] = Math.max(0, this.localHeat[id] - dt * 1.2);
      if (this.localHeat[id] <= 0.1) delete this.localHeat[id];
    }
  }

  spawnForExposure(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    if (clamped < 1) return;
    const desired = configForLevel(clamped).desired;
    const activePolice = this.police().length;
    this.spawnedThisTick = 0;
    while (activePolice + this.spawnedThisTick < desired) this.spawnPolice(clamped);
    this.spawnedThisTick = 0;
  }

  spawnPolice(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    this.spawnedThisTick++;
    this.spawned++;
    const routeKey = ROUTE_KEYS[this.spawned % ROUTE_KEYS.length];
    const route = PATROL_ROUTES[routeKey];
    const spawnPoint = route[this.spawned % route.length] || POLICE_STATION;
    const offset = FORMATION_OFFSETS[this.spawned % FORMATION_OFFSETS.length];
    const cop = this.scene.npcSystem.createNpc({
      id: `police_${this.spawned}`,
      type: NPC_TYPES.POLICE,
      x: spawnPoint.x + offset.x,
      y: spawnPoint.y + offset.y,
      layer: LAYERS.STREET,
      behavior: "guard",
      speed: 28,
      dirX: -1,
      dirY: 0,
      patrolRoute: routeKey,
      patrolIndex: this.spawned % route.length,
      patrolOffsetIndex: this.spawned % FORMATION_OFFSETS.length,
      searchIndex: this.spawned % INVESTIGATION_OFFSETS.length
    });
    cop.active = true;
    cop.investigateTarget = clamped >= 1 ? null : this.hottestPoint();
    this.scene.npcSystem.npcs.push(cop);
    this.scene.npcSystem.rebuildSpatialIndex?.();
    RawAudio.play("police");
    this.scene.lastActionText = clamped >= 2
      ? "Police reinforcements enter from multiple patrol routes."
      : "An additional patrol joins the active search.";
  }

  updatePolice(dt, level) {
    const clamped = clampLevel(level);
    const cfg = configForLevel(clamped);
    const entries = [];
    const now = this.scene.time?.now || 0;

    for (const cop of this.police()) {
      this.scene.aiStateSystem?.ensureNpc?.(cop);
      if (cop.combat?.state === COMBAT_STATES.STAGGERED
        || (Number.isFinite(cop.stunnedTimer) && cop.stunnedTimer > 0)) {
        this.stopNpc(cop);
        continue;
      }

      if (cop.enemyAttack) {
        cop.ai.role = AI_ROLES.ATTACKER;
        cop.ai.intent = "attack";
        entries.push({ cop, target: { x: this.scene.player.x, y: this.scene.player.y, kind: "player" } });
        continue;
      }

      if (cop.patrolPause > 0) {
        cop.patrolPause = Math.max(0, cop.patrolPause - dt * (clamped >= 2 ? 2.2 : 1));
        if (cop.patrolPause > 0) {
          this.stopNpc(cop);
          continue;
        }
      }

      const target = this.targetForCop(cop, clamped, cfg);
      entries.push({ cop, target });
    }

    const playerEntries = entries.filter(entry => entry.target?.kind === "player");
    const previousLeaderId = this.attackLeaderId;
    const leaderId = selectPoliceAttackLeader(
      playerEntries.map(entry => entry.cop),
      this.scene.player,
      { previousId: previousLeaderId || null, now }
    );
    this.attackLeaderId = leaderId;

    const leader = playerEntries.find(entry => entry.cop.id === leaderId)?.cop || null;
    if (leader?.ai && (leaderId !== previousLeaderId || (leader.ai.leaderUntil || 0) <= now)) {
      leader.ai.leaderUntil = now + AI_RULES.policeLeaderHoldMs;
    }

    const containment = playerEntries
      .filter(entry => entry.cop.id !== leaderId)
      .sort((a, b) => String(a.cop.id || "").localeCompare(String(b.cop.id || "")));
    const aim = this.scene.combatSystem?.aimDirection || this.scene.currentInputFrame?.move || { x: 1, y: 0 };
    const rotation = Math.atan2(aim.y || 0, aim.x || 1) + Math.PI / 2;

    for (const entry of entries) {
      const { cop, target } = entry;
      if (!target || cop.enemyAttack) continue;

      if (target.kind === "player") {
        cop.chasingPlayer = true;
        cop.soundReactionTimer = 0;
        cop.__nbdWtfLabel?.setVisible?.(false);
        if (cop.id === leaderId) {
          cop.ai.role = AI_ROLES.ATTACKER;
          cop.ai.intent = "close-to-attack";
          this.movePoliceAttacker(cop, dt, clamped);
        } else {
          const slot = containment.findIndex(item => item.cop === cop);
          const point = policeContainmentTarget(
            this.scene.player,
            Math.max(0, slot),
            Math.max(1, containment.length),
            Math.max(1, clamped),
            { rotation }
          );
          cop.ai.role = AI_ROLES.CONTAIN;
          cop.ai.intent = "contain";
          const distance = Phaser.Math.Distance.Between(cop.x, cop.y, point.x, point.y);
          if (distance > 8) {
            this.moveNpcToward(cop, point.x, point.y, dt, cfg.chaseSpeed * 0.94);
          } else {
            this.stopNpc(cop);
          }
          this.facePlayer(cop);
        }
        continue;
      }

      cop.chasingPlayer = false;
      cop.ai.role = target.kind === "patrol"
        ? AI_ROLES.PATROL
        : target.kind === "heat" || target.kind === "search"
          ? AI_ROLES.SEARCH
          : AI_ROLES.INVESTIGATE;
      cop.ai.intent = target.kind || "patrol";
      const speed = target.kind === "search"
        ? cfg.searchSpeed
        : target.kind === "heat"
          ? INVESTIGATE_SPEED
          : PATROL_SPEED;
      this.moveNpcToward(cop, target.x, target.y, dt, speed);
      this.resolveTargetArrival(cop, target, clamped);
    }
  }

  movePoliceAttacker(cop, dt, level) {
    const player = this.scene.player;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const distance = Math.hypot(dx, dy) || 1;
    const standOff = 23;
    if (distance <= standOff + 2) {
      this.stopNpc(cop);
      this.facePlayer(cop);
      return;
    }

    const targetX = player.x - (dx / distance) * standOff;
    const targetY = player.y - (dy / distance) * standOff;
    this.moveNpcToward(cop, targetX, targetY, dt, configForLevel(level).chaseSpeed);
    this.facePlayer(cop);
  }

  targetForCop(cop, level, cfg = configForLevel(level)) {
    const clamped = clampLevel(level);

    if (cop.soundReactionTimer > 0 && !cop.chasingPlayer) {
      const seesPlayer = this.playerVisibleToCop(cop, cfg.sight, cfg.shadowSight);
      if (!seesPlayer) return null;
      cop.soundReactionTimer = 0;
      cop.__nbdWtfLabel?.setVisible?.(false);
      if (cop.ai) cop.ai.intent = "visual-contact";
    }

    if (clamped >= 1) {
      const playerVisible = this.playerVisibleToCop(cop, cfg.sight, cfg.shadowSight);
      if (playerVisible) {
        this.rememberPlayerPosition();
        cop.chasingPlayer = true;
        return { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };
      }

      cop.chasingPlayer = false;
      const search = this.searchPointForCop(cop);
      if (search) return search;
    }

    if (cop.investigateTarget?.kind === "heat") return cop.investigateTarget;

    const hot = this.hottestZone();
    if (hot && (this.localHeat[hot.id] || 0) >= 55 && Math.random() < 0.012) {
      this.assignInvestigation(cop, hot, cop.patrolOffsetIndex || 0);
      return cop.investigateTarget;
    }

    return this.nextPatrolPoint(cop);
  }

  searchPointForCop(cop) {
    if (!this.lastKnownPlayer) return null;
    const offset = INVESTIGATION_OFFSETS[cop.searchIndex % INVESTIGATION_OFFSETS.length];
    let x = this.lastKnownPlayer.x + offset.x;
    let y = this.lastKnownPlayer.y + offset.y;

    if (!this.scene.npcSystem.canNpcStandAt(cop, x, y)) {
      x = this.lastKnownPlayer.x;
      y = this.lastKnownPlayer.y;
    }

    return { x, y, kind: "search" };
  }

  playerVisibleToCop(cop, radius, shadowRadius = 0) {
    if (this.scene.currentLayer !== LAYERS.STREET || cop.layer !== LAYERS.STREET) return false;
    const distance = Phaser.Math.Distance.Between(cop.x, cop.y, this.scene.player.x, this.scene.player.y);
    const inShadow = Boolean(this.scene.currentShadow());
    const effectiveRadius = inShadow ? shadowRadius : radius;
    if (!effectiveRadius || distance > effectiveRadius) return false;
    if (this.scene.witnessSystem?.canWitnessSee) return this.scene.witnessSystem.canWitnessSee(cop, this.scene.player, effectiveRadius);
    return true;
  }

  resolveTargetArrival(cop, target, level) {
    const distance = Phaser.Math.Distance.Between(cop.x, cop.y, target.x, target.y);
    if (target.kind === "heat" && distance < 24) {
      cop.investigateTarget = null;
      cop.patrolPause = level >= 2 ? 0.15 : 0.45 + Math.random() * 0.45;
      return;
    }
    if (target.kind === "search" && distance < 20) {
      cop.searchIndex = (cop.searchIndex + 1) % INVESTIGATION_OFFSETS.length;
      cop.patrolPause = level >= 2 ? 0.08 : 0.22 + Math.random() * 0.25;
      return;
    }
    if (target.kind === "patrol" && distance < 18) {
      cop.patrolIndex = (cop.patrolIndex + 1) % this.routeFor(cop).length;
      cop.patrolPause = 0.35 + Math.random() * 0.55;
    }
  }

  routeFor(cop) {
    return PATROL_ROUTES[cop.patrolRoute] || PATROL_ROUTES.northEast;
  }

  nextPatrolPoint(cop) {
    const route = this.routeFor(cop);
    if (cop.patrolIndex == null) cop.patrolIndex = 0;
    const base = route[cop.patrolIndex % route.length];
    const offset = FORMATION_OFFSETS[cop.patrolOffsetIndex % FORMATION_OFFSETS.length] || FORMATION_OFFSETS[0];
    return { x: base.x + offset.x, y: base.y + offset.y, kind: "patrol" };
  }

  moveNpcToward(npc, x, y, dt, speed) {
    const adjusted = this.applySoftSeparation(npc, x, y);
    this.scene.npcSystem.moveTowardAtSpeed(npc, adjusted.x, adjusted.y, dt, speed);
    npc.container.setPosition(npc.x, npc.y);
  }

  applySoftSeparation(cop, targetX, targetY) {
    let sx = 0;
    let sy = 0;
    const nearby = this.scene.npcSystem?.queryRadius?.(cop.x, cop.y, 34, cop.layer)
      || this.police();
    for (const other of nearby) {
      if (other === cop || other.type !== NPC_TYPES.POLICE || other.dead || other.hiddenBody) continue;
      if (other.combat?.state === COMBAT_STATES.DOWNED || other.drainVictim) continue;
      const distance = Phaser.Math.Distance.Between(cop.x, cop.y, other.x, other.y);
      if (distance <= 0 || distance > 34) continue;
      const force = (34 - distance) / 34;
      sx += ((cop.x - other.x) / distance) * force * 28;
      sy += ((cop.y - other.y) / distance) * force * 28;
    }
    return { x: targetX + sx, y: targetY + sy };
  }

  stopNpc(cop) {
    cop.vx = 0;
    cop.vy = 0;
  }

  facePlayer(cop) {
    const dx = this.scene.player.x - cop.x;
    const dy = this.scene.player.y - cop.y;
    const length = Math.hypot(dx, dy) || 1;
    cop.dirX = dx / length;
    cop.dirY = dy / length;
  }

  checkSurrounded(level) {
    if (level < 1 || this.scene.currentLayer !== LAYERS.STREET) return;
    if (this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) return;

    const radius = configForLevel(level).surroundRadius;
    const nearby = this.scene.npcSystem?.queryRadius?.(
      this.scene.player.x,
      this.scene.player.y,
      radius,
      LAYERS.STREET,
      npc => npc.type === NPC_TYPES.POLICE
        && !npc.dead
        && !npc.inactive
        && !npc.hiddenBody
        && !npc.missionInformant
        && npc.stunnedTimer <= 0
        && npc.combat?.state !== COMBAT_STATES.DOWNED
        && !npc.drainVictim
    ) || [];
    if (nearby.length < 3) return;

    const angles = nearby
      .map(cop => Math.atan2(cop.y - this.scene.player.y, cop.x - this.scene.player.x))
      .sort((a, b) => a - b);
    let largestGap = 0;
    for (let index = 0; index < angles.length; index++) {
      const current = angles[index];
      const next = index === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[index + 1];
      largestGap = Math.max(largestGap, next - current);
    }

    if (largestGap <= Math.PI * 1.16) {
      this.triggerArrest("Police surround you from multiple sides and take you into custody.");
    }
  }

  updateHelicopter(dt, level) {
    const shouldBeActive = level >= 3
      && this.scene.currentLayer !== LAYERS.SEWER
      && !this.scene.missionSystem?.failed
      && !this.scene.missionSystem?.completed;

    if (!shouldBeActive) {
      this.helicopter.active = false;
      this.helicopter.lock = 0;
      this.helicopterGraphics.clear();
      return;
    }

    const heli = this.helicopter;
    if (!heli.active) {
      heli.active = true;
      heli.x = this.scene.player.x - 120;
      heli.y = this.scene.player.y - 110;
      heli.spotX = this.scene.player.x + 70;
      heli.spotY = this.scene.player.y;
      heli.phase = 0;
      heli.lock = 0;
      RawAudio.play("police");
      this.scene.lastActionText = "HELICOPTER DEPLOYED: avoid the moving spotlight or you will be detained.";
    }

    heli.phase += dt * 1.45;
    const desiredHeliX = this.scene.player.x + Math.cos(heli.phase * 0.42) * 126;
    const desiredHeliY = this.scene.player.y - 112 + Math.sin(heli.phase * 0.34) * 42;
    const heliLerp = Math.min(1, dt * 0.78);
    heli.x = Phaser.Math.Linear(heli.x, desiredHeliX, heliLerp);
    heli.y = Phaser.Math.Linear(heli.y, desiredHeliY, heliLerp);

    const desiredSpotX = this.scene.player.x + Math.sin(heli.phase) * 58;
    const desiredSpotY = this.scene.player.y + Math.cos(heli.phase * 0.76) * 42;
    const spotLerp = Math.min(1, dt * 1.12);
    heli.spotX = Phaser.Math.Linear(heli.spotX, desiredSpotX, spotLerp);
    heli.spotY = Phaser.Math.Linear(heli.spotY, desiredSpotY, spotLerp);

    const playerDistance = Phaser.Math.Distance.Between(heli.spotX, heli.spotY, this.scene.player.x, this.scene.player.y);
    if (playerDistance <= HELICOPTER_LIGHT_RADIUS) {
      heli.lock = Math.min(HELICOPTER_LOCK_SECONDS, heli.lock + dt);
    } else {
      heli.lock = Math.max(0, heli.lock - dt * 1.8);
    }

    this.drawHelicopter();

    if (heli.lock >= HELICOPTER_LOCK_SECONDS) {
      this.triggerArrest("The helicopter spotlight locks onto you and directs police to the arrest.");
    }
  }

  drawHelicopter() {
    const heli = this.helicopter;
    const graphics = this.helicopterGraphics;
    graphics.clear();

    const lockPct = heli.lock / HELICOPTER_LOCK_SECONDS;
    const lightColor = lockPct > 0.55 ? 0xffb02e : 0xfff2a8;
    const dx = heli.spotX - heli.x;
    const dy = heli.spotY - heli.y;
    const length = Math.hypot(dx, dy) || 1;
    const px = (-dy / length) * HELICOPTER_LIGHT_RADIUS;
    const py = (dx / length) * HELICOPTER_LIGHT_RADIUS;

    graphics.fillStyle(lightColor, 0.055 + lockPct * 0.08);
    graphics.fillTriangle(
      heli.x,
      heli.y + 8,
      heli.spotX + px,
      heli.spotY + py,
      heli.spotX - px,
      heli.spotY - py
    );
    graphics.fillStyle(lightColor, 0.11 + lockPct * 0.13).fillCircle(heli.spotX, heli.spotY, HELICOPTER_LIGHT_RADIUS);
    graphics.lineStyle(2, lightColor, 0.62 + lockPct * 0.28).strokeCircle(heli.spotX, heli.spotY, HELICOPTER_LIGHT_RADIUS);

    graphics.fillStyle(0x111827, 0.98).fillEllipse(heli.x, heli.y, 34, 14);
    graphics.fillStyle(0x4da3ff, 0.9).fillRect(heli.x - 7, heli.y - 5, 14, 9);
    graphics.lineStyle(2, 0xd9ecff, 0.86);
    graphics.beginPath();
    graphics.moveTo(heli.x - 28, heli.y - 10);
    graphics.lineTo(heli.x + 28, heli.y + 10);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(heli.x - 28, heli.y + 10);
    graphics.lineTo(heli.x + 28, heli.y - 10);
    graphics.strokePath();
  }

  triggerArrest(reason) {
    if (this.arrestTriggered || this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) return;
    this.arrestTriggered = true;
    this.scene.playerSpeed = 0;
    RawAudio.play("police");
    this.scene.missionSystem?.failArrest?.(reason);
  }

  police() {
    return this.scene.npcSystem.npcs.filter(npc => Boolean(
      npc.type === NPC_TYPES.POLICE
      && !npc.inactive
      && !npc.dead
      && !npc.missionInformant
      && npc.combat?.state !== COMBAT_STATES.DOWNED
      && !npc.drainVictim
    ));
  }

  zoneAt(x, y) {
    return LOCAL_ZONES.find(zone => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h)
      || { id: "district", name: "District", x: 0, y: 0, w: 960, h: 640 };
  }

  hottestZone() {
    let best = null;
    let heat = 0;
    for (const zone of LOCAL_ZONES) {
      const value = this.localHeat[zone.id] || 0;
      if (value > heat) {
        best = zone;
        heat = value;
      }
    }
    return best;
  }

  hottestPoint() {
    const best = this.hottestZone();
    const heat = best ? this.localHeat[best.id] || 0 : 0;
    if (!best || heat < 15) return { x: POLICE_STATION.x, y: POLICE_STATION.y, kind: "quiet" };
    return { x: best.x + best.w / 2, y: best.y + best.h / 2, kind: "heat", zoneId: best.id };
  }

  summary() {
    const level = clampLevel(this.scene.exposureSystem.level());
    const cops = this.police();
    const chasing = cops.filter(cop => cop.chasingPlayer).length;
    const searching = level >= 1 ? Math.max(0, cops.length - chasing) : 0;
    const roles = cops.reduce((counts, cop) => {
      const role = cop.ai?.role || AI_ROLES.PATROL;
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, Object.create(null));
    const helicopter = this.helicopter.active
      ? ` · helicopter active · spotlight ${Math.round((this.helicopter.lock / HELICOPTER_LOCK_SECONDS) * 100)}%`
      : "";
    return `Police ${cops.length} · wanted ${level} · attacker ${roles[AI_ROLES.ATTACKER] || 0} · containment ${roles[AI_ROLES.CONTAIN] || 0} · searching ${searching}${helicopter}`;
  }
}
