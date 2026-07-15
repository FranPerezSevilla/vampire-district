import { LAYERS } from "../data/district.js";
import { RawAudio } from "./RawAudioSystem.js";

const REQUIRED_ROOFTOP_JUMPS = 3;

const OBJECTIVE_POINTS = Object.freeze({
  policeRoofTip: { x: 775, y: 150, layer: LAYERS.ROOF_LOW, radius: 34 },
  club: { x: 642, y: 404, layer: LAYERS.STREET, radius: 96 },
  journalist: { x: 588, y: 360, layer: LAYERS.STREET, radius: 34 },
  refuge: { x: 150, y: 146, layer: LAYERS.ROOF_HIGH, radius: 58 }
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
    this.lastMissionText = "Cross the rooftops to reach the police station roof and collect a tip.";
  }

  update() {
    this.syncJournalistVisibility();
    if (this.completed || this.failed) return;

    if (this.step === 1 && this.isNear(OBJECTIVE_POINTS.club)) {
      this.setStep(2, "Locate and neutralize the journalist outside the nightclub. Stun, kill or drain are possible, but public draining risks the Masquerade.", "You reach the nightclub district. The journalist is nearby.");
    }

    if (this.step === 3 && this.isNear(OBJECTIVE_POINTS.refuge)) {
      this.step = 4;
      this.completed = true;
      this.lastMissionText = "Report complete. The district remains containable.";
      this.scene.lastActionText = "ORDER COMPLETE: the journalist is handled and the Masquerade still stands.";
      RawAudio.play("missionComplete");
      this.publishResult("complete", "MISSION COMPLETE", "The clan keeps the story contained.");
      this.scene.redrawLayer(this.scene.lastActionText);
    }
  }

  syncJournalistVisibility() {
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    if (!journalist || journalist.dead || journalist.intercepted) return;
    const shouldHide = !this.tipCollected && this.step === 0;
    if (journalist.inactive !== shouldHide) {
      journalist.inactive = shouldHide;
      journalist.container?.setVisible(!shouldHide && journalist.layer === this.scene.currentLayer);
    }
  }

  onRooftopJump() {
    if (this.completed || this.failed || this.step !== 0) return;
    this.rooftopJumps++;
    if (this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS) {
      this.scene.lastActionText = `Rooftop route committed: ${this.rooftopJumps}/${REQUIRED_ROOFTOP_JUMPS} jumps before the informant trusts you.`;
    } else {
      this.scene.lastActionText = "Rooftop route validated. Reach the police station roof and collect the tip.";
    }
  }

  collectPoliceRoofTip() {
    if (this.completed || this.failed || this.step !== 0) return;
    if (this.rooftopJumps < REQUIRED_ROOFTOP_JUMPS) {
      const missing = REQUIRED_ROOFTOP_JUMPS - this.rooftopJumps;
      this.scene.lastActionText = `The informant refuses to talk yet. Stay on the rooftop route: ${missing} more rooftop jump(s).`;
      RawAudio.play("cancel");
      return;
    }

    this.tipCollected = true;
    RawAudio.play("confirm");
    this.setStep(
      1,
      "Tip acquired: the journalist is outside the pink-lit nightclub. Reach the club district by roof, street or sewer.",
      "TIP ACQUIRED: the journalist is near the nightclub. Reach the club and identify them."
    );
    this.syncJournalistVisibility();
    this.scene.npcSystem?.refreshVisibility?.();
  }

  setStep(step, missionText, actionText) {
    this.step = step;
    this.lastMissionText = missionText;
    this.scene.lastActionText = actionText;
    RawAudio.play("confirm");
    this.scene.redrawLayer(actionText);
  }

  collectInteractions() {
    const actions = [];
    if (this.failed || this.completed) return actions;

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
        detail: "choose stun / kill / drain nearby",
        priority: 15,
        distance: this.distanceTo(OBJECTIVE_POINTS.journalist),
        x: OBJECTIVE_POINTS.journalist.x,
        y: OBJECTIVE_POINTS.journalist.y,
        run: () => {
          RawAudio.play("menu");
          this.scene.lastActionText = "The journalist is close. Use E near them to choose Stun, Kill or Drain.";
        }
      });
    }
    return actions;
  }

  resolveJournalistPlaceholder(actionText = "Journalist handled. Return to the rooftop refuge to report.") {
    if (this.failed || this.step !== 2) return;
    this.setStep(3, "Journalist handled. Return to the rooftop refuge to report.", actionText);
  }

  failMasquerade(reason = "Masquerade broken.") {
    if (this.completed || this.failed) return;
    this.failed = true;
    this.failureReason = reason;
    this.lastMissionText = "FAILED · The Masquerade is broken. The clan cannot contain the story now.";
    this.scene.lastActionText = `MISSION FAILED: ${reason}`;
    RawAudio.play("masqueradeFail");
    this.publishResult("failed", "MISSION FAILED", reason);
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  publishResult(status, title, subtitle) {
    if (this.resultPublished) return;
    this.resultPublished = true;
    this.scene.registry.set("missionResult", {
      status,
      title,
      subtitle,
      stats: this.resultStats()
    });
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
      npc: this.scene.npcSystem?.summary?.() || "NPCs unavailable",
      last: this.scene.lastActionText || "--"
    };
  }

  activeTaskText() {
    if (this.failed) return `FAILED · ${this.failureReason || "Masquerade broken."}`;
    if (this.completed) return "COMPLETE · Report accepted by the clan.";
    if (this.step === 0) return `Active Task: rooftop route to police roof · jumps ${Math.min(this.rooftopJumps, REQUIRED_ROOFTOP_JUMPS)}/${REQUIRED_ROOFTOP_JUMPS} · collect the informant tip.`;
    if (this.step === 1) return "Active Task: reach the nightclub district. The journalist is now revealed.";
    if (this.step === 2) return "Active Task: isolate and neutralize the journalist. Avoid public drain.";
    if (this.step === 3) return "Active Task: return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  objectiveText() {
    if (this.failed) return `FAILED · ${this.failureReason || "Masquerade broken."}`;
    if (this.completed) return "COMPLETE · Report to the clan validated.";
    if (this.step === 0) return "1/4 Get the rooftop tip: jump across roofs to the police station roof.";
    if (this.step === 1) return "2/4 Tip acquired: reach the nightclub by street, roof routes, or sewers.";
    if (this.step === 2) return "3/4 Neutralize the journalist: stun, kill or drain. Public drain can break the Masquerade.";
    if (this.step === 3) return "4/4 Return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  marker() {
    if (this.completed || this.failed) return null;
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
