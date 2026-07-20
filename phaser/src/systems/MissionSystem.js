import { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } from "../campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../campaign/missions/silenceTheJournalist.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "./RawAudioSystem.js";

const REQUIRED_ROOFTOP_JUMPS = 3;

const OBJECTIVE_POINTS = Object.freeze({
  policeRoofTip: { x: 775, y: 150, layer: LAYERS.ROOF_LOW, radius: 34 },
  club: { x: 642, y: 404, layer: LAYERS.STREET, radius: 96 },
  journalist: { x: 588, y: 360, layer: LAYERS.STREET, radius: 34 },
  refuge: { x: 150, y: 146, layer: LAYERS.ROOF_HIGH, radius: 58 }
});

const CAMPAIGN_STEP_BY_OBJECTIVE = Object.freeze({
  reach_police_roof: 0,
  speak_to_informant: 0,
  reach_nightclub: 1,
  neutralize_journalist: 2,
  return_to_refuge: 3
});

export const RETURN_FINALE_COPY = Object.freeze({
  speaker: "YOUR SIRE · IN YOUR MIND",
  segments: Object.freeze([
    "Well done. You silenced the journalist and returned as ordered.",
    "The veil holds. You have served me well tonight."
  ]),
  reportTitle: "REPORT ACCEPTED",
  reportSubtitle: "Your sire accepts the night's work."
});

export class MissionSystem {
  constructor(scene) {
    this.scene = scene;
    this.step = 0;
    this.completed = false;
    this.failed = false;
    this.failureReason = "";
    this.rooftopJumps = 0;
    this.tipCollected = false;
    this.resultPublished = false;
    this.returnFinalePending = false;
    this.returnFinalePromise = null;
    this.lastMissionText = "Cross the rooftops, reach the police station roof and obtain the journalist's location.";
    this.campaign = null;
    this.campaignMissionId = SILENCE_THE_JOURNALIST_ID;
    this.campaignDisposers = [];
  }

  attachCampaign(campaign) {
    if (!campaign?.missions || !campaign?.events) throw new TypeError("MissionSystem.attachCampaign requires CampaignSystem.");
    if (this.campaign === campaign) return this;
    this.detachCampaign();
    this.campaign = campaign;
    for (const type of [
      "mission:started",
      "mission:objective-completed",
      "mission:objective-activated",
      "mission:completed",
      "mission:failed",
      "mission:metadata-changed"
    ]) {
      this.campaignDisposers.push(campaign.events.on(type, event => {
        if (event.payload?.missionId && event.payload.missionId !== this.campaignMissionId) return;
        this.syncFromCampaign({ emit: true });
      }));
    }
    this.syncFromCampaign({ emit: false });
    return this;
  }

  detachCampaign() {
    for (const dispose of this.campaignDisposers.splice(0)) dispose?.();
    this.campaign = null;
  }

  campaignRecord() {
    return this.campaign?.state?.missions?.records?.[this.campaignMissionId] || null;
  }

  campaignDefinition() {
    return this.campaign?.missions?.definition?.(this.campaignMissionId) || null;
  }

  campaignObjective() {
    if (!this.campaign || this.campaign.state.missions.activeMissionId !== this.campaignMissionId) return null;
    return this.campaign.missions.currentObjective();
  }

  campaignStep() {
    const record = this.campaignRecord();
    if (!record) return this.step;
    if (record.status === MISSION_STATUS.COMPLETED) return 4;
    const objective = this.campaignObjective()
      || this.campaignDefinition()?.objectives?.[record.objectiveIndex]
      || null;
    return objective ? CAMPAIGN_STEP_BY_OBJECTIVE[objective.id] ?? this.step : this.step;
  }

  syncFromCampaign({ emit = true, actionText = null } = {}) {
    if (!this.campaign) return false;
    const record = this.campaignRecord();
    if (!record) return false;

    const previousStep = this.step;
    const nextStep = this.campaignStep();
    this.step = nextStep;
    this.completed = record.status === MISSION_STATUS.COMPLETED;
    this.failed = record.status === MISSION_STATUS.FAILED;
    this.failureReason = record.failureReason || "";
    this.rooftopJumps = Math.max(
      0,
      Number(record.metadata?.rooftopJumps) || (record.objectiveIndex > 0 ? REQUIRED_ROOFTOP_JUMPS : this.rooftopJumps || 0)
    );
    this.tipCollected = Boolean(
      record.objectives?.speak_to_informant?.status === "completed"
      || nextStep >= 1
      || this.completed
    );
    this.lastMissionText = this.missionTextForStep(nextStep);
    this.syncJournalistVisibility();

    if (actionText) this.scene.lastActionText = actionText;
    if (emit && previousStep !== nextStep) {
      const resolvedAction = actionText || this.actionTextForStep(nextStep);
      if (resolvedAction) this.scene.lastActionText = resolvedAction;
      this.scene.events?.emit?.("mission:step-changed", {
        previousStep,
        step: nextStep,
        missionText: this.lastMissionText,
        actionText: this.scene.lastActionText
      });
      this.scene.redrawLayer?.(this.scene.lastActionText);
    }
    return previousStep !== nextStep;
  }

