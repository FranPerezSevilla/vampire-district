import { LAYERS, fireEscapes, rooftopRoutes, sewerAccesses } from "./data/district.js";
import { GameScene } from "./scenes/GameScene.js";

const MARKER_COLOR = 0xffb02e;
const ROUTE_COLOR = 0x78c7a3;
const DANGER_COLOR = 0xff4f68;

const FIRST_JUMP = rooftopRoutes.find(route => route.id === "jumpRefugeMarket") || {
  ax: 236,
  ay: 146,
  aLayer: LAYERS.ROOF_HIGH
};
const REFUGE_ESCAPE = fireEscapes.find(route => route.id === "refugeFireEscape");
const CLUB_ESCAPE = fireEscapes.find(route => route.id === "clubFireEscape");
const CROSS_MANHOLE = sewerAccesses.find(route => route.id === "crossManhole");
const REFUGE_SHAFT = sewerAccesses.find(route => route.id === "refugePrivateShaft");

const HIDDEN_TUTORIAL_STATES = new Set([
  "waiting",
  "intro",
  "blocker-warning",
  "thug-dialogue",
  "hunger-lesson",
  "final-sire"
]);

function injectEdgeMarker() {
  if (!document.getElementById("nbd-objective-marker-style")) {
    const style = document.createElement("style");
    style.id = "nbd-objective-marker-style";
    style.textContent = `
      .objective-edge-marker {
        --objective-angle: 0deg;
        position: absolute;
        left: 50%;
        top: 50%;
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 74;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, .82));
      }

      .objective-edge-marker.visible {
        display: flex;
        animation: objective-edge-in .18s ease-out;
      }

      .objective-edge-marker__arrow {
        width: 0;
        height: 0;
        border-left: 11px solid transparent;
        border-right: 11px solid transparent;
        border-bottom: 25px solid var(--objective-color, #ffb02e);
        transform: rotate(var(--objective-angle));
        transform-origin: 50% 54%;
      }

      .objective-edge-marker__label {
        max-width: 180px;
        padding: 4px 7px;
        border: 1px solid color-mix(in srgb, var(--objective-color, #ffb02e) 72%, transparent);
        background: rgba(5, 6, 11, .92);
        color: #fff6dc;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .09em;
        line-height: 1.1;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
      }

      @keyframes objective-edge-in {
        from { opacity: 0; transform: translate(-50%, -50%) scale(.78); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      @media (max-width: 720px) {
        .objective-edge-marker__label { max-width: 130px; font-size: 9px; }
        .objective-edge-marker__arrow {
          border-left-width: 9px;
          border-right-width: 9px;
          border-bottom-width: 21px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  if (!host) return null;

  let marker = document.getElementById("objective-edge-marker");
  if (!marker) {
    marker = document.createElement("div");
    marker.id = "objective-edge-marker";
    marker.className = "objective-edge-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.innerHTML = `
      <div class="objective-edge-marker__arrow"></div>
      <div class="objective-edge-marker__label"></div>
    `;
    host.appendChild(marker);
  }

  return marker;
}

function colorHex(color) {
  return `#${Number(color || MARKER_COLOR).toString(16).padStart(6, "0")}`;
}

function liveNpc(scene, id) {
  return scene.npcSystem?.npcs?.find(npc => npc.id === id) || null;
}

function point(x, y, layer, label, color = MARKER_COLOR) {
  return { x, y, layer, label, color };
}

function routeToStreet(scene, finalLabel) {
  if (scene.currentLayer === LAYERS.ROOF_LOW && CLUB_ESCAPE?.roof) {
    return point(CLUB_ESCAPE.roof.x, CLUB_ESCAPE.roof.y, LAYERS.ROOF_LOW, "DESCEND TO STREET", ROUTE_COLOR);
  }
  if (scene.currentLayer === LAYERS.ROOF_HIGH) {
    return point(FIRST_JUMP.ax, FIRST_JUMP.ay, FIRST_JUMP.aLayer, "LEAVE THE REFUGE", ROUTE_COLOR);
  }
  if (scene.currentLayer === LAYERS.SEWER && CROSS_MANHOLE?.sewer) {
    return point(CROSS_MANHOLE.sewer.x, CROSS_MANHOLE.sewer.y, LAYERS.SEWER, "EXIT THE SEWERS", ROUTE_COLOR);
  }
  return finalLabel;
}

function routeToRefuge(scene) {
  if (scene.currentLayer === LAYERS.ROOF_HIGH) {
    return point(150, 146, LAYERS.ROOF_HIGH, "RETURN TO THE REFUGE", MARKER_COLOR);
  }
  if (scene.currentLayer === LAYERS.ROOF_LOW) {
    return point(FIRST_JUMP.bx, FIRST_JUMP.by, FIRST_JUMP.bLayer, "JUMP TO THE REFUGE", ROUTE_COLOR);
  }
  if (scene.currentLayer === LAYERS.SEWER && REFUGE_SHAFT?.sewer) {
    return point(REFUGE_SHAFT.sewer.x, REFUGE_SHAFT.sewer.y, LAYERS.SEWER, "CLIMB THE PRIVATE SHAFT", ROUTE_COLOR);
  }
  if (scene.currentLayer === LAYERS.STREET && REFUGE_ESCAPE?.street) {
    return point(REFUGE_ESCAPE.street.x, REFUGE_ESCAPE.street.y, LAYERS.STREET, "CLIMB TO THE ROOFTOPS", ROUTE_COLOR);
  }
  return point(150, 146, LAYERS.ROOF_HIGH, "RETURN TO THE REFUGE", MARKER_COLOR);
}

class ObjectiveMarkerSystem {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(86);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "800",
      color: "#fff6dc",
      align: "center"
    }).setOrigin(0.5, 1).setDepth(87);
    this.label.setResolution?.(3);
    this.label.setStroke?.("#05060b", 4);
    this.edge = injectEdgeMarker();
    this.lastObjectiveKey = "";

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.graphics?.destroy();
    this.label?.destroy();
    this.edge?.classList.remove("visible");
  }

  tutorialObjective() {
    const director = this.scene.tutorialDirector;
    if (!director?.started) return null;
    if (director.busy || HIDDEN_TUTORIAL_STATES.has(director.state)) return null;

    const mission = this.scene.missionSystem;
    const thug = liveNpc(this.scene, "rooftop_thug");

    if (director.state === "rooftop-movement") {
      if ((mission?.rooftopJumps || 0) < 1) {
        return point(FIRST_JUMP.ax, FIRST_JUMP.ay, FIRST_JUMP.aLayer, "FIRST ROOFTOP JUMP", ROUTE_COLOR);
      }
      if (thug && !thug.dead) {
        return point(thug.x, thug.y, thug.layer, "ROOFTOP BLOCKER", DANGER_COLOR);
      }
    }

    if (["approach-thug", "drain-thug"].includes(director.state) && thug && !thug.dead) {
      return point(thug.x, thug.y, thug.layer, "ROOFTOP BLOCKER", DANGER_COLOR);
    }

    if (director.state === "reach-tip") {
      return point(775, 150, LAYERS.ROOF_LOW, "POLICE ROOF TIP", MARKER_COLOR);
    }

    return null;
  }

  missionObjective() {
    const mission = this.scene.missionSystem;
    if (!mission || mission.failed || mission.completed) return null;

    const thug = liveNpc(this.scene, "rooftop_thug");
    const journalist = liveNpc(this.scene, "journalist");

    if (mission.step === 0) {
      if ((mission.rooftopJumps || 0) < 1) {
        return point(FIRST_JUMP.ax, FIRST_JUMP.ay, FIRST_JUMP.aLayer, "FIRST ROOFTOP JUMP", ROUTE_COLOR);
      }
      if (thug && !thug.dead) {
        return point(thug.x, thug.y, thug.layer, "ROOFTOP BLOCKER", DANGER_COLOR);
      }
      return point(775, 150, LAYERS.ROOF_LOW, "POLICE ROOF TIP", MARKER_COLOR);
    }

    if (mission.step === 1) {
      const club = point(642, 404, LAYERS.STREET, "REACH THE NIGHTCLUB", MARKER_COLOR);
      return routeToStreet(this.scene, club);
    }

    if (mission.step === 2) {
      const target = journalist && !journalist.dead
        ? point(journalist.x, journalist.y, journalist.layer, "THE JOURNALIST", DANGER_COLOR)
        : point(588, 360, LAYERS.STREET, "THE JOURNALIST", DANGER_COLOR);
      return routeToStreet(this.scene, target);
    }

    if (mission.step === 3) return routeToRefuge(this.scene);
    return null;
  }

  objective() {
    return this.tutorialObjective() || this.missionObjective();
  }

  update(time) {
    const objective = this.objective();
    if (!objective || this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) {
      this.hide();
      return;
    }

    const key = `${objective.label}:${objective.layer}:${Math.round(objective.x)}:${Math.round(objective.y)}`;
    if (key !== this.lastObjectiveKey) {
      this.lastObjectiveKey = key;
      this.edge?.classList.remove("visible");
    }

    this.drawWorldMarker(objective, time);
    this.drawEdgeMarker(objective);
  }

  drawWorldMarker(objective, time) {
    this.graphics.clear();
    const sameLayer = objective.layer === this.scene.currentLayer;
    if (!sameLayer) {
      this.label.setVisible(false);
      return;
    }

    const pulse = (Math.sin(time * 0.006) + 1) * 0.5;
    const bob = Math.sin(time * 0.008) * 4;
    const radius = 15 + pulse * 4;
    const arrowY = objective.y - 34 - bob;
    const color = objective.color || MARKER_COLOR;

    this.graphics.lineStyle(2, color, 0.92).strokeCircle(objective.x, objective.y, radius);
    this.graphics.fillStyle(color, 0.11 + pulse * 0.07).fillCircle(objective.x, objective.y, radius);
    this.graphics.lineStyle(2, 0x05060b, 0.95).strokeTriangle(
      objective.x - 11,
      arrowY - 2,
      objective.x + 11,
      arrowY - 2,
      objective.x,
      arrowY + 14
    );
    this.graphics.fillStyle(color, 1).fillTriangle(
      objective.x - 10,
      arrowY - 1,
      objective.x + 10,
      arrowY - 1,
      objective.x,
      arrowY + 13
    );
    this.graphics.fillStyle(color, 1).fillRect(objective.x - 3, arrowY - 14, 6, 13);

    this.label
      .setText(objective.label)
      .setColor(colorHex(color))
      .setPosition(objective.x, arrowY - 17)
      .setVisible(true);
  }

  drawEdgeMarker(objective) {
    if (!this.edge) return;

    const camera = this.scene.cameras.main;
    const screenX = (objective.x - camera.worldView.x) * camera.zoom;
    const screenY = (objective.y - camera.worldView.y) * camera.zoom;
    const sameLayer = objective.layer === this.scene.currentLayer;
    const marginX = Math.max(60, camera.width * 0.065);
    const marginTop = Math.max(92, camera.height * 0.105);
    const marginBottom = Math.max(58, camera.height * 0.075);
    const onScreen = sameLayer
      && screenX >= marginX
      && screenX <= camera.width - marginX
      && screenY >= marginTop
      && screenY <= camera.height - marginBottom;

    if (onScreen) {
      this.edge.classList.remove("visible");
      return;
    }

    const centerX = camera.width / 2;
    const centerY = camera.height / 2;
    let dx = screenX - centerX;
    let dy = screenY - centerY;
    if (Math.abs(dx) + Math.abs(dy) < 0.001) dy = -1;

    const roomX = centerX - marginX;
    const roomYTop = centerY - marginTop;
    const roomYBottom = camera.height - marginBottom - centerY;
    const scaleX = Math.abs(dx) > 0.001 ? roomX / Math.abs(dx) : Infinity;
    const scaleY = Math.abs(dy) > 0.001
      ? (dy < 0 ? roomYTop : roomYBottom) / Math.abs(dy)
      : Infinity;
    const scale = Math.max(0, Math.min(scaleX, scaleY));
    const edgeX = centerX + dx * scale;
    const edgeY = centerY + dy * scale;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    const color = colorHex(objective.color || MARKER_COLOR);

    this.edge.style.left = `${Phaser.Math.Clamp(edgeX / camera.width * 100, 5, 95)}%`;
    this.edge.style.top = `${Phaser.Math.Clamp(edgeY / camera.height * 100, 10, 92)}%`;
    this.edge.style.setProperty("--objective-angle", `${angle}deg`);
    this.edge.style.setProperty("--objective-color", color);
    const label = this.edge.querySelector(".objective-edge-marker__label");
    if (label) label.textContent = objective.label;
    this.edge.classList.add("visible");
  }

  hide() {
    this.graphics.clear();
    this.label.setVisible(false);
    this.edge?.classList.remove("visible");
  }
}

function disableLegacyMissionMarker() {
  if (GameScene.prototype.__nbdObjectiveArrowPatch) return;
  GameScene.prototype.drawMissionMarker = function drawMissionMarkerHandledByObjectiveSystem() {};
  GameScene.prototype.__nbdObjectiveArrowPatch = true;
}

function attachObjectiveMarker() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  if (!scene?.player || !scene?.missionSystem || !scene?.cameras?.main) {
    window.requestAnimationFrame(attachObjectiveMarker);
    return;
  }

  if (!scene.objectiveMarkerSystem) {
    scene.objectiveMarkerSystem = new ObjectiveMarkerSystem(scene);
    scene.redrawLayer?.();
  }
}

disableLegacyMissionMarker();
attachObjectiveMarker();
