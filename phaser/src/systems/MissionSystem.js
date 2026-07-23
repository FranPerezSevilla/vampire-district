import { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } from "../campaign/constants.js";
import { RawAudio } from "./RawAudioSystem.js";

// Kept as a compatibility export for old tooling. It is no longer used by the
// production runtime because no opening contract is registered.
export const RETURN_FINALE_COPY = Object.freeze({
  speaker: "YOUR SIRE · IN YOUR MIND",
  segments: Object.freeze([]),
  reportTitle: "CONTRACT COMPLETE",
  reportSubtitle: "The operation is complete."
});

export class MissionSystem {
  constructor(scene, campaign = scene?.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM) {
    if (!scene || !campaign) throw new TypeError("MissionSystem requires the scene and CampaignSystem.");
    this.scene = scene;
    this.campaign = campaign;
    scene.missionSystem = this;
    scene.campaignSystem = campaign;

    this.presentationMissionId = campaign.state.missions.activeMissionId || null;
    this.resultPublished = false;
    this.returnFinalePending = false;
    this.returnFinalePromise = null;
    this.lastMissionText = "No active contract · city free roam.";
    this.lastPublishedStep = 0;
    this.nextActionText = "";
    this.disposers = [];

    this.onCampaignChanged = event => this.handleCampaignEvent(event);
    for (const eventType of [
      "mission:started",
      "mission:objective-activated",
      "mission:completed",
      "mission:failed"
    ]) this.disposers.push(campaign.events.on(eventType, this.onCampaignChanged));

    this.onNeutralized = payload => this.handleNeutralized(payload);
    scene.events?.on?.("combat:entity-neutralized", this.onNeutralized);
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  displayRecord() {
    const id = this.campaign.state.missions.activeMissionId || this.presentationMissionId;
    return id ? this.campaign.missions.snapshot(id) : null;
  }

  record() { return this.displayRecord(); }
  missionRecord(id = this.presentationMissionId) { return id ? this.campaign.missions.snapshot(id) : null; }
  currentObjective() { return this.campaign.missions.currentObjective(); }
  openingObjective() { return null; }
  openingMarker() { return null; }
  cleanPresented() { return false; }

  get step() { return Math.max(0, Number(this.displayRecord()?.objectiveIndex) || 0); }
  get completed() { return this.displayRecord()?.status === MISSION_STATUS.COMPLETED; }
  get failed() { return this.displayRecord()?.status === MISSION_STATUS.FAILED; }
  get failureReason() { return this.displayRecord()?.failureReason || ""; }
  get rooftopJumps() { return 0; }
  set rooftopJumps(_value) {}
  get tipCollected() { return false; }

  update() {}
  onRooftopJump() {}
  collectPoliceRoofTip() { return false; }
  resolveJournalistPlaceholder() { return false; }
  beginReturnFinale() { return false; }
  completeMission() { return false; }
  syncJournalistVisibility() {}

  collectInteractions() { return []; }

  handleNeutralized(payload = {}) {
    if (!this.campaign.state.missions.activeMissionId) return false;
    const outcome = payload.kind === "drained" ? "drained" : payload.kind === "killed" ? "killed" : payload.outcome;
    return this.campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
      ...payload,
      targetId: payload.targetId || payload.entityId,
      outcome
    });
  }

  failRun(reason, {
    title = "MISSION FAILED",
    missionText = "FAILED · The run is over.",
    audio = "masqueradeFail"
  } = {}) {
    const activeMissionId = this.campaign.state.missions.activeMissionId;
    if (!activeMissionId || this.completed || this.failed) return false;
    this.presentationMissionId = activeMissionId;
    this.lastMissionText = missionText;
    const failed = this.campaign.failActiveMission(reason, {
      source: title.toLowerCase().replaceAll(" ", "-")
    });
    if (!failed) return false;
    RawAudio.play(audio);
    this.publishResult("failed", title, reason, { missionId: activeMissionId });
    return true;
  }

  failMasquerade(reason = "The veil is broken.") {
    return this.failRun(reason);
  }

  failArrest(reason = "Police surround and detain you.") {
    return this.failRun(reason, {
      title: "DETAINED",
      missionText: "FAILED · You have been detained by the police.",
      audio: "police"
    });
  }

  handleCampaignEvent(event) {
    const missionId = event?.payload?.missionId;
    if (!missionId) return;
    this.presentationMissionId = missionId;
    this.syncFromCampaign({
      actionText: this.actionTextForCurrentState(event.type),
      redraw: true
    });
    if (event.type === "mission:completed") {
      this.publishResult("complete", "CONTRACT COMPLETE", "The operation is complete.", { missionId });
    } else if (event.type === "mission:failed") {
      this.publishResult("failed", "MISSION FAILED", this.failureReason || "The operation is over.", { missionId });
    }
  }

  syncFromCampaign({ actionText = "", redraw = true } = {}) {
    const activeMissionId = this.campaign.state.missions.activeMissionId;
    if (activeMissionId) this.presentationMissionId = activeMissionId;
    this.lastPublishedStep = this.step;
    this.lastMissionText = this.activeTaskText();
    if (actionText) this.scene.lastActionText = actionText;
    if (redraw && this.scene.map) this.scene.redrawLayer?.(this.scene.lastActionText);
    return true;
  }

  actionTextForCurrentState(eventType = "") {
    if (eventType === "mission:failed") return `MISSION FAILED: ${this.failureReason || "The operation is over."}`;
    if (eventType === "mission:completed") return "CONTRACT COMPLETE.";
    return this.currentObjective()?.label || "Campaign updated.";
  }

  resetResultState(missionId = this.campaign.state.missions.activeMissionId || this.presentationMissionId) {
    this.presentationMissionId = missionId || null;
    this.resultPublished = false;
    this.scene.statePublisher?.set?.("missionResult", null)
      || this.scene.registry?.set?.("missionResult", null);
  }

  publishResult(status, title, subtitle, {
    missionId = this.campaign.state.missions.activeMissionId || this.presentationMissionId,
    actionLabel = null
  } = {}) {
    if (this.resultPublished || !missionId) return false;
    this.resultPublished = true;
    this.presentationMissionId = missionId;
    const result = {
      status,
      title,
      subtitle,
      missionId,
      actionLabel: actionLabel || (status === "complete" ? "Continue free roam · Enter/Esc" : "Reload page to restart"),
      mission: this.campaign.missions.snapshot(missionId),
      stats: this.resultStats()
    };
    this.scene.statePublisher?.set?.("missionResult", result)
      || this.scene.registry?.set?.("missionResult", result);
    return true;
  }

  resultStats() {
    const definition = this.campaign.missions.definition(this.presentationMissionId);
    return {
      contract: definition?.title || this.presentationMissionId || "No contract",
      task: this.activeTaskText(),
      rooftopJumps: 0,
      cash: this.campaign.wallet?.balance?.() || 0,
      hunger: this.scene.feedingSystem?.summary?.() || "Hunger unavailable",
      exposure: this.scene.exposureSystem?.summary?.() || "Exposure unavailable",
      police: this.scene.policeSystem?.summary?.() || "Police unavailable",
      witnesses: this.scene.witnessSystem?.summary?.() || "Witnesses unavailable",
      evidence: this.scene.evidenceSystem?.summary?.() || "Evidence unavailable",
      props: this.scene.propDamageSystem?.summary?.() || "Props unavailable",
      weapon: this.scene.weaponSystem?.summary?.() || "Weapon unavailable",
      ai: this.scene.aiStateSystem?.summary?.() || "AI unavailable",
      npc: this.scene.npcSystem?.summary?.() || "NPCs unavailable",
      last: this.scene.lastActionText || "--"
    };
  }

  activeTaskText() {
    const mission = this.displayRecord();
    if (!mission) return "No active contract · city free roam.";
    if (mission.status === MISSION_STATUS.FAILED) return `FAILED · ${mission.failureReason || "The run is over."}`;
    if (mission.status === MISSION_STATUS.COMPLETED) return "COMPLETE · Contract recorded.";
    return mission.currentObjective?.label
      ? `Active Task: ${mission.currentObjective.label}`
      : `${mission.title} · active`;
  }

  objectiveText() {
    const mission = this.displayRecord();
    if (!mission) return "No active contract · explore the city freely.";
    if (mission.status === MISSION_STATUS.FAILED) return `FAILED · ${mission.failureReason || "The run is over."}`;
    if (mission.status === MISSION_STATUS.COMPLETED) return "COMPLETE · Contract recorded.";
    const index = Math.max(0, Number(mission.objectiveIndex) || 0) + 1;
    return `${index}/${mission.objectives.length} ${mission.currentObjective?.label || mission.title}`;
  }

  marker() {
    const marker = this.currentObjective()?.metadata?.marker;
    return marker ? { ...marker } : null;
  }

  isNear(point) {
    if (!point || this.scene.currentLayer !== point.layer) return false;
    return this.distanceTo(point) <= point.radius;
  }

  distanceTo(point) {
    return globalThis.Phaser?.Math?.Distance?.Between
      ? Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y)
      : Math.hypot(this.scene.player.x - point.x, this.scene.player.y - point.y);
  }

  destroy() {
    this.scene.events?.off?.("combat:entity-neutralized", this.onNeutralized);
    for (const dispose of this.disposers.splice(0)) dispose?.();
  }
}