  missionTextForStep(step) {
    if (this.failed) return `FAILED · ${this.failureReason || "The run is over."}`;
    if (this.completed || step >= 4) return "Report accepted. The veil still holds.";
    if (step === 0) return "Cross the rooftops, reach the police station roof and obtain the journalist's location.";
    if (step === 1) return "Tip acquired: the journalist is outside the pink-lit nightclub. Reach the club district by roof, street or sewer.";
    if (step === 2) return "Locate and neutralize the journalist outside the nightclub. Weapons or draining can solve the objective, but public feeding risks the veil.";
    if (step === 3) return "Journalist handled. Return to the rooftop refuge to report before the veil collapses.";
    return this.lastMissionText;
  }

  actionTextForStep(step) {
    if (step === 1) return "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify them.";
    if (step === 2) return "You reach the nightclub district. The journalist is nearby.";
    if (step === 3) return "Journalist handled. Return to the rooftop refuge to report.";
    if (step >= 4) return "ORDER COMPLETE: the journalist is handled and the clan's veil still holds.";
    return this.scene.lastActionText || "";
  }

  update() {
    this.syncJournalistVisibility();
    if (this.completed || this.failed) return;

    if (this.campaign) {
      const objective = this.campaignObjective();
      if (objective?.id === "reach_nightclub" && this.isNear(OBJECTIVE_POINTS.club)) {
        this.campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
      }
      if (objective?.id === "return_to_refuge" && this.isNear(OBJECTIVE_POINTS.refuge) && !this.returnFinalePending) {
        this.beginReturnFinale();
      }
      return;
    }

    if (this.step === 1 && this.isNear(OBJECTIVE_POINTS.club)) {
      this.setStep(
        2,
        "Locate and neutralize the journalist outside the nightclub. Weapons or draining can solve the objective, but public feeding risks the veil.",
        "You reach the nightclub district. The journalist is nearby."
      );
    }

    if (this.step === 3 && this.isNear(OBJECTIVE_POINTS.refuge) && !this.returnFinalePending) {
      this.beginReturnFinale();
    }
  }

  returnObjectiveActive() {
    return this.campaign
      ? this.campaignObjective()?.id === "return_to_refuge"
      : this.step === 3;
  }

