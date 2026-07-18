import "../combat/police-alert-runtime.js";
import {
  AI_ROLES,
  AI_RULES,
  AI_STATES,
  createNpcAiState,
  policeContainmentTarget,
  predictPursuitPoint,
  selectPoliceAttackLeader
} from "../data/ai.js";
import { PLAYER, WORLD } from "../data/balance.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { CombatSystem } from "../combat/CombatSystem.js";
import { PlayerDamageSystem } from "../combat/PlayerDamageSystem.js";
import { GameScene } from "../scenes/GameScene.js";
import { AiStateSystem } from "../systems/AiStateSystem.js";
import { HunterSystem } from "../systems/HunterSystem.js";
import { NpcSystem } from "../systems/NpcSystem.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";
import { WitnessSystem } from "../systems/WitnessSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const POLICE_CHASE_MULTIPLIER = Object.freeze([0.72, 0.90, 1.04, 1.14]);
const POLICE_SEARCH_MULTIPLIER = Object.freeze([0.52, 0.64, 0.80, 0.92]);
const POLICE_PATROL_SPEED = PLAYER.baseSpeed * 0.36;
const POLICE_INVESTIGATE_SPEED = PLAYER.baseSpeed * 0.52;
const HUNTER_ANCHOR = Object.freeze({ x: 842, y: 474 });
const HUNTER_CHASE_SPEED = PLAYER.baseSpeed * 0.96;
const HUNTER_MEMORY_SPEED = PLAYER.baseSpeed * 0.76;
const HUNTER_TRACK_SPEED = PLAYER.baseSpeed * 0.55;
const HUNTER_BLOCK_SPEED = PLAYER.baseSpeed * 0.62;
const HUNTER_PATROL_SPEED = PLAYER.baseSpeed * 0.32;
const REPORTING_TYPES = new Set([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET]);

function stopNpc(npc) {
  if (!npc) return;
  npc.vx = 0;
  npc.vy = 0;
}

function facePoint(npc, x, y) {
  const dx = x - npc.x;
  const dy = y - npc.y;
  const length = Math.hypot(dx, dy) || 1;
  npc.dirX = dx / length;
  npc.dirY = dy / length;
}

function npcUnavailableForAi(npc) {
  return Boolean(
    !npc
    || npc.dead
    || npc.inactive
    || npc.hiddenBody
    || npc.intercepted
    || npc.drainVictim
    || npc.combat?.state === COMBAT_STATES.DOWNED
  );
}

function installNpcStateRuntime() {
  if (NpcSystem.prototype.__nbdMilestone8AiPatch) return;

  const originalCreateNpc = NpcSystem.prototype.createNpc;
  const originalUpdateNpc = NpcSystem.prototype.updateNpc;

  NpcSystem.prototype.createNpc = function createNpcWithAiState(definition) {
    const npc = originalCreateNpc.call(this, definition);
    npc.ai ||= createNpcAiState(npc, this.scene.time?.now || 0);
    this.scene.aiStateSystem?.ensureNpc?.(npc);
    return npc;
  };

  NpcSystem.prototype.updateNpc = function updateNpcByPriorityState(npc, dt) {
    if (!npc || npc.missionInformant) return originalUpdateNpc.call(this, npc, dt);
    const state = npc.ai?.state;

    if (state === AI_STATES.CHASING && npc.type === NPC_TYPES.THUG && npc.thugHostile) {
      if (npc.enemyAttack) {
        stopNpc(npc);
        return;
      }
      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
      npc.chasingPlayer = true;
      npc.ai.role = AI_ROLES.ATTACKER;
      npc.ai.intent = "retaliate";
      if (distance > AI_RULES.thugStopDistance) {
        this.moveTowardAtSpeed(npc, this.scene.player.x, this.scene.player.y, dt, AI_RULES.thugChaseSpeed);
      } else {
        stopNpc(npc);
        facePoint(npc, this.scene.player.x, this.scene.player.y);
      }
      return;
    }

    if ([
      AI_STATES.INACTIVE,
      AI_STATES.DEAD,
      AI_STATES.DOWNED,
      AI_STATES.DRAINING,
      AI_STATES.STAGGERED,
      AI_STATES.ATTACKING,
      AI_STATES.CHASING,
      AI_STATES.FLEEING,
      AI_STATES.SEARCHING
    ].includes(state)) {
      stopNpc(npc);
      return;
    }

    if (state === AI_STATES.PATROLLING
      && [NPC_TYPES.POLICE, NPC_TYPES.HUNTER].includes(npc.type)) {
      stopNpc(npc);
      return;
    }

    return originalUpdateNpc.call(this, npc, dt);
  };

  NpcSystem.prototype.__nbdMilestone8AiPatch = true;
}

