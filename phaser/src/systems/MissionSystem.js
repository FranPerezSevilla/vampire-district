import { LAYERS } from "../data/district.js";

const OBJECTIVE_POINTS = Object.freeze({
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
    this.lastMissionText = "Wake on the rooftop refuge. Leave the roof and reach the nightclub.";
  }

  update() {
    if (this.completed || this.failed) return;

    if (this.step === 0 && this.scene.currentLayer === LAYERS.STREET) {
      this.setStep(1, "Reach the pink-lit nightclub. The journalist is meeting a source nearby.", "Objective updated: reach the nightclub.");
    }

    if (this.step === 1 && this.isNear(OBJECTIVE_POINTS.club)) {
      this.setStep(2, "Neutralize the journalist. Stun, kill or drain are possible, but public draining risks the Masquerade.", "You reach the nightclub district. The journalist is nearby.");
    }

    if (this.step === 3 && this.isNear(OBJECTIVE_POINTS.refuge)) {
      this.step = 4;
      this.completed = true;
      this.lastMissionText = "Report complete. The district remains containable.";
      this.scene.lastActionText = "ORDER COMPLETE: the journalist is handled and the Masquerade still stands.";
      this.scene.redrawLayer(this.scene.lastActionText);
    }
  }

  setStep(step, missionText, actionText) {
    this.step = step;
    this.lastMissionText = missionText;
    this.scene.lastActionText = actionText;
    this.scene.redrawLayer(actionText);
  }

  collectInteractions() {
    const actions = [];
    if (this.failed) return actions;
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
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  objectiveText() {
    if (this.failed) return `FAILED · ${this.failureReason || "Masquerade broken."}`;
    if (this.completed) return "COMPLETE · Report to the clan validated.";
    if (this.step === 0) return "1/4 Leave the rooftop refuge and descend into the district.";
    if (this.step === 1) return "2/4 Reach the nightclub by street, roof routes, or sewers.";
    if (this.step === 2) return "3/4 Neutralize the journalist: stun, kill or drain. Public drain can break the Masquerade.";
    if (this.step === 3) return "4/4 Return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  marker() {
    if (this.completed || this.failed) return null;
    if (this.step === 0) return { ...OBJECTIVE_POINTS.club, label: "STREET" };
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
