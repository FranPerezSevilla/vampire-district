import {
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_REFUGES,
  MISSION_STATUS,
  OBJECTIVE_STATUS
} from "./constants.js";
import { CLEAN_THE_SCENE_ID } from "./missions/cleanTheScene.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const FALLBACK_PLACEMENTS = Object.freeze({
  serviceAlley: Object.freeze({ x: 650, y: 510, layer: 0, radius: 86, label: "SCENE" }),
  cameraRoll: Object.freeze({ x: 622, y: 505, layer: 0, radius: 26, label: "ROLL" }),
  exposedBody: Object.freeze({ x: 704, y: 506, layer: 0, radius: 28, label: "BODY" }),
  refuge: Object.freeze({ x: 150, y: 146, layer: 2, radius: 58, label: "REPORT" })
});

function completed(record, objectiveId) {
  return record?.objectives?.[objectiveId]?.status === OBJECTIVE_STATUS.COMPLETED;
}

export class CleanTheSceneSystem {
  constructor(scene, campaign, host) {
    if (!scene || !campaign || !host) {
      throw new TypeError("CleanTheSceneSystem requires the scene, CampaignSystem and MissionSystem host.");
    }
    this.scene = scene;
    this.campaign = campaign;
    this.host = host;
    this.cameraRoll = null;
    this.onBodyHidden = payload => this.handleBodyHidden(payload);
    scene.events?.on?.("evidence:body-hidden", this.onBodyHidden);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  definition() {
    return this.campaign.missions.definition(CLEAN_THE_SCENE_ID);
  }

  record() {
    return this.campaign.missions.record(CLEAN_THE_SCENE_ID);
  }

  isActive() {
    return this.campaign.state.missions.activeMissionId === CLEAN_THE_SCENE_ID
      && this.record()?.status === MISSION_STATUS.ACTIVE;
  }

  currentObjective() {
    return this.isActive() ? this.campaign.missions.currentObjective() : null;
  }

  placements() {
    return {
      ...FALLBACK_PLACEMENTS,
      ...(this.definition()?.metadata?.placements || {})
    };
  }

  get step() {
    const record = this.record();
    const total = this.definition()?.objectives?.length || 5;
    if (record?.status === MISSION_STATUS.COMPLETED) return total;
    return record?.status === MISSION_STATUS.ACTIVE
      ? Math.min(total, Math.max(1, Number(record.objectiveIndex) + 1))
      : 0;
  }

  update() {
    this.syncWorld();
    if (!this.isActive()) return;
    const objective = this.currentObjective();
    if (!objective) return;

    if (objective.id === "reach_service_alley" && this.isNear(this.marker())) {
      this.host.nextActionText = "The compromised scene is ahead. Recover the camera roll before a patrol does.";
      this.campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "club_service_alley" });
      return;
    }

    if (objective.id === "lose_police_attention") {
      const wantedLevel = this.scene.exposureSystem?.level?.() || 0;
      const witnesses = this.scene.witnessSystem?.alarmedWitnesses?.().length || 0;
      if (wantedLevel <= 0 && witnesses <= 0) {
        this.host.nextActionText = "Police attention fades. Return to the rooftop refuge for payment.";
        this.campaign.handle(CAMPAIGN_EVENT_TYPES.WANTED_CHANGED, { level: 0 });
      }
      return;
    }

