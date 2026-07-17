import { LAYERS, rooftopRoutes } from "./data/district.js";
import { GameScene } from "./scenes/GameScene.js";

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
  "final-sire"
]);

function liveNpc(scene, id) {
  return scene.npcSystem?.npcs?.find(npc => npc.id === id) || null;
}

function objectivePoint(x, y, layer, label, color) {
  return { x, y, layer, label, color };
}

class PlayerObjectiveArrow {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(86);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "11px",
      fontStyle: "800",
      color: "#fff6dc",
      align: "center"
    }).setOrigin(0.5, 1).setDepth(87);
    this.label.setResolution?.(3);
    this.label.setStroke?.("#05060b", 4);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.graphics?.destroy();
    this.label?.destroy();
  }

  currentObjective() {
    const mission = this.scene.missionSystem;
    const director = this.scene.tutorialDirector;

    if (!mission || mission.failed || mission.completed) return null;
    if (mission.tipCollected || mission.step > 0) return null;
    if (this.scene.transitionSystem?.active) return null;
    if (this.scene.registry.get("taskRevealActive")) return null;
    if (!director?.started) return null;
    if (director.busy || HIDDEN_TUTORIAL_STATES.has(director.state)) return null;

    if ((mission.rooftopJumps || 0) < 1) {
      return objectivePoint(
        FIRST_JUMP.ax,
        FIRST_JUMP.ay,
        FIRST_JUMP.aLayer,
        "FIRST JUMP",
        ROUTE_COLOR
      );
    }

    const thug = liveNpc(this.scene, "rooftop_thug");
    if (thug && !thug.dead) {
      return objectivePoint(thug.x, thug.y, thug.layer, "ROOFTOP BLOCKER", DANGER_COLOR);
    }

    return objectivePoint(775, 150, LAYERS.ROOF_LOW, "POLICE TIP", TIP_COLOR);
  }

  update(time) {
    const objective = this.currentObjective();
    if (!objective || objective.layer !== this.scene.currentLayer) {
      this.hide();
      return;
    }

    const player = this.scene.player;
    const dx = objective.x - player.x;
    const dy = objective.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 8) {
      this.hide();
      return;
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const px = -uy;
    const py = ux;
    const pulse = (Math.sin(time * 0.008) + 1) * 0.5;
    const startDistance = 18;
    const closeEnoughToPointDirectly = distance <= 112;
    const endDistance = closeEnoughToPointDirectly
      ? Math.max(startDistance + 10, distance - 10)
      : 72 + pulse * 4;

    const startX = player.x + ux * startDistance;
    const startY = player.y + uy * startDistance;
    const endX = player.x + ux * endDistance;
    const endY = player.y + uy * endDistance;
    const headLength = closeEnoughToPointDirectly ? 15 : 13;
    const headWidth = closeEnoughToPointDirectly ? 9 : 8;
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

    this.graphics.fillStyle(color, 1).fillTriangle(
      endX,
      endY,
      leftX,
      leftY,
      rightX,
      rightY
    );

    this.graphics.lineStyle(2, color, 0.42 + pulse * 0.22)
      .strokeCircle(player.x, player.y, 13 + pulse * 2);

    const labelDistance = Math.min(endDistance * 0.62, 48);
    const labelX = player.x + ux * labelDistance + px * 13;
    const labelY = player.y + uy * labelDistance + py * 13;

    this.label
      .setText(objective.label)
      .setColor(`#${color.toString(16).padStart(6, "0")}`)
      .setPosition(labelX, labelY)
      .setVisible(true);
  }

  hide() {
    this.graphics.clear();
    this.label.setVisible(false);
  }
}

function disableLegacyMissionMarker() {
  if (GameScene.prototype.__nbdObjectiveArrowPatch) return;
  GameScene.prototype.drawMissionMarker = function drawMissionMarkerHandledByPlayerArrow() {};
  GameScene.prototype.__nbdObjectiveArrowPatch = true;
}

function attachPlayerObjectiveArrow() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  if (!scene?.player || !scene?.missionSystem) {
    window.requestAnimationFrame(attachPlayerObjectiveArrow);
    return;
  }

  scene.objectiveMarkerSystem?.destroy?.();
  scene.objectiveMarkerSystem = new PlayerObjectiveArrow(scene);
  scene.redrawLayer?.();
}

disableLegacyMissionMarker();
attachPlayerObjectiveArrow();
