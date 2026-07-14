import { buildings, LAYERS, roofAreas } from "../data/district.js";

const OBJECTIVE_POINTS = Object.freeze({
  club: { x: 642, y: 404, layer: LAYERS.STREET, radius: 96 },
  journalist: { x: 638, y: 370, layer: LAYERS.STREET, radius: 30 },
  refuge: { x: 150, y: 146, layer: LAYERS.ROOF_HIGH, radius: 58 }
});

export class MissionSystem {
  constructor(scene) {
    this.scene = scene;
    this.step = 0;
    this.completed = false;
    this.lastMissionText = "Wake on the rooftop refuge. Leave the roof and reach the nightclub.";
  }

  update() {
    if (this.completed) return;

    if (this.step === 0 && this.scene.currentLayer === LAYERS.STREET) {
      this.step = 1;
      this.lastMissionText = "Reach the pink-lit nightclub. The journalist is meeting a source nearby.";
      this.scene.lastActionText = "Objective updated: reach the nightclub.";
    }

    if (this.step === 1 && this.isNear(OBJECTIVE_POINTS.club)) {
      this.step = 2;
      this.lastMissionText = "Locate the journalist outside the nightclub. Use the placeholder interaction for now.";
      this.scene.lastActionText = "You reach the nightclub district. The journalist is nearby.";
    }

    if (this.step === 3 && this.isNear(OBJECTIVE_POINTS.refuge)) {
      this.step = 4;
      this.completed = true;
      this.lastMissionText = "Report complete. Phaser mission skeleton works end-to-end.";
      this.scene.lastActionText = "ORDER COMPLETE: the route from refuge to target and back is validated.";
    }
  }

  collectInteractions() {
    const actions = [];
    if (this.step === 2 && this.isNear(OBJECTIVE_POINTS.journalist)) {
      actions.push({
        id: "mission_placeholder_journalist",
        type: "mission",
        label: "Resolve journalist placeholder",
        detail: "mission placeholder · feeding later",
        priority: 100,
        distance: this.distanceTo(OBJECTIVE_POINTS.journalist),
        x: OBJECTIVE_POINTS.journalist.x,
        y: OBJECTIVE_POINTS.journalist.y,
        run: () => this.resolveJournalistPlaceholder()
      });
    }
    return actions;
  }

  resolveJournalistPlaceholder() {
    if (this.step !== 2) return;
    this.step = 3;
    this.lastMissionText = "Journalist placeholder resolved. Return to the rooftop refuge to report.";
    this.scene.lastActionText = "Placeholder resolved: later this becomes lure/feed/evidence. Return to the rooftop refuge.";
  }

  objectiveText() {
    if (this.completed) return "COMPLETE · Phaser mission skeleton validated.";
    if (this.step === 0) return "1/4 Leave the rooftop refuge and descend into the district.";
    if (this.step === 1) return "2/4 Reach the nightclub by street, roof routes, or sewers.";
    if (this.step === 2) return "3/4 Interact with the journalist placeholder outside the nightclub.";
    if (this.step === 3) return "4/4 Return to the rooftop refuge and report.";
    return this.lastMissionText;
  }

  marker() {
    if (this.completed) return null;
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
