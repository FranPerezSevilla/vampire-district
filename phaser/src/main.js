import { WORLD } from "./data/balance.js";
import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const RESOLUTION_PRESETS = Object.freeze({
  compact: Object.freeze({ displayWidth: 960, renderScale: 1.5 }),
  large: Object.freeze({ displayWidth: 1280, renderScale: 2 }),
  qhd: Object.freeze({ displayWidth: 1440, renderScale: 2.25 }),
  ultra: Object.freeze({ displayWidth: 1920, renderScale: 3 })
});

function savedResolutionKey() {
  const fallback = window.NBD_RC_TEST_MODE ? "compact" : "qhd";
  try {
    const saved = window.localStorage.getItem(RESOLUTION_STORAGE_KEY);
    return RESOLUTION_PRESETS[saved] ? saved : fallback;
  } catch {
    return fallback;
  }
}

const resolutionKey = savedResolutionKey();
const resolutionPreset = RESOLUTION_PRESETS[resolutionKey];
const renderScale = resolutionPreset.renderScale;
const deviceResolution = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.25);
const viewportWidth = Number(WORLD.viewportWidth) || 960;
const viewportHeight = Number(WORLD.viewportHeight) || 640;

window.NBD_RESOLUTION_PRESET = { key: resolutionKey, ...resolutionPreset };
document.documentElement.style.setProperty("--game-width", `${resolutionPreset.displayWidth}px`);
document.documentElement.style.setProperty("--game-height", `${Math.round(resolutionPreset.displayWidth * viewportHeight / viewportWidth)}px`);

function bindResolutionSelector() {
  const select = document.getElementById("resolution-select");
  if (!select) return;
  select.value = resolutionKey;
  select.addEventListener("change", () => {
    const nextKey = RESOLUTION_PRESETS[select.value] ? select.value : "qhd";
    try { window.localStorage.setItem(RESOLUTION_STORAGE_KEY, nextKey); } catch {}
    window.location.reload();
  });
}

function patchReadableCanvasText() {
  const factory = Phaser.GameObjects?.GameObjectFactory?.prototype;
  if (!factory || factory.__nbdReadableTextPatch) return;
  const originalText = factory.text;
  factory.text = function readableText(x, y, value, style = {}) {
    const nextStyle = { ...(style || {}) };
    const fontSize = Number.parseFloat(String(nextStyle.fontSize || "")) || 0;
    if (fontSize && fontSize < 12) nextStyle.fontSize = "12px";
    if (!nextStyle.fontFamily || nextStyle.fontFamily === "monospace") nextStyle.fontFamily = "Arial, Helvetica, sans-serif";
    nextStyle.fontStyle ||= "700";
    const textObject = originalText.call(this, x, y, value, nextStyle);
    textObject.setResolution?.(3);
    textObject.setStroke?.("#05060b", 3);
    return textObject;
  };
  factory.__nbdReadableTextPatch = true;
}

bindResolutionSelector();
patchReadableCanvasText();

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: Math.round(viewportWidth * renderScale),
  height: Math.round(viewportHeight * renderScale),
  resolution: deviceResolution,
  backgroundColor: "#05060b",
  pixelArt: false,
  roundPixels: false,
  render: { antialias: true, antialiasGL: true, pixelArt: false, roundPixels: false },
  physics: { default: "arcade", arcade: { debug: false } },
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene, UIScene]
};

window.NBD_PHASER_GAME = new Phaser.Game(config);