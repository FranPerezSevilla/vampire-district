import { AI_ROLES, AI_RULES, predictPursuitPoint } from "../data/ai.js";
import { PLAYER, WORLD } from "../data/balance.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const CHURCH_ANCHOR = Object.freeze({ x: 842, y: 474 });

const ROUTE_BLOCK_POINTS = Object.freeze([
  { id: "church_gate", name: "church gate", x: 842, y: 474, layer: LAYERS.STREET },
  { id: "club_alley", name: "club rear alley", x: 676, y: 502, layer: LAYERS.STREET },
  { id: "cross_manhole", name: "crossroad manhole", x: 472, y: 326, layer: LAYERS.STREET },
  { id: "refuge_escape", name: "refuge fire escape", x: 176, y: 244, layer: LAYERS.STREET }
]);

const HUNTER_CHASE_SPEED = PLAYER.baseSpeed * 0.96;
const HUNTER_MEMORY_SPEED = PLAYER.baseSpeed * 0.76;
const HUNTER_TRACK_SPEED = PLAYER.baseSpeed * 0.55;
const HUNTER_BLOCK_SPEED = PLAYER.baseSpeed * 0.62;
const HUNTER_PATROL_SPEED = PLAYER.baseSpeed * 0.32;

export class HunterSystem {
  constructor(scene) {
    this.scene = scene;
    this.spawned = 0;
    this.revealed = false;
    this.routeBlocks = [];
    this.nextBlockAt = 0;
  }

  update(dt) {
    this.maybeReveal();
    this.updateRouteBlocks(dt);
    this.updateHunters(dt);
  }

  maybeReveal() {
    if (this.revealed) return;
    const level = this.scene.exposureSystem.level();
    if (level < 4) return;

    this.revealed = true;
    this.spawnHunter();
    RawAudio.play("hunter");
    this.scene.lastActionText = this.scene.missionSystem?.failed
      ? "The veil is broken. A hunter enters the district."
      : "Exposure is too high. A hunter notices the pattern behind the crimes.";
  }

  spawnHunter() {
    this.spawned++;
    const hunter = this.scene.npcSystem.createNpc({
      id: `hunter_${this.spawned}`,
      type: NPC_TYPES.HUNTER,
      x: CHURCH_ANCHOR.x + (Math.random() - 0.5) * 44,
      y: CHURCH_ANCHOR.y + (Math.random() - 0.5) * 34,
      layer: LAYERS.STREET,
      behavior: "hunter",
      speed: 42
    });
    hunter.active = true;
    hunter.hunterIntent = "patrol";
    hunter.hunterMemoryUntil = 0;
    hunter.hunterLastKnown = null;
    this.scene.npcSystem.npcs.push(hunter);
    this.scene.entityStreamSystem?.applyNpcState?.(hunter, 0);
    this.scene.npcSystem.rebuildSpatialIndex?.();
  }

  updateRouteBlocks(dt) {
    this.nextBlockAt = Math.max(0, this.nextBlockAt - dt);
    for (const block of this.routeBlocks) block.life -= dt;
    this.routeBlocks = this.routeBlocks.filter(block => block.life > 0);

    if (!this.revealed || this.nextBlockAt > 0) return;
    if (this.scene.exposureSystem.level() < 4) return;
    this.nextBlockAt = 8.5;

    const candidates = ROUTE_BLOCK_POINTS
      .filter(point => !this.routeBlocks.some(block => block.id === point.id))
      .map(point => ({ point, score: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y) + Math.random() * 80 }))
      .sort((a, b) => a.score - b.score);

