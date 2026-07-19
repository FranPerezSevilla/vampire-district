import {
  AI_ROLES,
  AI_RULES,
  AI_STATES,
  createNpcAiState,
  isNpcDowned,
  recoveryAtForType,
  recoveryResilienceForType,
  resolveNpcAiState,
  shouldRecoverDowned
} from "../data/ai.js";
import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const REPORTING_TYPES = new Set([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET]);
const RC_RECOVERY_DELAY = Object.freeze({
  [NPC_TYPES.POLICE]: 90,
  [NPC_TYPES.HUNTER]: 120
});

function recoveryAtForRuntime(type, downedAt) {
  const rcMode = typeof window !== "undefined" && window.NBD_RC_TEST_MODE;
  if (rcMode && RC_RECOVERY_DELAY[type]) return Math.max(0, Number(downedAt) || 0) + RC_RECOVERY_DELAY[type];
  return recoveryAtForType(type, downedAt);
}

export class AiStateSystem {
  constructor(scene) {
    this.scene = scene;
    this.transitions = 0;
    this.recoveries = 0;
    this.frame = null;

    this.onCombatHit = payload => this.handleCombatHit(payload);
    this.onEntityDowned = payload => this.handleEntityDowned(payload);
    this.onFeedingStarted = payload => this.handleFeedingState(payload);
    this.onFeedingCancelled = payload => this.handleFeedingState(payload);
    this.onFeedingCompleted = payload => this.handleFeedingState(payload);

    scene.events?.on?.("combat:hit", this.onCombatHit);
    scene.events?.on?.("combat:entity-downed", this.onEntityDowned);
    scene.events?.on?.("feeding:started", this.onFeedingStarted);
    scene.events?.on?.("feeding:cancelled", this.onFeedingCancelled);
    scene.events?.on?.("feeding:completed", this.onFeedingCompleted);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.aiStateSystem = this;

    for (const npc of scene.npcSystem?.npcs || []) this.ensureNpc(npc);
  }

  ensureNpc(npc) {
    if (!npc) return null;
    const now = this.scene.time?.now || 0;
    npc.ai ||= createNpcAiState(npc, now);

    if (isNpcDowned(npc) && !(npc.ai.downedAt > 0)) {
      npc.ai.downedAt = now;
      npc.ai.recoverAt = recoveryAtForRuntime(npc.type, now);
    }
    return npc.ai;
  }