function installWitnessStateRuntime() {
  if (WitnessSystem.prototype.__nbdMilestone8AiPatch) return;

  const originalReportWitness = WitnessSystem.prototype.reportWitness;

  WitnessSystem.prototype.alarmWitness = function alarmWitnessWithPriority(witness, reason, severity = 14, options = {}) {
    if (!witness || witness.dead || witness.intercepted || witness.hasReported) return false;
    if (witness.combat?.state === COMBAT_STATES.DOWNED || witness.drainVictim) return false;
    if (!REPORTING_TYPES.has(witness.type)) return false;

    witness.alarmed = true;
    witness.witnessReason = reason;
    witness.reportSeverity = Math.max(witness.reportSeverity || 0, severity);
    witness.reportTarget = witness.reportTarget || this.closestReportPoint(witness);
    witness.masqueradeRisk = Boolean(witness.masqueradeRisk || options.masqueradeRisk);
    witness.reactionTimer = Math.max(witness.reactionTimer || 0, options.reactionSeconds ?? 1.4);
    witness.witnessSource = options.source || null;
    witness.soundReactionTimer = 0;
    witness.__nbdWtfLabel?.setVisible?.(false);
    stopNpc(witness);
    if (witness.ai) {
      witness.ai.role = AI_ROLES.REPORT;
      witness.ai.intent = "report";
    }
    this.scene.aiStateSystem?.resolveNpc?.(witness);
    return true;
  };

  WitnessSystem.prototype.updateAlarmedWitnesses = function updateWitnessesByPriority(dt) {
    for (const witness of this.alarmedWitnesses()) {
      const state = witness.ai?.state;
      if ([AI_STATES.DOWNED, AI_STATES.DEAD, AI_STATES.INACTIVE].includes(state)) {
        this.scene.aiStateSystem?.cancelReportIntent?.(witness);
        continue;
      }
      if ([AI_STATES.STAGGERED, AI_STATES.DRAINING].includes(state)
        || (Number.isFinite(witness.stunnedTimer) && witness.stunnedTimer > 0)) {
        stopNpc(witness);
        witness.container?.setPosition?.(witness.x, witness.y);
        continue;
      }

      const target = witness.reportTarget || this.closestReportPoint(witness);
      witness.reportTarget = target;
      if (witness.ai) {
        witness.ai.role = AI_ROLES.REPORT;
        witness.ai.intent = witness.reactionTimer > 0 ? "react" : "report";
      }

      if (witness.reactionTimer > 0) {
        const wasReacting = witness.reactionTimer;
        witness.reactionTimer = Math.max(0, witness.reactionTimer - dt);
        const source = witness.witnessSource || this.scene.player;
        facePoint(witness, source.x ?? this.scene.player.x, source.y ?? this.scene.player.y);
        stopNpc(witness);
        witness.container?.setPosition?.(witness.x, witness.y);
        if (wasReacting > 0 && witness.reactionTimer <= 0) RawAudio.play("witnessRun");
        continue;
      }

      const speed = witness.masqueradeRisk
        ? Math.max(34, (witness.speed || 14) * 2.45)
        : Math.max(28, (witness.speed || 14) * 2.0);
      this.scene.npcSystem.moveTowardAtSpeed(witness, target.x, target.y, dt, speed);
      witness.container?.setPosition?.(witness.x, witness.y);

      const distance = Phaser.Math.Distance.Between(witness.x, witness.y, target.x, target.y);
      if (distance < 14) this.reportWitness(witness);
    }
  };

  WitnessSystem.prototype.alarmedWitnesses = function alarmedWitnessesByPriority() {
    return (this.scene.npcSystem?.npcs || []).filter(npc => Boolean(
      REPORTING_TYPES.has(npc.type)
      && npc.alarmed
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && !npc.hasReported
      && !npc.drainVictim
      && npc.combat?.state !== COMBAT_STATES.DOWNED
    ));
  };

  WitnessSystem.prototype.reportWitness = function reportWitnessUnlessInterrupted(witness) {
    if (!witness
      || witness.combat?.state === COMBAT_STATES.DOWNED
      || witness.drainVictim
      || (Number.isFinite(witness.stunnedTimer) && witness.stunnedTimer > 0)) {
      return;
    }
    return originalReportWitness.call(this, witness);
  };

  WitnessSystem.prototype.__nbdMilestone8AiPatch = true;
}

