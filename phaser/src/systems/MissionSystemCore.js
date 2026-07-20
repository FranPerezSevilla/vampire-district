import {
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_REFUGES,
  MISSION_STATUS
} from "../campaign/constants.js";
import { CleanTheSceneSystem } from "../campaign/CleanTheSceneSystem.js";
import { CLEAN_THE_SCENE_ID } from "../campaign/missions/cleanTheScene.js";
import { SILENCE_THE_JOURNALIST_ID } from "../campaign/missions/silenceTheJournalist.js";
import { RawAudio } from "./RawAudioSystem.js";

const REQUIRED_ROOFTOP_JUMPS = 3;

export const RETURN_FINALE_COPY = Object.freeze({
  speaker: "YOUR SIRE · IN YOUR MIND",
  segments: Object.freeze([
    "Well done. You silenced the journalist and returned as ordered.",
    "The veil holds. You have served me well tonight."
  ]),
  reportTitle: "REPORT ACCEPTED",
  reportSubtitle: "Your sire accepts the night's work."
});

const LEGACY_STEP_BY_OBJECTIVE = Object.freeze({
  reach_police_roof: 0,
  speak_to_informant: 0,
  reach_nightclub: 1,
  neutralize_journalist: 2,
  return_to_refuge: 3
});

export class MissionSystem {
  constructor(scene, campaign = scene?.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM) {
    if (!scene || !campaign) throw new TypeError("MissionSystem requires the scene and CampaignSystem.");
    this.scene = scene;
    this.campaign = campaign;
    // Mission start events are synchronous. Publish ownership before registering
    // or starting so an event-driven redraw can safely query this facade.
    scene.missionSystem = this;
    scene.campaignSystem = campaign;
    this.presentationMissionId = campaign.state.missions.activeMissionId
      || campaign.checkpoint?.()?.missionId
      || SILENCE_THE_JOURNALIST_ID;
    this.resultPublished = false;
    this.returnFinalePending = false;
    this.returnFinalePromise = null;
    this.lastMissionText = "Cross the rooftops, reach the police station roof and obtain the journalist's location.";
    this.lastPublishedStep = null;
    this.nextActionText = "";
    this.disposers = [];
    this.cleanTheSceneSystem = new CleanTheSceneSystem(scene, campaign, this);

    this.onCampaignChanged = event => this.handleCampaignEvent(event);
    this.onNeutralized = payload => this.handleNeutralized(payload);
    for (const eventType of [
      "mission:started",
      "mission:objective-activated",
      "mission:completed",
      "mission:failed"
    ]) this.disposers.push(campaign.events.on(eventType, this.onCampaignChanged));
    scene.events?.on?.("combat:entity-neutralized", this.onNeutralized);

    this.ensureOpeningMission();
    this.lastPublishedStep = this.step;
    this.lastMissionText = this.activeTaskText();
    this.resultPublished = this.displayRecord()?.status === MISSION_STATUS.COMPLETED;
    this.cleanTheSceneSystem.syncWorld();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  ensureOpeningMission() {
    const active = this.campaign.missions.activeRecord();
    if (active) return active;
    const existing = this.record();
    if (existing?.status === MISSION_STATUS.COMPLETED) return existing;
    return this.campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
      replay: Boolean(existing),
      metadata: {
        integration: "direct_mission_authority",
        rooftopJumps: 0
      }
    });
  }

  // Kept as the opening-mission compatibility accessor used by the validated
  // vertical-slice tests and tutorial presentation.
  record() {
    return this.campaign.missions.record(SILENCE_THE_JOURNALIST_ID);
  }

  missionRecord(id = this.presentationMissionId) {
    return this.campaign.missions.record(id);
  }

  displayRecord() {
    const activeId = this.campaign.state.missions.activeMissionId;
    return this.missionRecord(activeId || this.presentationMissionId);
  }

  currentObjective() {
    return this.campaign.missions.currentObjective();
  }

  openingObjective() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID) return null;
    return this.currentObjective();
  }

  cleanPresented() {
    return this.campaign.state.missions.activeMissionId === CLEAN_THE_SCENE_ID
      || (!this.campaign.state.missions.activeMissionId && this.presentationMissionId === CLEAN_THE_SCENE_ID);
  }

  get step() {
    if (this.cleanPresented()) return this.cleanTheSceneSystem.step;
    const record = this.record();
    if (record?.status === MISSION_STATUS.COMPLETED) return 4;
    const objective = this.openingObjective();
    return objective ? Number(objective.metadata?.legacyStep ?? LEGACY_STEP_BY_OBJECTIVE[objective.id] ?? 0) : 0;
  }

  get completed() {
    return this.displayRecord()?.status === MISSION_STATUS.COMPLETED;
  }

  get failed() {
    return this.displayRecord()?.status === MISSION_STATUS.FAILED;
  }

  get failureReason() {
    return this.displayRecord()?.failureReason || "";
  }

  get rooftopJumps() {
    return Math.max(0, Math.trunc(Number(this.record()?.metadata?.rooftopJumps) || 0));
  }

  set rooftopJumps(value) {
    if (!this.openingObjective()) return;
    this.campaign.missions.updateActiveMetadata({
      rooftopJumps: Math.max(0, Math.trunc(Number(value) || 0))
    });
  }

  get tipCollected() {
    const record = this.record();
    return Boolean(
      record?.status === MISSION_STATUS.COMPLETED
      || (record?.status === MISSION_STATUS.ACTIVE && record.objectiveIndex >= 2)
    );
  }

  update() {
    this.syncJournalistVisibility();
    if (this.campaign.state.missions.activeMissionId === CLEAN_THE_SCENE_ID) {
      this.cleanTheSceneSystem.update();
      return;
    }
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID) return;
    if (this.completed || this.failed || this.returnFinalePending) return;

    const objective = this.openingObjective();
    if (!objective) return;
    if (objective.id === "reach_nightclub" && this.isNear(this.openingMarker())) {
      this.nextActionText = "You reach the nightclub district. The journalist is nearby.";
      this.campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
      return;
    }
    if (objective.id === "return_to_refuge" && this.isNear(this.openingMarker())) this.beginReturnFinale();
  }

  onRooftopJump() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || this.completed
      || this.failed
      || !["reach_police_roof", "speak_to_informant"].includes(this.openingObjective()?.id)) return;
    this.rooftopJumps = this.rooftopJumps + 1;
    this.scene.lastActionText = this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS
      ? `Rooftop route committed: ${this.rooftopJumps}/${REQUIRED_ROOFTOP_JUMPS} jumps before the informant trusts you.`
      : "Rooftop route validated. Neutralize the roof thug if needed, then reach the police station roof.";
  }

  collectPoliceRoofTip() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID || this.completed || this.failed) return false;
    let objective = this.openingObjective();
    if (!["reach_police_roof", "speak_to_informant"].includes(objective?.id)) return false;
    if (this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS) {
      const missing = REQUIRED_ROOFTOP_JUMPS - this.rooftopJumps;
      this.scene.lastActionText = `The informant refuses to talk yet. Stay on the rooftop route: ${missing} more rooftop jump(s).`;
      RawAudio.play("cancel");
      return false;
    }

    if (objective.id === "reach_police_roof") {
      this.nextActionText = "The rooftop route is complete. The informant is ready to speak.";
      this.campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
      objective = this.openingObjective();
    }
    if (objective?.id !== "speak_to_informant") return false;

    this.nextActionText = "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify him.";
    RawAudio.play("confirm");
    const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, {
      targetId: "police_roof_informant"
    });
    this.syncJournalistVisibility();
    this.scene.npcSystem?.refreshVisibility?.();
    return handled;
  }

  collectInteractions() {
    const options = [
      ...(this.scene.missionBoardSystem?.collectInteractions?.() || [])
    ];
    const activeId = this.campaign.state.missions.activeMissionId;
    if (activeId === CLEAN_THE_SCENE_ID) {
      options.push(...this.cleanTheSceneSystem.collectInteractions());
      return options;
    }
    if (activeId !== SILENCE_THE_JOURNALIST_ID || this.failed || this.completed || this.returnFinalePending) return options;

    const objective = this.openingObjective();
    const marker = this.openingMarker();
    if (!objective || !marker) return options;

    if (["reach_police_roof", "speak_to_informant"].includes(objective.id) && this.isNear(marker)) {
      const ready = this.rooftopJumps >= REQUIRED_ROOFTOP_JUMPS;
      options.push({
        id: "mission_collect_police_roof_tip",
        type: "mission",
        label: ready ? "Speak to the police informant" : "Ask rooftop informant",
        detail: ready ? "reveals journalist location" : `${this.rooftopJumps}/${REQUIRED_ROOFTOP_JUMPS} rooftop jumps completed`,
        priority: 130,
        distance: this.distanceTo(marker),
        x: marker.x,
        y: marker.y,
        run: () => this.collectPoliceRoofTip()
      });
    }

    if (objective.id === "neutralize_journalist" && this.isNear(marker) && !this.scene.feedingSystem?.stats.targetHandled) {
      options.push({
        id: "mission_placeholder_journalist",
        type: "mission",
        label: "Assess journalist",
        detail: "use an equipped weapon or drain a valid target",
        priority: 15,
        distance: this.distanceTo(marker),
        x: marker.x,
        y: marker.y,
        run: () => {
          RawAudio.play("menu");
          this.scene.lastActionText = "The journalist is close. Isolate him, attack with the equipped weapon, or drain when vulnerable.";
        }
      });
    }
    return options;
  }

  handleNeutralized(payload = {}) {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || payload.targetId !== "journalist"
      || this.openingObjective()?.id !== "neutralize_journalist") return false;
    const outcome = payload.kind === "drained" ? "drained" : payload.kind === "killed" ? "killed" : null;
    if (!outcome) return false;
    this.nextActionText = `Journalist ${outcome}. Return to the rooftop refuge to report.`;
    return this.campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
      targetId: "journalist",
      outcome
    });
  }

  resolveJournalistPlaceholder(actionText = "Journalist handled. Return to the rooftop refuge to report.") {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || this.failed
      || this.openingObjective()?.id !== "neutralize_journalist") return false;
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    const outcome = journalist?.deathKind === "drained" || this.scene.feedingSystem?.stats?.targetFed
      ? "drained"
      : journalist?.deathKind === "killed" || this.scene.feedingSystem?.stats?.targetHandled
        ? "killed"
        : null;
    if (!outcome) return false;
    this.nextActionText = actionText;
    return this.campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
      targetId: "journalist",
      outcome
    });
  }

  beginReturnFinale() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || this.returnFinalePending
      || this.completed
      || this.failed
      || this.openingObjective()?.id !== "return_to_refuge") return false;
    const director = this.scene.tutorialDirector;
    if (!director?.showDialogue || director.busy) return false;
    this.returnFinalePending = true;
    this.returnFinalePromise = this.runReturnFinale(director);
    return true;
  }

  async runReturnFinale(director) {
    director.busy = true;
    director.state = "mission-complete-sire";
    director.setControlMode?.("locked");
    director.setTip?.("", "");
    director.freezeWorld?.(true);
    this.scene.events?.emit?.("mission:return-finale-started", {
      step: this.step,
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer
    });

    try {
      await director.showDialogue({
        speaker: RETURN_FINALE_COPY.speaker,
        segments: [...RETURN_FINALE_COPY.segments],
        kind: "thought",
        target: this.scene.player
      });
      if (this.failed || this.completed || this.openingObjective()?.id !== "return_to_refuge") return false;

      this.nextActionText = "ORDER COMPLETE: the journalist is handled and the clan's veil still holds.";
      const completed = this.campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
        refugeId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE
      });
      if (!completed || !this.completed) return false;

      RawAudio.play("missionComplete");
      this.scene.campaignCheckpointSystem?.saveCompletionNow?.(SILENCE_THE_JOURNALIST_ID);
      this.scene.events?.emit?.("mission:return-finale-completed", {
        previousStep: 3,
        step: 4
      });
      this.publishResult(
        "complete",
        RETURN_FINALE_COPY.reportTitle,
        RETURN_FINALE_COPY.reportSubtitle,
        { missionId: SILENCE_THE_JOURNALIST_ID }
      );
      this.scene.redrawLayer?.(this.scene.lastActionText);
      return true;
    } catch (error) {
      console.error("Return-to-refuge finale failed", error);
      this.scene.lastActionText = "The report was interrupted. Remain in the refuge and try again.";
      return false;
    } finally {
      director.freezeWorld?.(false);
      director.state = "complete";
      director.busy = false;
      director.setControlMode?.("full");
      this.scene.inputSystem?.resetWorldEdges?.();
      this.returnFinalePending = false;
      this.returnFinalePromise = null;
    }
  }

  completeMission() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || this.openingObjective()?.id !== "return_to_refuge") return false;
    return this.campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
      refugeId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE
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
    this.returnFinalePending = false;
    this.lastMissionText = missionText;
    this.nextActionText = `${title}: ${reason}`;
    const failed = this.campaign.failActiveMission(reason, { source: title.toLowerCase().replaceAll(" ", "-") });
    if (!failed) return false;
    RawAudio.play(audio);
    this.publishResult("failed", title, reason, { missionId: activeMissionId });
    this.scene.redrawLayer?.(this.scene.lastActionText);
    return true;
  }

  failMasquerade(reason = "The veil is broken.") {
    return this.failRun(reason, {
      title: "MISSION FAILED",
      missionText: "FAILED · The veil is broken. The clan cannot contain the story now.",
      audio: "masqueradeFail"
    });
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
    if (event.type === "mission:started") {
      this.presentationMissionId = missionId;
      this.lastPublishedStep = null;
      this.resetResultState(missionId);
    } else if (this.campaign.state.missions.activeMissionId === missionId) {
      this.presentationMissionId = missionId;
    }
    if (missionId !== this.presentationMissionId) return;

    const actionText = this.nextActionText || this.actionTextForCurrentState(event.type);
    this.nextActionText = "";
    this.syncFromCampaign({
      actionText,
      emitStep: missionId === SILENCE_THE_JOURNALIST_ID,
      redraw: true
    });
  }

  syncFromCampaign({ actionText = "", emitStep = true, redraw = true, force = false } = {}) {
    const activeMissionId = this.campaign.state.missions.activeMissionId;
    if (activeMissionId) this.presentationMissionId = activeMissionId;
    const previousStep = this.lastPublishedStep;
    const nextStep = this.step;
    const changed = previousStep != null && previousStep !== nextStep;
    this.lastPublishedStep = nextStep;
    this.lastMissionText = this.activeTaskText();
    if (actionText) this.scene.lastActionText = actionText;
    this.syncJournalistVisibility();
    this.cleanTheSceneSystem.syncWorld();

    if (emitStep && changed) {
      this.scene.events?.emit?.("mission:step-changed", {
        missionId: this.presentationMissionId,
        previousStep,
        step: nextStep,
        missionText: this.objectiveText(),
        actionText: this.scene.lastActionText
      });
    }
    if (redraw && (force || changed || actionText) && this.scene.map) {
      this.scene.redrawLayer?.(this.scene.lastActionText);
    }
    return changed;
  }

  actionTextForCurrentState(eventType = "") {
    if (this.cleanPresented()) return this.cleanTheSceneSystem.actionTextForCurrentState(eventType);
    if (eventType === "mission:failed") return `MISSION FAILED: ${this.failureReason || "The operation is over."}`;
    if (this.completed) return "ORDER COMPLETE: the journalist is handled and the clan's veil still holds.";
    switch (this.openingObjective()?.id) {
      case "speak_to_informant": return "The rooftop route is complete. Speak to the police informant.";
      case "reach_nightclub": return "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify him.";
      case "neutralize_journalist": return "You reach the nightclub district. The journalist is nearby.";
      case "return_to_refuge": return "Journalist handled. Return to the rooftop refuge to report.";
      default: return this.scene.lastActionText || "Mission updated.";
    }
  }

  syncJournalistVisibility() {
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    if (!journalist || journalist.dead || journalist.intercepted) return;
    const shouldHide = !this.tipCollected;
    if (journalist.inactive !== shouldHide) {
      journalist.inactive = shouldHide;
      journalist.container?.setVisible?.(!shouldHide && journalist.layer === this.scene.currentLayer);
      this.scene.npcSystem?.rebuildSpatialIndex?.();
    }
  }

  resetResultState(missionId = this.campaign.state.missions.activeMissionId || this.presentationMissionId) {
    if (missionId) this.presentationMissionId = missionId;
    this.resultPublished = false;
    this.scene.statePublisher?.set?.("missionResult", null)
      || this.scene.registry?.set?.("missionResult", null);
    const uiScene = this.scene.scene?.get?.("UIScene");
    if (uiScene) {
      uiScene.resultDismissed = false;
      uiScene.resultOpen = false;
      uiScene.resultType = null;
    }
  }

  publishResult(status, title, subtitle, {
    missionId = this.campaign.state.missions.activeMissionId || this.presentationMissionId,
    actionLabel = null
  } = {}) {
    if (this.resultPublished) return false;
    this.resultPublished = true;
    if (missionId) this.presentationMissionId = missionId;
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
      contract: definition?.title || this.presentationMissionId,
      task: this.activeTaskText(),
      rooftopJumps: this.rooftopJumps,
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
    if (this.cleanPresented()) return this.cleanTheSceneSystem.activeTaskText();
    const board = this.scene.missionBoardSystem?.snapshot?.();
    if (!this.campaign.state.missions.activeMissionId && board?.available) return "No active contract · review the refuge board.";
    if (this.failed) return `FAILED · ${this.failureReason || "The run is over."}`;
    if (this.completed) return "COMPLETE · Report accepted by the clan.";
    if (this.returnFinalePending) return "Active Task: report to your sire.";
    switch (this.openingObjective()?.id) {
      case "reach_police_roof": return `Active Task: rooftop route to police roof · jumps ${Math.min(this.rooftopJumps, REQUIRED_ROOFTOP_JUMPS)}/${REQUIRED_ROOFTOP_JUMPS}.`;
      case "speak_to_informant": return "Active Task: speak to the police-roof informant.";
      case "reach_nightclub": return "Active Task: reach the nightclub district. The journalist is now revealed.";
      case "neutralize_journalist": return "Active Task: isolate and neutralize the journalist. Avoid public draining; it can tear the veil.";
      case "return_to_refuge": return "Active Task: return to the rooftop refuge and report.";
      default: return this.lastMissionText;
    }
  }

  objectiveText() {
    if (this.cleanPresented()) return this.cleanTheSceneSystem.objectiveText();
    const board = this.scene.missionBoardSystem?.snapshot?.();
    if (!this.campaign.state.missions.activeMissionId && board?.available) return "No active contract · open the rooftop refuge board.";
    if (this.failed) return `FAILED · ${this.failureReason || "The run is over."}`;
    if (this.completed) return "COMPLETE · Report to the clan validated.";
    if (this.returnFinalePending) return "4/4 Reporting to your sire.";
    switch (this.openingObjective()?.id) {
      case "reach_police_roof":
      case "speak_to_informant": return "1/4 Vampire route: cross the roofs, clear the blocker and speak to the informant.";
      case "reach_nightclub": return "2/4 Tip acquired: reach the nightclub by street, roof routes or sewers.";
      case "neutralize_journalist": return "3/4 Neutralize the journalist. Public draining can break the veil.";
      case "return_to_refuge": return "4/4 Return to the rooftop refuge and report.";
      default: return this.lastMissionText;
    }
  }

  marker() {
    const activeMissionId = this.campaign.state.missions.activeMissionId;
    if (activeMissionId === CLEAN_THE_SCENE_ID) return this.cleanTheSceneSystem.marker();
    if (activeMissionId === SILENCE_THE_JOURNALIST_ID) return this.openingMarker();
    return this.scene.missionBoardSystem?.marker?.() || null;
  }

  openingMarker() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID
      || this.completed
      || this.failed
      || this.returnFinalePending) return null;
    const marker = this.openingObjective()?.metadata?.marker;
    return marker ? { ...marker } : null;
  }

  isNear(point) {
    if (!point || this.scene.currentLayer !== point.layer) return false;
    return this.distanceTo(point) <= point.radius;
  }

  distanceTo(point) {
    return Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y);
  }

  destroy() {
    this.scene.events?.off?.("combat:entity-neutralized", this.onNeutralized);
    this.cleanTheSceneSystem?.destroy?.();
    for (const dispose of this.disposers.splice(0)) dispose?.();
  }
}