  preUpdate(_dt, frame) {
    this.frame = frame || this.scene.currentInputFrame || null;
    const now = this.scene.time?.now || 0;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      this.ensureNpc(npc);
      if (shouldRecoverDowned(npc, now)) this.recoverNpc(npc, now);
      this.resolveNpc(npc, now);
    }
  }

  postUpdate(_dt, frame) {
    this.frame = frame || this.scene.currentInputFrame || this.frame;
    const now = this.scene.time?.now || 0;
    for (const npc of this.scene.npcSystem?.npcs || []) this.resolveNpc(npc, now);
    this.scene.statePublisher?.set?.("aiText", this.summary())
      || this.scene.registry?.set?.("aiText", this.summary());
  }

  resolveNpc(npc, now = this.scene.time?.now || 0) {
    const ai = this.ensureNpc(npc);
    if (!ai) return AI_STATES.INACTIVE;

    if (npc.missionInformant) {
      this.transition(npc, AI_STATES.IDLE, now);
      ai.role = AI_ROLES.GUARD;
      ai.intent = "informant";
      return ai.state;
    }

    const state = resolveNpcAiState(npc, {
      now,
      wantedLevel: Math.min(3, this.scene.exposureSystem?.level?.() || 0)
    });
    this.transition(npc, state, now);
    this.enforceState(npc, state);
    return state;
  }

  transition(npc, state, now) {
    const ai = this.ensureNpc(npc);
    if (!ai || ai.state === state) return false;

    const previousState = ai.state;
    ai.previousState = previousState;
    ai.state = state;
    ai.changedAt = now;
    this.transitions++;

    this.scene.events?.emit?.("ai:state-changed", {
      npcId: npc.id,
      type: npc.type,
      previousState,
      state,
      role: ai.role || AI_ROLES.NONE
    });
    return true;
  }

  enforceState(npc, state) {
    const hideWtf = () => npc.__nbdWtfLabel?.setVisible?.(false);

    if ([AI_STATES.DEAD, AI_STATES.INACTIVE].includes(state)) {
      npc.vx = 0;
      npc.vy = 0;
      npc.enemyAttack = null;
      hideWtf();
      return;
    }

    if (state === AI_STATES.DOWNED) {
      npc.vx = 0;
      npc.vy = 0;
      npc.enemyAttack = null;
      npc.chasingPlayer = false;
      npc.soundReactionTimer = 0;
      npc.reactionTimer = 0;
      this.cancelReportIntent(npc);
      hideWtf();
      return;
    }

    if (state === AI_STATES.DRAINING) {
      npc.vx = 0;
      npc.vy = 0;
      npc.enemyAttack = null;
      npc.soundReactionTimer = 0;
      hideWtf();
      return;
    }

    if (state === AI_STATES.STAGGERED) {
      npc.vx = 0;
      npc.vy = 0;
      npc.enemyAttack = null;
      npc.soundReactionTimer = 0;
      hideWtf();
      return;
    }

    if ([AI_STATES.ATTACKING, AI_STATES.CHASING, AI_STATES.FLEEING, AI_STATES.SEARCHING].includes(state)) {
      npc.soundReactionTimer = 0;
      hideWtf();
      return;
    }

    if (state === AI_STATES.INVESTIGATING) {
      npc.chasingPlayer = false;
      npc.enemyAttack = null;
    }
  }

  cancelReportIntent(npc) {
    if (!npc) return;
    npc.alarmed = false;
    npc.reportTarget = null;
    npc.reportSeverity = 0;
    npc.witnessReason = "";
    npc.witnessSource = null;
    npc.masqueradeRisk = false;
  }

  handleCombatHit(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (!npc) return;
    const now = this.scene.time?.now || 0;

    if (payload.downed || isNpcDowned(npc)) {
      this.scheduleRecovery(npc, now);
      this.cancelReportIntent(npc);
    } else if (REPORTING_TYPES.has(npc.type)) {
      this.scene.witnessSystem?.alarmWitness?.(
        npc,
        "being attacked",
        Math.max(9, Number(payload.damage) * 4 || 9),
        {
          masqueradeRisk: false,
          reactionSeconds: 0.45,
          source: this.scene.player,
          allowStunned: true
        }
      );
    } else if (npc.type === NPC_TYPES.THUG) {
      npc.thugHostile = true;
      npc.alarmed = true;
      npc.reactionTimer = Math.max(npc.reactionTimer || 0, 0.25);
      npc.ai.role = AI_ROLES.ATTACKER;
      npc.ai.intent = "retaliate";
    } else if (npc.type === NPC_TYPES.HUNTER) {
      npc.hunterIntent = "hunt";
      npc.hunterMemoryUntil = now + AI_RULES.hunterMemoryMs;
      npc.hunterLastKnown = { x: this.scene.player.x, y: this.scene.player.y };
    }

    this.resolveNpc(npc, now);
  }

  handleEntityDowned(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (!npc) return;
    const now = this.scene.time?.now || 0;
    this.scheduleRecovery(npc, now);
    this.cancelReportIntent(npc);
    this.resolveNpc(npc, now);
  }

  handleFeedingState(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (npc) this.resolveNpc(npc, this.scene.time?.now || 0);
  }

  scheduleRecovery(npc, now = this.scene.time?.now || 0) {
    const ai = this.ensureNpc(npc);
    if (!ai || !isNpcDowned(npc)) return Number.POSITIVE_INFINITY;
    if (!(ai.downedAt > 0)) ai.downedAt = now;
    if (!(ai.recoverAt > 0)) ai.recoverAt = recoveryAtForRuntime(npc.type, ai.downedAt);
    return ai.recoverAt;
  }

  recoverNpc(npc, now = this.scene.time?.now || 0) {
    if (!isNpcDowned(npc) || npc.dead || npc.drainVictim) return false;
    const combat = npc.combat;
    const resilience = recoveryResilienceForType(npc.type, combat.maxResilience);
    if (resilience <= 0) return false;

    combat.resilience = resilience;
    combat.state = COMBAT_STATES.STAGGERED;
    combat.staggerUntil = now + AI_RULES.recoveryStaggerMs;
    combat.feedbackUntil = now + AI_RULES.recoveryStaggerMs;
    combat.lastHitBy = "recovery";
    npc.stunnedTimer = AI_RULES.recoveryStaggerMs / 1000;
    npc.enemyAttack = null;
    npc.enemyAttackCooldownUntil = now + 900;
    npc.soundReactionTimer = 0;
    npc.reactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    npc.container?.setScale?.(1);
    npc.container?.setAlpha?.(1);

    npc.ai.downedAt = 0;
    npc.ai.recoverAt = 0;

    if (npc.type === NPC_TYPES.POLICE) {
      npc.alarmed = true;
      npc.chasingPlayer = false;
      npc.ai.role = AI_ROLES.SEARCH;
      npc.ai.intent = "recover-search";
      const zone = this.scene.policeSystem?.zoneAt?.(this.scene.player.x, this.scene.player.y);
      npc.investigateTarget = {
        x: this.scene.player.x,
        y: this.scene.player.y,
        kind: "heat",
        zoneId: zone?.id || "district"
      };
      this.scene.policeSystem?.rememberPlayerPosition?.();
    }

    if (npc.type === NPC_TYPES.HUNTER) {
      npc.alarmed = true;
      npc.hunterIntent = "hunt";
      npc.hunterLastKnown = { x: this.scene.player.x, y: this.scene.player.y };
      npc.hunterMemoryUntil = now + AI_RULES.hunterMemoryMs;
      npc.ai.role = AI_ROLES.HUNT;
      npc.ai.intent = "recover-hunt";
    }

    this.recoveries++;
    RawAudio.play("stun", { cooldown: 0.16 });
    if (npc.layer === this.scene.currentLayer) {
      this.scene.lastActionText = npc.type === NPC_TYPES.POLICE
        ? "A downed police officer gets back up and rejoins the search."
        : "The hunter rises again and resumes the hunt.";
    }
    this.scene.events?.emit?.("combat:entity-recovered", {
      targetId: npc.id,
      type: npc.type,
      resilience,
      maxResilience: combat.maxResilience
    });
    this.resolveNpc(npc, now);
    return true;
  }

  findNpc(id) {
    if (!id) return null;
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === id) || null;
  }

  summary() {
    const counts = Object.create(null);
    let recovering = 0;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      const state = npc.ai?.state || AI_STATES.IDLE;
      counts[state] = (counts[state] || 0) + 1;
      if (Number.isFinite(npc.ai?.recoverAt) && npc.ai.recoverAt > 0) recovering++;
    }
    return `AI chase ${counts[AI_STATES.CHASING] || 0} · flee ${counts[AI_STATES.FLEEING] || 0} · investigate ${counts[AI_STATES.INVESTIGATING] || 0} · down ${counts[AI_STATES.DOWNED] || 0} · recovering ${recovering}`;
  }

  destroy() {
    this.scene.events?.off?.("combat:hit", this.onCombatHit);
    this.scene.events?.off?.("combat:entity-downed", this.onEntityDowned);
    this.scene.events?.off?.("feeding:started", this.onFeedingStarted);
    this.scene.events?.off?.("feeding:cancelled", this.onFeedingCancelled);
    this.scene.events?.off?.("feeding:completed", this.onFeedingCompleted);
  }
}