function installPoliceFormationRuntime() {
  if (PoliceSystem.prototype.__nbdMilestone8AiPatch) return;

  PoliceSystem.prototype.updatePolice = function updatePoliceWithRoles(dt, level) {
    const clampedLevel = Math.max(0, Math.min(3, Number(level) || 0));
    const entries = [];
    const now = this.scene.time?.now || 0;

    for (const cop of this.police()) {
      this.scene.aiStateSystem?.ensureNpc?.(cop);
      if (npcUnavailableForAi(cop)
        || cop.combat?.state === COMBAT_STATES.STAGGERED
        || (Number.isFinite(cop.stunnedTimer) && cop.stunnedTimer > 0)) {
        stopNpc(cop);
        continue;
      }

      if (cop.enemyAttack) {
        cop.ai.role = AI_ROLES.ATTACKER;
        cop.ai.intent = "attack";
        entries.push({ cop, target: { x: this.scene.player.x, y: this.scene.player.y, kind: "player" } });
        continue;
      }

      if (cop.patrolPause > 0) {
        cop.patrolPause = Math.max(0, cop.patrolPause - dt * (clampedLevel >= 2 ? 2.2 : 1));
        if (cop.patrolPause > 0) {
          stopNpc(cop);
          continue;
        }
      }

      const target = this.targetForCop(cop, clampedLevel);
      entries.push({ cop, target });
    }

    const playerEntries = entries.filter(entry => entry.target?.kind === "player");
    const leaderId = selectPoliceAttackLeader(
      playerEntries.map(entry => entry.cop),
      this.scene.player,
      { previousId: this.attackLeaderId || null, now }
    );
    this.attackLeaderId = leaderId;

    const leader = playerEntries.find(entry => entry.cop.id === leaderId)?.cop || null;
    if (leader?.ai) leader.ai.leaderUntil = now + AI_RULES.policeLeaderHoldMs;

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
        if (cop.id === leaderId) {
          cop.ai.role = AI_ROLES.ATTACKER;
          cop.ai.intent = "close-to-attack";
          this.movePoliceAttacker(cop, dt, clampedLevel);
        } else {
          const slot = containment.findIndex(item => item.cop === cop);
          const point = policeContainmentTarget(
            this.scene.player,
            Math.max(0, slot),
            Math.max(1, containment.length),
            Math.max(1, clampedLevel),
            { rotation }
          );
          cop.ai.role = AI_ROLES.CONTAIN;
          cop.ai.intent = "contain";
          const distance = Phaser.Math.Distance.Between(cop.x, cop.y, point.x, point.y);
          if (distance > 8) {
            this.moveNpcToward(
              cop,
              point.x,
              point.y,
              dt,
              PLAYER.baseSpeed * POLICE_CHASE_MULTIPLIER[clampedLevel] * 0.94
            );
          } else {
            stopNpc(cop);
            facePoint(cop, this.scene.player.x, this.scene.player.y);
          }
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
        ? PLAYER.baseSpeed * POLICE_SEARCH_MULTIPLIER[clampedLevel]
        : target.kind === "heat"
          ? POLICE_INVESTIGATE_SPEED
          : POLICE_PATROL_SPEED;
      this.moveNpcToward(cop, target.x, target.y, dt, speed);
      this.resolveTargetArrival(cop, target, clampedLevel);
    }
  };

  PoliceSystem.prototype.movePoliceAttacker = function movePoliceAttacker(cop, dt, level) {
    const player = this.scene.player;
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const distance = Math.hypot(dx, dy) || 1;
    const standOff = 23;
    if (distance <= standOff + 2) {
      stopNpc(cop);
      facePoint(cop, player.x, player.y);
      return;
    }

    const targetX = player.x - (dx / distance) * standOff;
    const targetY = player.y - (dy / distance) * standOff;
    this.moveNpcToward(
      cop,
      targetX,
      targetY,
      dt,
      PLAYER.baseSpeed * POLICE_CHASE_MULTIPLIER[level]
    );
  };

  PoliceSystem.prototype.__nbdMilestone8AiPatch = true;
}

