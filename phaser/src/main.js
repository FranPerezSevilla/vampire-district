import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";
import { CAMERA, WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const RESOLUTION_PRESETS = Object.freeze({
  compact: Object.freeze({ displayWidth: 960, renderScale: 1.5 }),
  large: Object.freeze({ displayWidth: 1280, renderScale: 2 }),
  qhd: Object.freeze({ displayWidth: 1440, renderScale: 2.25 }),
  ultra: Object.freeze({ displayWidth: 1920, renderScale: 3 })
});

function savedResolutionKey() {
  try {
    const saved = window.localStorage.getItem(RESOLUTION_STORAGE_KEY);
    return RESOLUTION_PRESETS[saved] ? saved : "qhd";
  } catch {
    return "qhd";
  }
}

const resolutionKey = savedResolutionKey();
const resolutionPreset = RESOLUTION_PRESETS[resolutionKey];
const renderScale = resolutionPreset.renderScale;
const deviceResolution = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.25);

window.NBD_RESOLUTION_PRESET = { key: resolutionKey, ...resolutionPreset };
document.documentElement.style.setProperty("--game-width", `${resolutionPreset.displayWidth}px`);
document.documentElement.style.setProperty("--game-height", `${Math.round(resolutionPreset.displayWidth * 2 / 3)}px`);

const TINY_MAP_LABELS_TO_HIDE = new Set([
  "LAMP",
  "JUMP",
  "JUMP ARC",
  "LAND",
  "DOWN",
  "DROP",
  "FIRE",
  "SEWER"
]);

function bindResolutionSelector() {
  const select = document.getElementById("resolution-select");
  if (!select) return;
  select.value = resolutionKey;
  select.addEventListener("change", () => {
    const nextKey = RESOLUTION_PRESETS[select.value] ? select.value : "qhd";
    try {
      window.localStorage.setItem(RESOLUTION_STORAGE_KEY, nextKey);
    } catch {
      // The selected value still applies after a normal reload when storage is available.
    }
    window.location.reload();
  });
}

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

function useSelectedRenderScaleForCamera() {
  function updateCameraForSelectedResolution() {
    const camera = this.cameras.main;
    const baseZoom = this.currentLayer === LAYERS.ROOF_HIGH
      ? CAMERA.roofHighZoom
      : this.currentLayer === LAYERS.ROOF_LOW
        ? CAMERA.roofLowZoom
        : this.currentLayer === LAYERS.SEWER
          ? CAMERA.sewerZoom
          : CAMERA.streetZoom;
    const targetZoom = baseZoom * renderScale;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.08));
  }

  updateCameraForSelectedResolution.__nbdResolutionPatch = true;
  GameScene.prototype.updateCameraForLayer = updateCameraForSelectedResolution;
}

bindResolutionSelector();
patchReadableCanvasText();
suppressStreetBuildingLabelsOnRoofs();
useSelectedRenderScaleForCamera();

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