  beginReturnFinale() {
    if (this.returnFinalePending || this.completed || this.failed || !this.returnObjectiveActive()) return false;
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

      if (this.failed || this.completed || !this.returnObjectiveActive()) return false;
      this.completeMission();
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
    if (this.completed || this.failed || !this.returnObjectiveActive()) return false;
    const previousStep = this.step;

    if (this.campaign) {
      const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
        refugeId: "rooftop_refuge"
      });
      this.syncFromCampaign({ emit: true });
      if (!handled || !this.completed) return false;
    } else {
      this.step = 4;
      this.completed = true;
      this.lastMissionText = "Report accepted. The veil still holds.";
      this.scene.events?.emit?.("mission:step-changed", {
        previousStep,
        step: this.step,
        missionText: this.lastMissionText,
        actionText: this.scene.lastActionText
      });
    }

    this.scene.lastActionText = "ORDER COMPLETE: the journalist is handled and the clan's veil still holds.";
    RawAudio.play("missionComplete");
    this.scene.events?.emit?.("mission:return-finale-completed", {
      previousStep,
      step: this.step
    });
    this.publishResult(
      "complete",
      RETURN_FINALE_COPY.reportTitle,
      RETURN_FINALE_COPY.reportSubtitle
    );
    this.scene.redrawLayer(this.scene.lastActionText);
    return true;
  }

  syncJournalistVisibility() {
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    if (!journalist || journalist.dead || journalist.intercepted) return;
    const objectiveId = this.campaignObjective()?.id;
    const shouldHide = this.campaign
      ? ["reach_police_roof", "speak_to_informant"].includes(objectiveId)
      : !this.tipCollected && this.step === 0;
    if (journalist.inactive !== shouldHide) {
      journalist.inactive = shouldHide;
      journalist.container?.setVisible(!shouldHide && journalist.layer === this.scene.currentLayer);
      this.scene.npcSystem?.rebuildSpatialIndex?.();
    }
  }

  onRooftopJump() {
    if (this.completed || this.failed || this.step !== 0) return;
    this.rooftopJumps++;
    this.campaign?.missions?.updateMetadata?.({ rooftopJumps: this.rooftopJumps });
    if (this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS) {
      this.scene.lastActionText = `Rooftop route committed: ${this.rooftopJumps}/${REQUIRED_ROOFTOP_JUMPS} jumps before the informant trusts you.`;
    } else {
      this.scene.lastActionText = "Rooftop route validated. Neutralize the roof thug if needed, then reach the police station roof.";
    }
  }

  collectPoliceRoofTip() {
    if (this.completed || this.failed || this.step !== 0) return false;
    if (this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS) {
      const missing = REQUIRED_ROOFTOP_JUMPS - this.rooftopJumps;
      this.scene.lastActionText = `The informant refuses to talk yet. Stay on the rooftop route: ${missing} more rooftop jump(s).`;
      RawAudio.play("cancel");
      return false;
    }

    if (this.campaign) {
      if (this.campaignObjective()?.id === "reach_police_roof") {
        this.campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
      }
      if (this.campaignObjective()?.id === "speak_to_informant") {
        this.campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
      }
      this.syncFromCampaign({
        emit: true,
        actionText: "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify them."
      });
    } else {
      this.tipCollected = true;
      this.setStep(
        1,
        "Tip acquired: the journalist is outside the pink-lit nightclub. Reach the club district by roof, street or sewer.",
        "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify them."
      );
    }

    this.tipCollected = true;
    RawAudio.play("confirm");
    this.syncJournalistVisibility();
    this.scene.npcSystem?.refreshVisibility?.();
    return true;
  }

  setStep(step, missionText, actionText) {
    if (this.campaign) return this.syncFromCampaign({ emit: true, actionText });
    const previousStep = this.step;
    this.step = step;
    this.lastMissionText = missionText;
    this.scene.lastActionText = actionText;
    RawAudio.play("confirm");
    this.scene.redrawLayer(actionText);
    if (step !== previousStep) {
      this.scene.events?.emit?.("mission:step-changed", {
        previousStep,
        step,
        missionText,
        actionText
      });
    }
    return true;
  }

  collectInteractions() {
    const actions = [];
    if (this.failed || this.completed || this.returnFinalePending) return actions;

    if (this.step === 0 && this.isNear(OBJECTIVE_POINTS.policeRoofTip)) {
      const ready = this.rooftopJumps >= REQUIRED_ROOFTOP_JUMPS;
      actions.push({
        id: "mission_collect_police_roof_tip",
        type: "mission",
        label: ready ? "Collect rooftop tip" : "Ask rooftop informant",
        detail: ready ? "reveals journalist location" : `${this.rooftopJumps}/${REQUIRED_ROOFTOP_JUMPS} rooftop jumps completed`,
        priority: 130,
        distance: this.distanceTo(OBJECTIVE_POINTS.policeRoofTip),
        x: OBJECTIVE_POINTS.policeRoofTip.x,
        y: OBJECTIVE_POINTS.policeRoofTip.y,
        run: () => this.collectPoliceRoofTip()
      });
    }

    if (this.step === 2 && this.isNear(OBJECTIVE_POINTS.journalist) && !this.scene.feedingSystem?.stats.targetHandled) {
      actions.push({
        id: "mission_placeholder_journalist",
        type: "mission",
        label: "Assess journalist",
        detail: "use an equipped weapon or drain a valid target",
        priority: 15,
        distance: this.distanceTo(OBJECTIVE_POINTS.journalist),
        x: OBJECTIVE_POINTS.journalist.x,
        y: OBJECTIVE_POINTS.journalist.y,
        run: () => {
          RawAudio.play("menu");
          this.scene.lastActionText = "The journalist is close. Isolate them, attack with the equipped weapon, or drain when vulnerable.";
        }
      });
    }
    return actions;
  }

  resolveJournalistPlaceholder(actionText = "Journalist handled. Return to the rooftop refuge to report.", outcome = null) {
    if (this.failed || this.step !== 2) return false;
    const resolvedOutcome = outcome
      || (/drain/i.test(actionText) || this.scene.feedingSystem?.stats?.targetFed ? "drained" : "killed");

    if (this.campaign) {
      if (this.campaignObjective()?.id !== "neutralize_journalist") return false;
      const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
        targetId: "journalist",
        outcome: resolvedOutcome
      });
      if (!handled) return false;
      this.scene.lastActionText = actionText;
      this.syncFromCampaign({ emit: true, actionText });
      this.scene.redrawLayer(actionText);
      return true;
    }

    this.setStep(3, "Journalist handled. Return to the rooftop refuge to report before the veil collapses.", actionText);
    return true;
  }

  failRun(reason, {
    title = "MISSION FAILED",
    missionText = "FAILED · The run is over.",
    audio = "masqueradeFail"
  } = {}) {
    if (this.completed || this.failed) return;
    this.returnFinalePending = false;
    if (this.campaign) {
      this.campaign.failActiveMission(reason, { source: title.toLowerCase().replaceAll(" ", "_") });
      this.syncFromCampaign({ emit: true });
    } else {
      this.failed = true;
      this.failureReason = reason;
      this.lastMissionText = missionText;
    }
    this.failed = true;
    this.failureReason = reason;
    this.lastMissionText = missionText;
    this.scene.lastActionText = `${title}: ${reason}`;
    RawAudio.play(audio);
    this.publishResult("failed", title, reason);
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  failMasquerade(reason = "The veil is broken.") {
    this.failRun(reason, {
      title: "MISSION FAILED",
      missionText: "FAILED · The veil is broken. The clan cannot contain the story now.",
      audio: "masqueradeFail"
    });
  }

  failArrest(reason = "Police surround and detain you.") {
    this.failRun(reason, {
      title: "DETAINED",
      missionText: "FAILED · You have been detained by the police.",
      audio: "police"
    });
  }

  publishResult(status, title, subtitle) {
    if (this.resultPublished) return;
    this.resultPublished = true;
    const result = {
      status,
      title,
      subtitle,
      stats: this.resultStats()
    };
    this.scene.statePublisher?.set?.("missionResult", result)
      || this.scene.registry.set("missionResult", result);
  }

  resultStats() {
    return {
      task: this.activeTaskText(),
      rooftopJumps: this.rooftopJumps,
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
    if (this.failed) return `FAILED · ${this.failureReason || "The run is over."}`;
    if (this.completed) return "COMPLETE · Report accepted by the clan.";
    if (this.returnFinalePending) return "Active Task: report to your sire.";
    if (this.step === 0) return `Active Task: rooftop route to police roof · jumps ${Math.min(this.rooftopJumps, REQUIRED_ROOFTOP_JUMPS)}/${REQUIRED_ROOFTOP_JUMPS} · neutralize the blocker and collect the informant tip.`;
    if (this.step === 1) return "Active Task: reach the nightclub district. The journalist is now revealed.";
    if (this.step === 2) return "Active Task: isolate and neutralize the journalist. Avoid public draining; it can tear the veil.";
    if (this.step === 3) return "Active Task: return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  objectiveText() {
    if (this.failed) return `FAILED · ${this.failureReason || "The run is over."}`;
    if (this.completed) return "COMPLETE · Report to the clan validated.";
    if (this.returnFinalePending) return "4/4 Reporting to your sire.";
    if (this.step === 0) return "1/4 Vampire route: jump across roofs, beat the blocker and reach the police roof tip.";
    if (this.step === 1) return "2/4 Tip acquired: reach the nightclub by street, roof routes or sewers.";
    if (this.step === 2) return "3/4 Neutralize the journalist. Public draining can break the veil.";
    if (this.step === 3) return "4/4 Return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  marker() {
    if (this.completed || this.failed || this.returnFinalePending) return null;
    if (this.step === 0) return { ...OBJECTIVE_POINTS.policeRoofTip, label: "TIP", radius: 28 };
    if (this.step === 1) return { ...OBJECTIVE_POINTS.club, label: "CLUB" };
    if (this.step === 2) return { ...OBJECTIVE_POINTS.journalist, label: "TARGET" };
    if (this.step === 3) return { ...OBJECTIVE_POINTS.refuge, label: "REPORT" };
    return null;
  }

  isNear(point) {
    if (!point || this.scene.currentLayer !== point.layer) return false;
    return this.distanceTo(point) <= point.radius;
  }

  distanceTo(point) {
    return Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y);
  }
}
