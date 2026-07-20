import { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } from "./constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

export class CampaignRuntimeBridge {
  constructor(scene, campaign) {
    if (!scene || !campaign) throw new TypeError("CampaignRuntimeBridge requires the game scene and CampaignSystem.");
    this.scene = scene;
    this.campaign = campaign;
    this.disposers = [];
    this.onStepChanged = payload => this.syncLegacyStep(payload?.step);
    this.onNeutralized = payload => this.handleNeutralized(payload);
    this.onMissionResult = (_parent, result) => this.handleMissionResult(result);
    this.onCampaignChanged = () => this.publish();

    scene.events?.on?.("mission:step-changed", this.onStepChanged);
    scene.events?.on?.("combat:entity-neutralized", this.onNeutralized);
    scene.registry?.events?.on?.("changedata-missionResult", this.onMissionResult);
    this.disposers.push(campaign.events.on("mission:started", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("mission:objective-activated", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("mission:objective-completed", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("mission:completed", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("mission:failed", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("wallet:changed", this.onCampaignChanged));
    this.disposers.push(campaign.events.on("reputation:changed", this.onCampaignChanged));

    this.ensureOpeningMission();
    this.syncLegacyStep(scene.missionSystem?.step || 0);
    this.publish();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  ensureOpeningMission() {
    const record = this.campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
    const active = this.campaign.missions.activeRecord();
    if (active) return;
    if (record?.status === MISSION_STATUS.COMPLETED) return;
    this.campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
      replay: Boolean(record),
      metadata: { integration: "journalist_vertical_slice" }
    });
  }

  syncLegacyStep(stepValue) {
    if (!this.isOpeningMissionActive()) return;
    const step = Math.max(0, Math.trunc(Number(stepValue) || 0));
    if (step >= 1) {
      this.completeCurrent("reach_police_roof", CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
      this.completeCurrent("speak_to_informant", CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
    }
    if (step >= 2) {
      this.completeCurrent("reach_nightclub", CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
    }
    if (step >= 3) this.syncJournalistOutcome();
    if (step >= 4) {
      this.completeCurrent("return_to_refuge", CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" });
    }
    this.publish();
  }

  handleNeutralized(payload = {}) {
    if (!this.isOpeningMissionActive() || payload.targetId !== "journalist") return;
    const outcome = payload.kind === "drained" ? "drained" : payload.kind === "killed" ? "killed" : null;
    if (!outcome) return;
    this.completeCurrent("neutralize_journalist", CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
      targetId: "journalist",
      outcome
    });
    this.publish();
  }

  syncJournalistOutcome() {
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    const outcome = journalist?.deathKind === "drained"
      ? "drained"
      : journalist?.deathKind === "killed"
        ? "killed"
        : this.scene.feedingSystem?.stats?.targetFed
          ? "drained"
          : this.scene.feedingSystem?.stats?.targetHandled
            ? "killed"
            : null;
    if (!outcome) return false;
    return this.completeCurrent("neutralize_journalist", CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
      targetId: "journalist",
      outcome
    });
  }

  handleMissionResult(result) {
    if (!this.isOpeningMissionActive() || !result) return;
    if (result.status === "failed") {
      this.campaign.failActiveMission(result.subtitle || result.title || "The operation failed.", {
        source: "vertical_slice"
      });
      this.publish();
      return;
    }
    if (result.status === "complete") this.syncLegacyStep(4);
  }

  completeCurrent(expectedObjectiveId, eventType, payload) {
    const objective = this.campaign.missions.currentObjective();
    if (!objective || objective.id !== expectedObjectiveId) return false;
    return this.campaign.handle(eventType, payload);
  }

  isOpeningMissionActive() {
    return this.campaign.state.missions.activeMissionId === SILENCE_THE_JOURNALIST_ID;
  }

  publish() {
    const snapshot = this.campaign.snapshot();
    const active = snapshot.activeMission;
    const values = {
      campaignState: snapshot.state,
      campaignMission: active,
      cashText: `Cash $${snapshot.wallet.balance.toFixed(0)}`,
      campaignText: this.campaign.summary(),
      factionReputation: snapshot.reputation.factions,
      contactReputation: snapshot.reputation.contacts
    };
    this.scene.statePublisher?.setMany?.(values);
    if (!this.scene.statePublisher) {
      for (const [key, value] of Object.entries(values)) this.scene.registry?.set?.(key, value);
    }
  }

  destroy() {
    this.scene.events?.off?.("mission:step-changed", this.onStepChanged);
    this.scene.events?.off?.("combat:entity-neutralized", this.onNeutralized);
    this.scene.registry?.events?.off?.("changedata-missionResult", this.onMissionResult);
    for (const dispose of this.disposers.splice(0)) dispose?.();
  }
}
