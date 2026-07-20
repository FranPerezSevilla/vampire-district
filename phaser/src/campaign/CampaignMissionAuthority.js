import { LAYERS } from "../data/district.js";
import { CampaignHudSystem } from "./CampaignHudSystem.js";
import { MISSION_STATUS } from "./constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

const CHECKPOINT_LOCATIONS = Object.freeze({
  rooftop_refuge: Object.freeze({ layer: LAYERS.ROOF_HIGH, x: 150, y: 146 }),
  police_roof: Object.freeze({ layer: LAYERS.ROOF_LOW, x: 775, y: 150 }),
  nightclub_district: Object.freeze({ layer: LAYERS.STREET, x: 642, y: 404 })
});

const RESTORABLE_OBJECTIVES = new Set([
  "reach_nightclub",
  "neutralize_journalist",
  "return_to_refuge"
]);

export class CampaignMissionAuthority {
  constructor(scene, campaign) {
    if (!scene || !campaign) throw new TypeError("CampaignMissionAuthority requires the game scene and CampaignSystem.");
    this.scene = scene;
    this.campaign = campaign;
    this.disposers = [];
    this.restoredCheckpoint = false;
    this.onCampaignChanged = () => this.publish();

    this.ensureOpeningMission();
    scene.missionSystem?.attachCampaign?.(campaign);
    this.hud = new CampaignHudSystem(campaign);

    for (const type of [
      "mission:started",
      "mission:objective-activated",
      "mission:objective-completed",
      "mission:completed",
      "mission:failed",
      "mission:metadata-changed",
      "checkpoint:captured",
      "wallet:changed",
      "reputation:changed"
    ]) {
      this.disposers.push(campaign.events.on(type, this.onCampaignChanged));
    }

    this.restoreOpeningCheckpoint();
    this.publish();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  ensureOpeningMission() {
    const active = this.campaign.missions.activeRecord();
    if (active) return active;

    const record = this.campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
    return this.campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
      replay: Boolean(record),
      metadata: {
        integration: "journalist_vertical_slice",
        standaloneReplay: record?.status === MISSION_STATUS.COMPLETED
      }
    });
  }

  restoreOpeningCheckpoint() {
    if (this.campaign.state.missions.activeMissionId !== SILENCE_THE_JOURNALIST_ID) return false;
    const objective = this.campaign.missions.currentObjective();
    if (!objective || !RESTORABLE_OBJECTIVES.has(objective.id)) return false;

    const checkpoint = this.campaign.checkpoints.snapshot();
    const location = CHECKPOINT_LOCATIONS[checkpoint?.locationId]
      || CHECKPOINT_LOCATIONS[objective.id === "reach_nightclub" ? "police_roof" : "nightclub_district"];
    if (!location) return false;

    this.restoreCompletedTutorialState();
    this.scene.missionSystem.rooftopJumps = Math.max(3, this.scene.missionSystem.rooftopJumps || 0);
    this.scene.missionSystem.tipCollected = true;
    this.restoreResolvedRooftopBlocker();
    this.restoreDepartedInformant();
    if (objective.id === "return_to_refuge") this.restoreJournalistOutcome();

    this.scene.switchLayer(
      location.layer,
      { x: location.x, y: location.y },
      `Campaign checkpoint restored: ${objective.label}.`
    );
    this.scene.missionSystem?.syncFromCampaign?.({ emit: false });
    this.scene.npcSystem?.refreshVisibility?.();
    this.restoredCheckpoint = true;
    this.scene.events?.emit?.("campaign:checkpoint-restored", {
      checkpointId: checkpoint?.id || null,
      missionId: SILENCE_THE_JOURNALIST_ID,
      objectiveId: objective.id,
      locationId: checkpoint?.locationId || null
    });
    return true;
  }

  restoreCompletedTutorialState() {
    const director = this.scene.tutorialDirector;
    if (!director) return;
    director.started = true;
    director.introPromise ||= Promise.resolve();
    director.finalAdviceShown = true;
    director.busy = false;
    director.finishTutorial?.();
    director.uiScene?.closeIntro?.();
  }

  restoreResolvedRooftopBlocker() {
    const thug = this.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug");
    if (thug && !thug.dead) this.scene.npcSystem.markFed(thug);
  }

  restoreDepartedInformant() {
    const informant = this.scene.npcSystem?.npcs?.find(npc => npc.id === "police_roof_informant");
    if (!informant) return;
    informant.inactive = true;
    informant.vx = 0;
    informant.vy = 0;
    informant.container?.setAlpha?.(0).setVisible?.(false);
  }

  restoreJournalistOutcome() {
    const record = this.campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
    const outcome = record?.objectives?.neutralize_journalist?.outcome || "killed";
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    if (journalist && !journalist.dead) {
      if (outcome === "drained") this.scene.npcSystem.markFed(journalist);
      else this.scene.npcSystem.markKilled(journalist);
    }
    if (this.scene.feedingSystem?.stats) {
      this.scene.feedingSystem.stats.targetHandled = true;
      this.scene.feedingSystem.stats.targetFed = outcome === "drained";
    }
  }

  publish() {
    const snapshot = this.campaign.snapshot();
    const active = snapshot.activeMission;
    const values = {
      campaignState: snapshot.state,
      campaignMission: active,
      campaignCheckpoint: snapshot.checkpoint,
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
    this.scene.missionSystem?.detachCampaign?.();
    for (const dispose of this.disposers.splice(0)) dispose?.();
    this.hud?.destroy?.();
  }
}
