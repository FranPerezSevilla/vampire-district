import { LAYERS, rooftopRoutes } from "../data/district.js";

const ROUTE_COLOR = 0x78c7a3;
const DANGER_COLOR = 0xff4f68;
const TIP_COLOR = 0xffb02e;
const FIRST_JUMP = rooftopRoutes.find(route => route.id === "jumpRefugeMarket") || {
  ax: 236,
  ay: 146,
  aLayer: LAYERS.ROOF_HIGH
};
const HIDDEN_TUTORIAL_STATES = new Set([
  "waiting",
  "intro",
  "blocker-warning",
  "thug-dialogue",
  "hunger-lesson",
  "final-sire",
  "police-informant",
  "boundary-warning"
]);

export class ObjectiveMarkerSystem {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(86);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.objectiveMarkerSystem = this;
  }

  update(time = this.scene.time?.now || 0) {
    const objective = this.currentObjective();
    if (!objective || objective.layer !== this.scene.currentLayer) {
      this.graphics.clear();
      return;
    }

    const player = this.scene.player;
    const dx = objective.x - player.x;
    const dy = objective.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) {
      this.graphics.clear();
      return;
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const px = -uy;
    const py = ux;
    const pulse = (Math.sin(time * 0.008) + 1) * 0.5;
    const startDistance = 18;
    const closeEnough = distance <= 112;
    const endDistance = closeEnough ? Math.max(startDistance + 10, distance - 10) : 72 + pulse * 4;
    const startX = player.x + ux * startDistance;
    const startY = player.y + uy * startDistance;
    const endX = player.x + ux * endDistance;
    const endY = player.y + uy * endDistance;
    const headLength = closeEnough ? 15 : 13;
    const headWidth = closeEnough ? 9 : 8;
    const stemEndX = endX - ux * (headLength - 1);
    const stemEndY = endY - uy * (headLength - 1);
    const baseX = endX - ux * headLength;
    const baseY = endY - uy * headLength;
    const leftX = baseX + px * headWidth;
    const leftY = baseY + py * headWidth;
    const rightX = baseX - px * headWidth;
    const rightY = baseY - py * headWidth;
    const color = objective.color;

    this.graphics.clear();
    this.graphics.lineStyle(6, 0x05060b, 0.78)
      .beginPath()
      .moveTo(startX, startY)
      .lineTo(stemEndX, stemEndY)
      .strokePath();
    this.graphics.lineStyle(3, color, 0.96)
      .beginPath()
      .moveTo(startX, startY)
      .lineTo(stemEndX, stemEndY)
      .strokePath();
    this.graphics.fillStyle(0x05060b, 0.86).fillTriangle(
      endX + ux * 2,
      endY + uy * 2,
      leftX + px * 2,
      leftY + py * 2,
      rightX - px * 2,
      rightY - py * 2
    );
    this.graphics.fillStyle(color, 1).fillTriangle(endX, endY, leftX, leftY, rightX, rightY);
    this.graphics.lineStyle(2, color, 0.42 + pulse * 0.22).strokeCircle(player.x, player.y, 13 + pulse * 2);
  }

  currentObjective() {
    const mission = this.scene.missionSystem;
    const director = this.scene.tutorialDirector;
    if (!mission || mission.failed || mission.completed) return null;
    if (mission.tipCollected || mission.step > 0) return null;
    if (this.scene.transitionSystem?.active || this.scene.registry?.get?.("taskRevealActive")) return null;
    if (!director?.started || director.busy || HIDDEN_TUTORIAL_STATES.has(director.state)) return null;

    if ((mission.rooftopJumps || 0) < 1) {
      return { x: FIRST_JUMP.ax, y: FIRST_JUMP.ay, layer: FIRST_JUMP.aLayer, color: ROUTE_COLOR };
    }

    const thug = this.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug") || null;
    if (thug && !thug.dead) return { x: thug.x, y: thug.y, layer: thug.layer, color: DANGER_COLOR };
    return { x: 775, y: 150, layer: LAYERS.ROOF_LOW, color: TIP_COLOR };
  }

  destroy() {
    this.graphics?.destroy?.();
  }
}