    if (!candidates.length) return;
    const point = candidates[0].point;
    this.routeBlocks.push({ ...point, life: 8.5 });
    RawAudio.play("hunter");
    this.scene.lastActionText = `A hunter tries to cut off ${point.name}.`;
  }

  updateHunters(dt) {
    const now = this.scene.time?.now || 0;
    const frame = this.scene.currentInputFrame || {};

    for (const hunter of this.hunters()) {
      this.scene.aiStateSystem?.ensureNpc?.(hunter);
      if (hunter.combat?.state === COMBAT_STATES.STAGGERED
        || (Number.isFinite(hunter.stunnedTimer) && hunter.stunnedTimer > 0)) {
        this.stopNpc(hunter);
        continue;
      }
      if (hunter.enemyAttack) {
        hunter.ai.role = AI_ROLES.ATTACKER;
        hunter.ai.intent = "attack";
        this.stopNpc(hunter);
        continue;
      }

      let target = null;
      const visible = this.canSeePlayer(hunter);
      if (visible) {
        const predicted = predictPursuitPoint(this.scene.player, frame.move, {
          bounds: { minX: 8, minY: 8, maxX: WORLD.width - 8, maxY: WORLD.height - 8 }
        });
        hunter.hunterLastKnown = predicted;
        hunter.hunterMemoryUntil = now + AI_RULES.hunterMemoryMs;
        hunter.hunterIntent = "hunt";
        target = { ...predicted, kind: "player" };
      } else if (hunter.hunterLastKnown && now < (hunter.hunterMemoryUntil || 0)) {
        hunter.hunterIntent = "hunt";
        target = { ...hunter.hunterLastKnown, kind: "memory" };
      }

      if (!target) {
        const blood = this.nearestBlood(hunter);
        if (blood) {
          hunter.hunterIntent = "track";
          target = { x: blood.x, y: blood.y, kind: "blood" };
        }
      }
      if (!target && this.routeBlocks.length) {
        const block = this.closestRouteBlock(hunter);
        if (block) {
          hunter.hunterIntent = "block";
          target = { x: block.x, y: block.y, kind: "block" };
        }
      }
      if (!target) {
        hunter.hunterIntent = "patrol";
        target = { ...CHURCH_ANCHOR, kind: "anchor" };
      }

      const speed = target.kind === "player"
        ? HUNTER_CHASE_SPEED
        : target.kind === "memory"
          ? HUNTER_MEMORY_SPEED
          : target.kind === "blood"
            ? HUNTER_TRACK_SPEED
            : target.kind === "block"
              ? HUNTER_BLOCK_SPEED
              : HUNTER_PATROL_SPEED;

      hunter.ai.role = target.kind === "player"
        ? AI_ROLES.HUNT
        : target.kind === "memory" || target.kind === "blood"
          ? AI_ROLES.TRACK
          : target.kind === "block"
            ? AI_ROLES.BLOCK
            : AI_ROLES.PATROL;
      hunter.ai.intent = target.kind;
      this.moveNpcToward(hunter, target.x, target.y, dt, speed);

      if (target.kind === "memory"
        && Phaser.Math.Distance.Between(hunter.x, hunter.y, target.x, target.y) < 18) {
        hunter.hunterMemoryUntil = Math.min(hunter.hunterMemoryUntil || now, now + 1_200);
      }
    }
  }

  canSeePlayer(hunter) {
    if (this.scene.currentLayer !== LAYERS.STREET || hunter.layer !== LAYERS.STREET) return false;
    const shadowed = Boolean(this.scene.currentShadowAt?.(
      this.scene.player.x,
      this.scene.player.y,
      LAYERS.STREET
    ));
    const queryRadius = shadowed ? 306 : 285;
    return Boolean(this.scene.witnessSystem?.canWitnessSee?.(hunter, this.scene.player, queryRadius));
  }

  nearestBlood(hunter) {
    const stains = this.scene.evidenceSystem?.bloodStains || [];
    let best = null;
    let bestD = Infinity;
    for (const stain of stains) {
      if (stain.cleaned || stain.layer !== hunter.layer) continue;
      const distance = Phaser.Math.Distance.Between(hunter.x, hunter.y, stain.x, stain.y);
      if (distance < 180 && distance < bestD) {
        best = stain;
        bestD = distance;
      }
    }
    return best;
  }

  closestRouteBlock(hunter) {
    return [...this.routeBlocks]
      .filter(block => block.layer === hunter.layer)
      .sort((a, b) => Phaser.Math.Distance.Between(hunter.x, hunter.y, a.x, a.y)
        - Phaser.Math.Distance.Between(hunter.x, hunter.y, b.x, b.y))[0] || null;
  }

  moveNpcToward(npc, x, y, dt, speed) {
    this.scene.npcSystem.moveTowardAtSpeed(npc, x, y, dt, speed);
    npc.container.setPosition(npc.x, npc.y);
  }

  stopNpc(npc) {
    npc.vx = 0;
    npc.vy = 0;
  }

  hunters() {
    const stream = this.scene.entityStreamSystem;
    return this.scene.npcSystem.npcs.filter(npc => Boolean(
      npc.type === NPC_TYPES.HUNTER
      && !npc.inactive
      && !npc.dead
      && npc.combat?.state !== COMBAT_STATES.DOWNED
      && !npc.drainVictim
      && (!stream || stream.shouldSimulateNpc(npc))
    ));
  }

  summary() {
    if (!this.revealed) return "Hunters dormant";
    const hunters = this.hunters();
    const hunting = hunters.filter(hunter => hunter.hunterIntent === "hunt").length;
    const blocks = this.routeBlocks.length ? ` · blocks ${this.routeBlocks.length}` : "";
    return `Hunters ${hunters.length} · hunting ${hunting}${blocks}`;
  }
}