    if (objective.id === "return_to_refuge" && this.isNear(this.marker())) this.completeAtRefuge();
  }

  collectInteractions() {
    if (!this.isActive()) return [];
    const objective = this.currentObjective();
    if (objective?.id !== "collect_compromised_evidence") return [];
    const point = this.placements().cameraRoll;
    if (this.scene.currentLayer !== point.layer) return [];
    const distance = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y);
    if (distance > point.radius) return [];
    return [{
      id: "collect_compromised_camera_roll",
      type: "mission",
      label: "Recover compromised camera roll",
      detail: "mission evidence · raises police attention",
      priority: 132,
      distance,
      x: point.x,
      y: point.y,
      run: () => this.collectCameraRoll()
    }];
  }

  collectCameraRoll() {
    if (this.currentObjective()?.id !== "collect_compromised_evidence") return false;
    this.host.nextActionText = "CAMERA ROLL SECURED: remove the exposed body before the patrol closes in.";
    const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.COLLECTED, {
      targetId: "compromised_camera_roll",
      itemId: "compromised_camera_roll"
    });
    const exposure = this.scene.exposureSystem;
    if (exposure && exposure.value < 32) {
      exposure.add(32 - exposure.value, "Recovering the camera roll draws a patrol toward the service alley.");
    }
    RawAudio.play("confirm");
    this.syncWorld();
    return handled;
  }

  handleBodyHidden(payload = {}) {
    if (!this.isActive() || this.currentObjective()?.id !== "remove_exposed_body") return false;
    if (payload.targetId !== "exposed_body") return false;
    this.host.nextActionText = "BODY REMOVED: stay hidden until the police search loses momentum.";
    const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.DESTROYED, {
      targetId: "exposed_body",
      entityId: "exposed_body",
      outcome: payload.method || "hidden"
    });
    this.syncWorld();
    return handled;
  }

  completeAtRefuge() {
    if (this.currentObjective()?.id !== "return_to_refuge") return false;
    this.host.nextActionText = "CLEANUP COMPLETE: the compromised evidence has disappeared.";
    const handled = this.campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
      refugeId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE
    });
    if (!handled || this.record()?.status !== MISSION_STATUS.COMPLETED) return false;

    RawAudio.play("missionComplete");
    this.scene.campaignCheckpointSystem?.saveCompletionNow?.(CLEAN_THE_SCENE_ID);
    this.host.publishResult(
      "complete",
      "SCENE CONTAINED",
      "The Directorate confirms the evidence is gone and releases your payment.",
      {
        missionId: CLEAN_THE_SCENE_ID,
        actionLabel: "Return to contract board · Enter/Esc"
      }
    );
    this.scene.events?.emit?.("mission-board:contract-completed", {
      missionId: CLEAN_THE_SCENE_ID,
      cash: this.definition()?.rewards?.cash || 0
    });
    this.scene.redrawLayer?.(this.scene.lastActionText);
    this.syncWorld();
    return true;
  }

  marker() {
    if (!this.isActive()) return null;
    const objective = this.currentObjective();
    const marker = objective?.metadata?.marker;
    return marker ? { ...marker } : null;
  }

  activeTaskText() {
    const record = this.record();
    if (record?.status === MISSION_STATUS.FAILED) return `FAILED · ${record.failureReason || "The cleanup collapsed."}`;
    if (record?.status === MISSION_STATUS.COMPLETED) return "COMPLETE · The service-alley scene is contained.";
    const objective = this.currentObjective();
    return objective ? `Active Task: ${objective.label}.` : "No active cleanup task.";
  }

  objectiveText() {
    const record = this.record();
    const total = this.definition()?.objectives?.length || 5;
    if (record?.status === MISSION_STATUS.FAILED) return `FAILED · ${record.failureReason || "The cleanup collapsed."}`;
    if (record?.status === MISSION_STATUS.COMPLETED) return "COMPLETE · Clean the Scene contained.";
    const objective = this.currentObjective();
    if (!objective) return "Clean the Scene · awaiting objective.";
    return `${this.step}/${total} ${objective.label}.`;
  }

  actionTextForCurrentState(eventType = "") {
    const record = this.record();
    if (eventType === "mission:failed") return `MISSION FAILED: ${record?.failureReason || "The cleanup operation is over."}`;
    if (record?.status === MISSION_STATUS.COMPLETED) return "CLEANUP COMPLETE: return to the contract board.";
    switch (this.currentObjective()?.id) {
      case "collect_compromised_evidence": return "Locate and recover the compromised camera roll.";
      case "remove_exposed_body": return "Camera roll secured. Hide the exposed body in a disposal point.";
      case "lose_police_attention": return "The body is contained. Break line of sight and let police attention fall to zero.";
      case "return_to_refuge": return "The search has cooled. Return to the rooftop refuge.";
      default: return "Reach the club service alley and inspect the compromised scene.";
    }
  }

  syncWorld() {
    const record = this.record();
    const definition = this.definition();
    const cameraPoint = this.placements().cameraRoll;
    const bodyPoint = this.placements().exposedBody;
    const cameraCollected = completed(record, "collect_compromised_evidence");
    const bodyRemoved = completed(record, "remove_exposed_body");
    const missionPresent = Boolean(record && [
      MISSION_STATUS.ACTIVE,
      MISSION_STATUS.FAILED,
      MISSION_STATUS.COMPLETED
    ].includes(record.status));

    const camera = this.ensureCameraRoll(cameraPoint);
    camera?.setVisible?.(Boolean(record?.status === MISSION_STATUS.ACTIVE && !cameraCollected));

    const body = this.scene.npcSystem?.npcs?.find?.(npc => npc.id === "exposed_body");
    if (body) {
      body.x = Number(bodyPoint.x) || body.x;
      body.y = Number(bodyPoint.y) || body.y;
      body.layer = Number.isFinite(Number(bodyPoint.layer)) ? Number(bodyPoint.layer) : body.layer;
      body.container?.setPosition?.(body.x, body.y);
      if (missionPresent) {
        body.inactive = false;
        if (!body.dead) this.scene.npcSystem?.markDead?.(body, "killed");
        body.hiddenBody = bodyRemoved || record.status === MISSION_STATUS.COMPLETED;
        body.dragged = false;
        body.corpseDiscovered = false;
      } else {
        body.inactive = true;
        body.hiddenBody = true;
      }
      body.container?.setVisible?.(
        !body.inactive && !body.hiddenBody && body.layer === this.scene.currentLayer
      );
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    return Boolean(definition);
  }

  ensureCameraRoll(point) {
    if (this.cameraRoll || !this.scene.add?.container) return this.cameraRoll;
    const container = this.scene.add.container(point.x, point.y).setDepth(44);
    const shadow = this.scene.add.rectangle(0, 5, 16, 4, 0x000000, 0.38);
    const roll = this.scene.add.rectangle(0, 0, 13, 9, 0x5b4430, 1).setStrokeStyle(1, 0xffcf87);
    const lens = this.scene.add.circle(2, 0, 2, 0xf4ecff, 0.9);
    const label = this.scene.add.text(10, -13, "CAMERA ROLL", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffcf87",
      backgroundColor: "rgba(0,0,0,.55)",
      padding: { x: 2, y: 1 }
    });
    container.add([shadow, roll, lens, label]);
    this.cameraRoll = container;
    return container;
  }

  isNear(point) {
    if (!point || this.scene.currentLayer !== point.layer) return false;
    return Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y)
      <= (point.radius || 28);
  }

  destroy() {
    this.scene.events?.off?.("evidence:body-hidden", this.onBodyHidden);
    this.cameraRoll?.destroy?.(true);
    this.cameraRoll = null;
  }
}
