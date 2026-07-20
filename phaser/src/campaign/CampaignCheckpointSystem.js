import { COMBAT_STATES } from "../data/combat.js";
import { npcDefinitions, NPC_TYPES } from "../data/npcs.js";
import {
  checkpointCanResume,
  checkpointSafetyReasons,
  cloneCampaignCheckpoint,
  sanitizeCampaignCheckpoint
} from "./CampaignCheckpoint.js";
import { CHECKPOINT_KINDS, MISSION_STATUS } from "./constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

const STATIC_NPC_IDS = new Set(npcDefinitions.map(definition => definition.id));
const INFORMANT_ID = "police_roof_informant";
const DYNAMIC_NPC_ID = /^(?:police|hunter)_\d+$/;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function primitiveRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (["string", "number", "boolean"].includes(typeof item) || item == null) result[key] = item;
  }
  return result;
}

export class CampaignCheckpointSystem {
  constructor(scene, campaign) {
    if (!scene || !campaign) throw new TypeError("CampaignCheckpointSystem requires a scene and CampaignSystem.");
    this.scene = scene;
    this.campaign = campaign;
    this.pending = null;
    this.restored = false;
    this.restoredCheckpoint = null;
    this.pendingNpcStates = new Map();
    this.disposers = [];

    this.disposers.push(campaign.events.on("mission:objective-activated", event => {
      this.requestObjective(event.payload.missionId, event.payload.objectiveId);
    }));
    this.disposers.push(campaign.events.on("mission:completed", event => {
      this.requestCompletion(event.payload.missionId);
    }));
    this.disposers.push(campaign.events.on("mission:started", event => {
      if (campaign.checkpoint()?.missionId !== event.payload.missionId) campaign.clearCheckpoint();
    }));

    this.restoreInitialCheckpoint();
    this.queueCurrentObjective();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  restoreInitialCheckpoint() {
    let checkpoint = this.campaign.checkpoint();
    if (!checkpoint) {
      checkpoint = this.synthesizeFromCampaign();
      if (checkpoint) this.campaign.setCheckpoint(checkpoint, { emit: false });
    }
    if (!checkpoint || !checkpointCanResume(checkpoint, this.campaign.state)) return false;
    this.rollbackMissionToCheckpoint(checkpoint);
    this.applyCheckpoint(checkpoint);
    return true;
  }

  synthesizeFromCampaign() {
    const record = this.campaign.missions.record(SILENCE_THE_JOURNALIST_ID);
    const definition = this.campaign.missions.definition(SILENCE_THE_JOURNALIST_ID);
    if (!record || !definition || ![MISSION_STATUS.ACTIVE, MISSION_STATUS.COMPLETED].includes(record.status)) return null;

    const completed = record.status === MISSION_STATUS.COMPLETED;
    const objective = completed ? null : definition.objectives[record.objectiveIndex] || null;
    const policy = completed
      ? definition.metadata?.completionCheckpoint
      : objective?.metadata?.checkpoint;
    if (!policy) return null;

    return this.buildCheckpoint({
      missionId: definition.id,
      objectiveId: objective?.id || null,
      kind: completed ? CHECKPOINT_KINDS.MISSION_COMPLETE : CHECKPOINT_KINDS.SYNTHESIZED,
      policy,
      missionRecord: record,
      synthesized: true
    });
  }

  queueCurrentObjective() {
    const snapshot = this.campaign.missions.snapshot();
    if (!snapshot?.currentObjective) return;
    this.requestObjective(snapshot.id, snapshot.currentObjective.id);
  }

  requestObjective(missionId, objectiveId) {
    const definition = this.campaign.missions.definition(missionId);
    const objective = definition?.objectives?.find(item => item.id === objectiveId);
    const policy = objective?.metadata?.checkpoint;
    if (!definition || !objective || !policy) return false;
    this.pending = {
      missionId: definition.id,
      objectiveId: objective.id,
      kind: CHECKPOINT_KINDS.OBJECTIVE,
      policy: clone(policy),
      forceThreatReset: false,
      requestedAt: this.scene.time?.now || 0
    };
    this.publishPending();
    return true;
  }

  requestCompletion(missionId) {
    const definition = this.campaign.missions.definition(missionId);
    const policy = definition?.metadata?.completionCheckpoint;
    if (!definition || !policy) return false;
    this.pending = {
      missionId: definition.id,
      objectiveId: null,
      kind: CHECKPOINT_KINDS.MISSION_COMPLETE,
      policy: clone(policy),
      forceThreatReset: true,
      requestedAt: this.scene.time?.now || 0
    };
    this.publishPending();
    return true;
  }

  saveCompletionNow(missionId) {
    const definition = this.campaign.missions.definition(missionId);
    const record = this.campaign.missions.record(missionId);
    const policy = definition?.metadata?.completionCheckpoint;
    if (!definition || !record || record.status !== MISSION_STATUS.COMPLETED || !policy) return null;
    const checkpoint = this.buildCheckpoint({
      missionId,
      objectiveId: null,
      kind: CHECKPOINT_KINDS.MISSION_COMPLETE,
      policy,
      missionRecord: record,
      synthesized: false
    });
    return this.storeCheckpoint(checkpoint);
  }

  update() {
    if (!this.pending) return false;
    const safety = this.safetySnapshot();
    const reasons = checkpointSafetyReasons(safety)
      .filter(reason => !this.pending.forceThreatReset || !["wanted", "witnesses", "pursuit"].includes(reason));
    if (reasons.length) {
      this.scene.statePublisher?.set?.("checkpointText", `Checkpoint pending · ${reasons.join(", ")}`);
      return false;
    }

    const record = this.campaign.missions.record(this.pending.missionId);
    if (!record) {
      this.pending = null;
      return false;
    }
    const checkpoint = this.buildCheckpoint({
      ...this.pending,
      missionRecord: record,
      synthesized: false
    });
    this.storeCheckpoint(checkpoint);
    return true;
  }

  storeCheckpoint(candidate) {
    const checkpoint = sanitizeCampaignCheckpoint(candidate);
    if (!checkpoint) return null;
    this.campaign.setCheckpoint(checkpoint);
    this.pending = null;
    this.scene.statePublisher?.set?.("checkpointText", `Checkpoint saved · ${checkpoint.objectiveId || "mission complete"}`);
    this.scene.events?.emit?.("checkpoint:saved", {
      checkpointId: checkpoint.id,
      missionId: checkpoint.missionId,
      objectiveId: checkpoint.objectiveId,
      kind: checkpoint.kind
    });
    return checkpoint;
  }

  safetySnapshot() {
    const activePursuers = (this.scene.npcSystem?.npcs || []).filter(npc => Boolean(
      !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && (npc.chasingPlayer || npc.hunterIntent === "hunt" || npc.enemyAttack)
    )).length;
    return {
      worldLocked: Boolean(
        this.scene.registry?.get?.("uiPaused")
        || this.scene.registry?.get?.("taskRevealActive")
        || this.scene.taskRevealCinematic?.active
        || this.scene.tutorialDirector?.busy
      ),
      transitionActive: Boolean(this.scene.transitionSystem?.active),
      interactionOpen: Boolean(this.scene.interactionSystem?.isOpen),
      feedingActive: Boolean(this.scene.feedingSystem?.isActive?.()),
      combatBusy: Boolean(this.scene.combatSystem?.isBusy?.()),
      hitStunned: Boolean(this.scene.playerDamageSystem?.isHitStunned?.()),
      wantedLevel: this.scene.exposureSystem?.level?.() || 0,
      alarmedWitnesses: this.scene.witnessSystem?.alarmedWitnesses?.().length || 0,
      activePursuers
    };
  }

  buildCheckpoint({ missionId, objectiveId, kind, policy, missionRecord, synthesized = false }) {
    const spawn = policy?.spawn || {};
    const useCurrentPosition = !synthesized && this.scene.player && this.scene.canStandAt?.(this.scene.player.x, this.scene.player.y);
    const x = useCurrentPosition ? this.scene.player.x : Number(spawn.x) || 150;
    const y = useCurrentPosition ? this.scene.player.y : Number(spawn.y) || 146;
    const layer = useCurrentPosition ? this.scene.currentLayer : Number(spawn.layer) || 0;
    const director = this.scene.tutorialDirector;
    const tutorialCompleted = policy?.tutorialState === "complete" || director?.state === "complete";
    const actorPreset = String(policy?.actorPreset || "");
    const npcStates = synthesized
      ? this.syntheticNpcStates(actorPreset, missionRecord)
      : this.captureNpcStates();

    return sanitizeCampaignCheckpoint({
      version: 1,
      id: this.campaign.nextCheckpointId(),
      missionId,
      objectiveId,
      kind,
      createdAt: this.campaign.now(),
      resumable: true,
      mission: clone(missionRecord),
      player: {
        x,
        y,
        layer,
        hunger: this.scene.feedingSystem?.hunger || 0
      },
      loadout: this.captureLoadout(),
      world: {
        exposure: kind === CHECKPOINT_KINDS.MISSION_COMPLETE ? 0 : this.scene.exposureSystem?.value || 0,
        brokenLights: [...(this.scene.brokenLights || [])],
        npcs: npcStates,
        bloodStains: clone(this.scene.evidenceSystem?.bloodStains || []),
        feedingStats: primitiveRecord(this.scene.feedingSystem?.stats),
        evidenceStats: primitiveRecord(this.scene.evidenceSystem?.stats)
      },
      tutorial: {
        completed: tutorialCompleted,
        state: tutorialCompleted ? "complete" : String(director?.state || "waiting"),
        finalAdviceShown: tutorialCompleted || Boolean(director?.finalAdviceShown),
        informantGone: tutorialCompleted || Boolean(director?.informant?.inactive)
      },
      metadata: {
        policyId: String(policy?.id || ""),
        actorPreset,
        synthesized
      }
    });
  }

  captureLoadout() {
    const weapon = this.scene.weaponSystem;
    if (!weapon) return { selectedWeaponId: null, inventory: [], ammo: {} };
    return {
      selectedWeaponId: weapon.currentWeapon?.()?.id || null,
      inventory: [...(weapon.inventory || [])],
      ammo: { ...(weapon.ammo || {}) }
    };
  }

  captureNpcStates() {
    const result = {};
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!this.isPersistentNpc(npc)) continue;
      result[npc.id] = this.captureNpcState(npc);
    }
    return result;
  }

  captureNpcState(npc) {
    return {
      id: npc.id,
      type: npc.type,
      x: npc.x,
      y: npc.y,
      layer: npc.layer,
      dead: Boolean(npc.dead),
      deathKind: npc.deathKind || null,
      inactive: Boolean(npc.inactive),
      hiddenBody: Boolean(npc.hiddenBody),
      intercepted: Boolean(npc.intercepted),
      corpseDiscovered: Boolean(npc.corpseDiscovered),
      hasReported: Boolean(npc.hasReported),
      combat: {
        state: npc.combat?.state || COMBAT_STATES.ACTIVE,
        resilience: npc.combat?.resilience || 0,
        maxResilience: npc.combat?.maxResilience || 0
      }
    };
  }

  isPersistentNpc(npc) {
    if (!npc?.id || DYNAMIC_NPC_ID.test(npc.id)) return false;
    return STATIC_NPC_IDS.has(npc.id) || npc.id === INFORMANT_ID || npc.missionInformant;
  }

  syntheticNpcStates(actorPreset, missionRecord) {
    const result = this.captureNpcStates();
    if (!["post_informant", "journalist_handled", "mission_complete"].includes(actorPreset)) return result;

    result.rooftop_thug = this.syntheticNpcState("rooftop_thug", {
      dead: true,
      deathKind: "drained",
      combat: { state: COMBAT_STATES.DRAINED, resilience: 0 }
    });
    result[INFORMANT_ID] = this.syntheticNpcState(INFORMANT_ID, {
      type: NPC_TYPES.POLICE,
      x: 846,
      y: 148,
      layer: 1,
      inactive: true
    });
    result.journalist = this.syntheticNpcState("journalist", { inactive: false });

    if (["journalist_handled", "mission_complete"].includes(actorPreset)) {
      const outcome = missionRecord?.objectives?.neutralize_journalist?.outcome === "drained"
        ? "drained"
        : "killed";
      result.journalist = this.syntheticNpcState("journalist", {
        inactive: false,
        dead: true,
        deathKind: outcome,
        combat: {
          state: outcome === "drained" ? COMBAT_STATES.DRAINED : COMBAT_STATES.DEAD,
          resilience: 0
        }
      });
    }
    return result;
  }

  syntheticNpcState(id, overrides = {}) {
    const runtime = this.scene.npcSystem?.npcs?.find(npc => npc.id === id);
    const definition = npcDefinitions.find(npc => npc.id === id);
    const base = runtime ? this.captureNpcState(runtime) : {
      id,
      type: overrides.type || definition?.type || "",
      x: definition?.x || 0,
      y: definition?.y || 0,
      layer: definition?.layer || 0,
      dead: false,
      deathKind: null,
      inactive: Boolean(definition?.inactive),
      hiddenBody: false,
      intercepted: false,
      corpseDiscovered: false,
      hasReported: false,
      combat: { state: COMBAT_STATES.ACTIVE, resilience: 0, maxResilience: 0 }
    };
    return {
      ...base,
      ...overrides,
      combat: { ...base.combat, ...(overrides.combat || {}) }
    };
  }

  rollbackMissionToCheckpoint(checkpoint) {
    const mission = clone(checkpoint.mission);
    this.campaign.state.missions.records[checkpoint.missionId] = mission;
    this.campaign.state.missions.activeMissionId = mission.status === MISSION_STATUS.ACTIVE
      ? checkpoint.missionId
      : null;
    this.campaign.state.missions.completed = this.campaign.state.missions.completed
      .filter(id => id !== checkpoint.missionId);
    this.campaign.state.missions.failed = this.campaign.state.missions.failed
      .filter(id => id !== checkpoint.missionId);
    if (mission.status === MISSION_STATUS.COMPLETED) this.campaign.state.missions.completed.push(checkpoint.missionId);
    if (mission.status === MISSION_STATUS.FAILED) this.campaign.state.missions.failed.push(checkpoint.missionId);
    this.campaign.touch();
    if (this.campaign.autoSave) this.campaign.save();
  }

  applyCheckpoint(candidate) {
    const checkpoint = cloneCampaignCheckpoint(candidate);
    if (!checkpoint) return false;
    this.restored = true;
    this.restoredCheckpoint = checkpoint;
    this.pendingNpcStates = new Map(Object.entries(checkpoint.world.npcs || {}));

    this.removeTransientNpcs();
    this.scene.currentLayer = checkpoint.player.layer;
    this.scene.player?.setPosition?.(checkpoint.player.x, checkpoint.player.y);
    this.scene.player?.setScale?.(1);
    if (this.scene.feedingSystem) {
      this.scene.feedingSystem.hunger = checkpoint.player.hunger;
      Object.assign(this.scene.feedingSystem.stats, checkpoint.world.feedingStats || {});
    }
    this.scene.weaponSystem?.restoreState?.(checkpoint.loadout);
    if (this.scene.exposureSystem) {
      this.scene.exposureSystem.value = checkpoint.world.exposure;
      this.scene.exposureSystem.lastReason = "Restored from a safe checkpoint.";
    }

    this.scene.brokenLights = new Set(checkpoint.world.brokenLights || []);
    for (const prop of this.scene.propDamageSystem?.props || []) {
      const broken = this.scene.brokenLights.has(prop.id);
      prop.broken = broken;
      prop.durability = broken ? 0 : prop.maxDurability;
    }

    for (const npc of this.scene.npcSystem?.npcs || []) this.applyPendingNpcState(npc);
    if (this.scene.evidenceSystem) {
      this.scene.evidenceSystem.draggingBody = null;
      this.scene.evidenceSystem.bloodStains = clone(checkpoint.world.bloodStains || []);
      this.scene.evidenceSystem.nextBloodId = 1 + Math.max(0, ...this.scene.evidenceSystem.bloodStains.map(stain => Number(stain.id) || 0));
      Object.assign(this.scene.evidenceSystem.stats, checkpoint.world.evidenceStats || {});
    }
    this.resetTransientThreats();

    this.scene.pendingTutorialCheckpoint = clone(checkpoint.tutorial);
    this.scene.registry?.set?.("campaignResumePending", true);
    this.scene.registry?.set?.("campaignCheckpointRestored", checkpoint.id);
    this.scene.statePublisher?.set?.("checkpointText", `Checkpoint restored · ${checkpoint.objectiveId || "mission complete"}`);
    this.scene.lastActionText = `CHECKPOINT RESTORED: ${checkpoint.objectiveId || "report accepted"}.`;
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    this.scene.missionSystem?.syncFromCampaign?.({ force: true, emitStep: false });
    this.scene.redrawLayer?.(this.scene.lastActionText);
    this.scene.events?.emit?.("checkpoint:restored", {
      checkpointId: checkpoint.id,
      missionId: checkpoint.missionId,
      objectiveId: checkpoint.objectiveId,
      kind: checkpoint.kind
    });
    return true;
  }

  applyPendingNpcState(npc) {
    const state = this.pendingNpcStates.get(npc?.id);
    if (!state || !npc) return false;
    this.pendingNpcStates.delete(npc.id);
    npc.x = state.x;
    npc.y = state.y;
    npc.layer = state.layer;
    npc.container?.setPosition?.(npc.x, npc.y);

    if (state.dead && !npc.dead) this.scene.npcSystem?.markDead?.(npc, state.deathKind || "killed");
    npc.dead = Boolean(state.dead);
    npc.deathKind = state.deathKind;
    npc.inactive = Boolean(state.inactive);
    npc.hiddenBody = Boolean(state.hiddenBody);
    npc.intercepted = Boolean(state.intercepted);
    npc.corpseDiscovered = Boolean(state.corpseDiscovered);
    npc.hasReported = Boolean(state.hasReported);
    npc.alarmed = false;
    npc.chasingPlayer = false;
    npc.enemyAttack = null;
    npc.soundReactionTimer = 0;
    npc.reactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    if (npc.combat) {
      npc.combat.state = state.combat.state;
      npc.combat.resilience = state.combat.resilience;
      if (state.combat.maxResilience > 0) npc.combat.maxResilience = state.combat.maxResilience;
    }
    npc.stunnedTimer = state.combat.state === COMBAT_STATES.DOWNED
      ? Number.POSITIVE_INFINITY
      : 0;
    npc.container?.setVisible?.(!npc.hiddenBody && !npc.inactive && npc.layer === this.scene.currentLayer);
    return true;
  }

  removeTransientNpcs() {
    if (!this.scene.npcSystem?.npcs) return;
    const kept = [];
    for (const npc of this.scene.npcSystem.npcs) {
      if (DYNAMIC_NPC_ID.test(npc.id)) {
        npc.container?.destroy?.();
        continue;
      }
      kept.push(npc);
    }
    this.scene.npcSystem.npcs = kept;
  }

  resetTransientThreats() {
    const police = this.scene.policeSystem;
    if (police) {
      police.localHeat = Object.create(null);
      police.lastKnownPlayer = null;
      police.arrestTriggered = false;
      police.attackLeaderId = null;
      police.helicopter.active = false;
      police.helicopter.lock = 0;
      police.helicopterGraphics?.clear?.();
    }
    const hunter = this.scene.hunterSystem;
    if (hunter) {
      hunter.routeBlocks = [];
      hunter.revealed = false;
      hunter.nextBlockAt = 0;
    }
    for (const npc of this.scene.npcSystem?.npcs || []) {
      npc.alarmed = false;
      npc.chasingPlayer = false;
      npc.enemyAttack = null;
      npc.reportTarget = null;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
    }
  }

  tutorialCheckpoint() {
    return clone(this.restoredCheckpoint?.tutorial || this.scene.pendingTutorialCheckpoint || null);
  }

  publishPending() {
    if (!this.pending) return;
    this.scene.statePublisher?.set?.("checkpointText", `Checkpoint pending · ${this.pending.objectiveId || "mission complete"}`);
  }

  summary() {
    if (this.pending) return `Checkpoint pending · ${this.pending.objectiveId || this.pending.kind}`;
    const checkpoint = this.campaign.checkpoint();
    return checkpoint
      ? `Checkpoint ${checkpoint.id} · ${checkpoint.objectiveId || checkpoint.kind}`
      : "No resumable checkpoint";
  }

  destroy() {
    for (const dispose of this.disposers.splice(0)) dispose?.();
    this.pending = null;
    this.pendingNpcStates.clear();
  }
}
