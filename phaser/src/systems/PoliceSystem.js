import { PLAYER } from "../data/balance.js";
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
  { x: 12, y: 16 }
]);
const INVESTIGATION_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: -30, y: 18 },
  { x: 30, y: -18 },
  { x: -24, y: -24 },
  { x: 24, y: 24 }
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

const CHASE_SPEED = PLAYER.baseSpeed * 0.84;
const SHADOW_CHASE_SPEED = PLAYER.baseSpeed * 0.56;
const INVESTIGATE_SPEED = PLAYER.baseSpeed * 0.52;
const PATROL_SPEED = PLAYER.baseSpeed * 0.36;
const PLAYER_SPOTTED_RADIUS = 178;
const PLAYER_SUSPICIOUS_RADIUS = 136;

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.localHeat = Object.create(null);
    this.spawned = 0;
    this.spawnedThisTick = 0;
  }

  update(dt) {
    this.ensurePatrolState();
    this.coolHeat(dt);
    this.spawnForExposure();
    this.updatePolice(dt);
  }

  ensurePatrolState() {
    let index = 0;
    for (const cop of this.police()) {
      if (!cop.patrolRoute || !PATROL_ROUTES[cop.patrolRoute]) cop.patrolRoute = ROUTE_KEYS[index % ROUTE_KEYS.length];
      if (cop.patrolIndex == null) cop.patrolIndex = index % PATROL_ROUTES[cop.patrolRoute].length;
      if (cop.patrolOffsetIndex == null) cop.patrolOffsetIndex = index % FORMATION_OFFSETS.length;
      if (cop.patrolPause == null) cop.patrolPause = 0;
      index++;
    }
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
      .filter(cop => !cop.dead && !cop.hiddenBody && cop.stunnedTimer <= 0)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, zone.x + zone.w / 2, zone.y + zone.h / 2)
        - Phaser.Math.Distance.Between(b.x, b.y, zone.x + zone.w / 2, zone.y + zone.h / 2));

    for (let i = 0; i < Math.min(cops.length, count + 1); i++) {
      this.assignInvestigation(cops[i], zone, i);
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

  spawnForExposure() {
    const level = this.scene.exposureSystem.level();
    if (level < 2) return;
    const desired = Math.min(5, Math.max(3, level));
    const activePolice = this.police().length;
    this.spawnedThisTick = 0;
    while (activePolice + this.spawnedThisTick < desired) this.spawnPolice();
    this.spawnedThisTick = 0;
  }

  spawnPolice() {
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
      behavior: "police",
      speed: 28,
      dirX: -1,
      dirY: 0,
      patrolRoute: routeKey,
      patrolIndex: this.spawned % route.length,
      patrolOffsetIndex: this.spawned % FORMATION_OFFSETS.length
    });
    cop.active = true;
    cop.investigateTarget = this.hottestPoint();
    this.scene.npcSystem.npcs.push(cop);
    RawAudio.play("police");
    this.scene.lastActionText = "Police enter the district from different patrol routes.";
  }

  updatePolice(dt) {
    for (const cop of this.police()) {
      if (cop.dead || cop.hiddenBody || cop.stunnedTimer > 0) continue;
      if (cop.patrolPause > 0) {
        cop.patrolPause = Math.max(0, cop.patrolPause - dt);
        continue;
      }

      const target = this.targetForCop(cop);
      if (!target) continue;

      const speed = target.kind === "player"
        ? CHASE_SPEED
        : target.kind === "suspiciousPlayer"
          ? SHADOW_CHASE_SPEED
          : target.kind === "heat"
            ? INVESTIGATE_SPEED
            : PATROL_SPEED;

      this.moveNpcToward(cop, target.x, target.y, dt, speed);
      this.resolveTargetArrival(cop, target);
    }
  }

  targetForCop(cop) {
    const level = this.scene.exposureSystem.level();
    const playerVisible = this.playerVisibleToCop(cop, PLAYER_SPOTTED_RADIUS);
    const playerNear = this.scene.currentLayer === LAYERS.STREET
      && Phaser.Math.Distance.Between(cop.x, cop.y, this.scene.player.x, this.scene.player.y) < PLAYER_SUSPICIOUS_RADIUS;

    if (level >= 2 && playerVisible) return { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };
    if (level >= 1 && playerNear && !this.scene.currentShadow()) return { x: this.scene.player.x, y: this.scene.player.y, kind: "suspiciousPlayer" };
    if (cop.investigateTarget?.kind === "heat") return cop.investigateTarget;

    const hot = this.hottestZone();
    if (hot && (this.localHeat[hot.id] || 0) >= 55 && Math.random() < 0.012) {
      this.assignInvestigation(cop, hot, cop.patrolOffsetIndex || 0);
      return cop.investigateTarget;
    }

    return this.nextPatrolPoint(cop);
  }

  playerVisibleToCop(cop, radius) {
    if (this.scene.currentLayer !== LAYERS.STREET) return false;
    if (this.scene.currentShadow()) return false;
    if (this.scene.witnessSystem?.canWitnessSee) return this.scene.witnessSystem.canWitnessSee(cop, this.scene.player, radius);
    return Phaser.Math.Distance.Between(cop.x, cop.y, this.scene.player.x, this.scene.player.y) <= radius;
  }

  resolveTargetArrival(cop, target) {
    const d = Phaser.Math.Distance.Between(cop.x, cop.y, target.x, target.y);
    if (target.kind === "heat" && d < 24) {
      cop.investigateTarget = null;
      cop.patrolPause = 0.55 + Math.random() * 0.7;
      return;
    }
    if (target.kind === "patrol" && d < 18) {
      cop.patrolIndex = (cop.patrolIndex + 1) % this.routeFor(cop).length;
      cop.patrolPause = 0.35 + Math.random() * 0.55;
      return;
    }
    if ((target.kind === "player" || target.kind === "suspiciousPlayer") && d < 18) {
      this.scene.exposureSystem.add(target.kind === "player" ? 4 : 2, "Police close in and force you to move.");
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
    for (const other of this.police()) {
      if (other === cop || other.dead || other.hiddenBody) continue;
      const d = Phaser.Math.Distance.Between(cop.x, cop.y, other.x, other.y);
      if (d <= 0 || d > 34) continue;
      const force = (34 - d) / 34;
      sx += ((cop.x - other.x) / d) * force * 28;
      sy += ((cop.y - other.y) / d) * force * 28;
    }
    return { x: targetX + sx, y: targetY + sy };
  }

  police() {
    return this.scene.npcSystem.npcs.filter(npc => npc.type === NPC_TYPES.POLICE && !npc.inactive && !npc.dead);
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
    const cops = this.police().length;
    const investigating = this.police().filter(c => c.investigateTarget?.kind === "heat").length;
    const hottest = Object.entries(this.localHeat).sort((a, b) => b[1] - a[1])[0];
    return `Police ${cops} · patrols ${Math.max(0, cops - investigating)} · investigating ${investigating} · heat ${hottest ? `${hottest[0]} ${Math.round(hottest[1])}%` : "quiet"}`;
  }
}