function hunterCanSeePlayer(system, hunter) {
  const scene = system.scene;
  if (scene.currentLayer !== LAYERS.STREET || hunter.layer !== LAYERS.STREET) return false;
  const shadowed = Boolean(scene.currentShadowAt?.(scene.player.x, scene.player.y, LAYERS.STREET));
  const radius = shadowed ? 190 : 285;
  return Boolean(scene.witnessSystem?.canWitnessSee?.(hunter, scene.player, radius));
}

function installHunterMemoryRuntime() {
  if (HunterSystem.prototype.__nbdMilestone8AiPatch) return;

  HunterSystem.prototype.updateHunters = function updateHuntersWithMemory(dt) {
    const now = this.scene.time?.now || 0;
    const frame = this.scene.currentInputFrame || {};

    for (const hunter of this.hunters()) {
      this.scene.aiStateSystem?.ensureNpc?.(hunter);
      if (npcUnavailableForAi(hunter)
        || hunter.combat?.state === COMBAT_STATES.STAGGERED
        || (Number.isFinite(hunter.stunnedTimer) && hunter.stunnedTimer > 0)) {
        stopNpc(hunter);
        continue;
      }
      if (hunter.enemyAttack) {
        hunter.ai.role = AI_ROLES.ATTACKER;
        hunter.ai.intent = "attack";
        continue;
      }

      let target = null;
      const visible = hunterCanSeePlayer(this, hunter);
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
        const block = this.routeBlocks[0];
        hunter.hunterIntent = "block";
        target = { x: block.x, y: block.y, kind: "block" };
      }
      if (!target) {
        hunter.hunterIntent = "patrol";
        target = { ...HUNTER_ANCHOR, kind: "anchor" };
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
  };

  HunterSystem.prototype.__nbdMilestone8AiPatch = true;
}

function installEnemyAttackPriorityRuntime() {
  if (PlayerDamageSystem.prototype.__nbdMilestone8AiPatch) return;

  const originalEnemyWantsToAttack = PlayerDamageSystem.prototype.enemyWantsToAttack;
  PlayerDamageSystem.prototype.enemyWantsToAttack = function enemyWantsToAttackByRole(npc) {
    if (!npc?.ai) return originalEnemyWantsToAttack.call(this, npc);

    if (npc.type === NPC_TYPES.POLICE) {
      return npc.ai.state === AI_STATES.CHASING
        && npc.ai.role === AI_ROLES.ATTACKER
        && Boolean(npc.chasingPlayer);
    }
    if (npc.type === NPC_TYPES.HUNTER) {
      return npc.ai.state === AI_STATES.CHASING && npc.hunterIntent === "hunt";
    }
    if (npc.type === NPC_TYPES.THUG) {
      return npc.ai.state === AI_STATES.CHASING && Boolean(npc.thugHostile);
    }
    return false;
  };

  PlayerDamageSystem.prototype.__nbdMilestone8AiPatch = true;
}

function installGameSceneAiRuntime() {
  if (GameScene.prototype.__nbdMilestone8AiPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalUpdate = GameScene.prototype.update;

  GameScene.prototype.create = function createWithAiStateSystem(...args) {
    const result = originalCreate.apply(this, args);
    this.aiStateSystem?.destroy?.();
    this.aiStateSystem = new AiStateSystem(this);
    return result;
  };

  GameScene.prototype.update = function updateWithAiPriorities(time, deltaMs) {
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    this.aiStateSystem?.preUpdate?.(dt, this.currentInputFrame);
    const result = originalUpdate.call(this, time, deltaMs);
    this.aiStateSystem?.postUpdate?.(dt, this.currentInputFrame);
    return result;
  };

  GameScene.prototype.__nbdMilestone8AiPatch = true;
}

installNpcStateRuntime();
installWitnessStateRuntime();
installPoliceFormationRuntime();
installHunterMemoryRuntime();
installEnemyAttackPriorityRuntime();
installGameSceneAiRuntime();

export { CombatSystem };
