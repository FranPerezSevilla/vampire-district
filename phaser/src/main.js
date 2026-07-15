import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";
import { WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";

const deviceResolution = Math.min(window.devicePixelRatio || 1, 2);
const renderScale = WORLD.renderScale || 1;

const TINY_MAP_LABELS_TO_HIDE = new Set(["LAMP", "JUMP", "DOWN", "DROP", "FIRE", "SEWER"]);

function patchReadableCanvasText() {
  const factory = Phaser.GameObjects?.GameObjectFactory?.prototype;
  if (!factory || factory.__nbdReadableTextPatch) return;
  const originalText = factory.text;
  factory.text = function patchedText(x, y, value, style = {}) {
    const raw = String(value ?? "");
    const nextStyle = { ...(style || {}) };
    const fontSize = Number.parseFloat(String(nextStyle.fontSize || "")) || 0;

    if (fontSize && fontSize < 12) nextStyle.fontSize = "12px";
    if (!nextStyle.fontFamily || nextStyle.fontFamily === "monospace") {
      nextStyle.fontFamily = "Arial, Helvetica, sans-serif";
    }
    nextStyle.fontStyle ||= "700";

    const displayValue = TINY_MAP_LABELS_TO_HIDE.has(raw.trim().toUpperCase()) ? "" : value;
    const textObject = originalText.call(this, x, y, displayValue, nextStyle);
    textObject.setResolution?.(3);
    textObject.setStroke?.("#05060b", 3);
    return textObject;
  };
  factory.__nbdReadableTextPatch = true;
}

function suppressStreetBuildingLabelsOnRoofs() {
  const originalDrawBuilding = GameScene.prototype.drawBuilding;
  if (!originalDrawBuilding || originalDrawBuilding.__nbdRoofLabelPatch) return;

  function patchedDrawBuilding(building) {
    if (this.currentLayer === LAYERS.STREET) {
      return originalDrawBuilding.call(this, building);
    }

    const originalAddMapLabel = this.addMapLabel;
    this.addMapLabel = () => {};
    try {
      return originalDrawBuilding.call(this, building);
    } finally {
      this.addMapLabel = originalAddMapLabel;
    }
  }

  patchedDrawBuilding.__nbdRoofLabelPatch = true;
  GameScene.prototype.drawBuilding = patchedDrawBuilding;
}

patchReadableCanvasText();
suppressStreetBuildingLabelsOnRoofs();

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: Math.round(WORLD.width * renderScale),
  height: Math.round(WORLD.height * renderScale),
  resolution: deviceResolution,
  backgroundColor: "#05060b",
  pixelArt: false,
  roundPixels: false,
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UIScene]
};

window.NBD_PHASER_GAME = new Phaser.Game(config);
