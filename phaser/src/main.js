import { WORLD } from "./data/balance.js";
import { installDistrictGunfireHeatPolicy } from "./policies/DistrictGunfireHeatPolicy.js";
import { installFootPolicePedestrianPolicy } from "./policies/FootPolicePedestrianPolicy.js";
import { installPlaytestSurfacePolicy } from "./policies/PlaytestSurfacePolicy.js";
import { installTrafficContextualHornPolicy } from "./policies/TrafficContextualHornPolicy.js";
import { installTrafficPlaytestPolicy } from "./policies/TrafficPlaytestPolicy.js";
import { installVampireVeilPolicy } from "./policies/VampireVeilPolicy.js";
import { BootScene } from "./scenes/BootScene.js";
import { MainMenuScene } from "./scenes/MainMenuScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const RESOLUTION_PRESETS = Object.freeze({
  compact: Object.freeze({ displayWidth: 960, renderScale: 1.5 }),
  large: Object.freeze({ displayWidth: 1280, renderScale: 2 }),
  qhd: Object.freeze({ displayWidth: 1440, renderScale: 2.25 }),
  ultra: Object.freeze({ displayWidth: 1920, renderScale: 3 })
});
const MAIN_MENU_THEME_URL = new URL("../assets/audio/music/main-menu-theme-01.m4a", import.meta.url).href;
const MAIN_MENU_THEME_VOLUME = 0.28;
const MAIN_MENU_THEME_FADE_MS = 430;
const MAIN_MENU_AUDIO_GATE_ID = "viceblood-audio-gate";

function createMainMenuThemeController() {
  const audio = new Audio(MAIN_MENU_THEME_URL);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = MAIN_MENU_THEME_VOLUME;
  let fadeRaf = 0;

  const cancelFade = () => {
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    fadeRaf = 0;
  };

  const start = async () => {
    cancelFade();
    audio.loop = true;
    audio.volume = MAIN_MENU_THEME_VOLUME;
    if (!audio.paused) return true;
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const fadeOut = (durationMs = MAIN_MENU_THEME_FADE_MS) => {
    cancelFade();
    if (audio.paused) {
      audio.currentTime = 0;
      return;
    }
    const from = audio.volume;
    const startedAt = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
      audio.volume = Math.max(0, from * (1 - t));
      if (t >= 1) {
        fadeRaf = 0;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = MAIN_MENU_THEME_VOLUME;
        return;
      }
      fadeRaf = requestAnimationFrame(tick);
    };
    fadeRaf = requestAnimationFrame(tick);
  };

  return Object.freeze({ start, fadeOut, audio });
}

window.NBD_MAIN_MENU_THEME = createMainMenuThemeController();

function removeMainMenuAudioGate() {
  document.getElementById(MAIN_MENU_AUDIO_GATE_ID)?.remove();
}

function showMainMenuAudioGate() {
  if (document.getElementById(MAIN_MENU_AUDIO_GATE_ID)) return;

  const root = document.getElementById("game-root");
  if (!root) return;

  const gate = document.createElement("button");
  gate.id = MAIN_MENU_AUDIO_GATE_ID;
  gate.type = "button";
  gate.setAttribute("aria-label", "Start ViceBlood");
  gate.innerHTML = "<span>PRESS ANY KEY TO START</span>";
  gate.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:80",
    "display:grid",
    "place-items:end center",
    "padding:0 0 9%",
    "border:0",
    "background:rgba(5,6,11,.28)",
    "color:#f1e6ff",
    "font:700 clamp(12px,1.25vw,18px) Arial,Helvetica,sans-serif",
    "letter-spacing:.24em",
    "text-shadow:0 0 18px rgba(187,128,255,.55)",
    "cursor:pointer"
  ].join(";");

  const label = gate.querySelector("span");
  label.style.cssText = "animation:viceblood-audio-gate-pulse 1.55s ease-in-out infinite";

  if (!document.getElementById("viceblood-audio-gate-style")) {
    const style = document.createElement("style");
    style.id = "viceblood-audio-gate-style";
    style.textContent = `
      @keyframes viceblood-audio-gate-pulse {
        0%,100% { opacity:.46; transform:translateY(0); }
        50% { opacity:1; transform:translateY(-2px); }
      }
    `;
    document.head.appendChild(style);
  }

  const unlock = async event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const started = await window.NBD_MAIN_MENU_THEME?.start?.();
    if (!started) return;
    window.removeEventListener("keydown", onKeyDown, true);
    gate.removeEventListener("pointerdown", unlock, true);
    gate.removeEventListener("touchstart", unlock, true);
    gate.remove();
  };

  const onKeyDown = event => {
    if (event.repeat || ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    unlock(event);
  };

  gate.addEventListener("pointerdown", unlock, true);
  gate.addEventListener("touchstart", unlock, { capture: true, passive: false });
  window.addEventListener("keydown", onKeyDown, true);
  root.appendChild(gate);
}

function installMainMenuThemePolicy() {
  const originalCreate = MainMenuScene.prototype.create;
  const originalBeginNight = MainMenuScene.prototype.beginNight;
  const originalOpenCredits = MainMenuScene.prototype.openCredits;

  MainMenuScene.prototype.create = function viceBloodMenuCreate(...args) {
    const result = originalCreate.apply(this, args);
    Promise.resolve(window.NBD_MAIN_MENU_THEME?.start?.()).then(started => {
      if (!started) showMainMenuAudioGate();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      removeMainMenuAudioGate();
      window.NBD_MAIN_MENU_THEME?.fadeOut(120);
    });
    return result;
  };

  MainMenuScene.prototype.beginNight = function viceBloodMenuBeginNight(...args) {
    removeMainMenuAudioGate();
    window.NBD_MAIN_MENU_THEME?.fadeOut(MAIN_MENU_THEME_FADE_MS);
    return originalBeginNight.apply(this, args);
  };

  MainMenuScene.prototype.openCredits = function viceBloodMenuCredits(...args) {
    const result = originalOpenCredits.apply(this, args);
    this.panelBody?.setText(
      "VICEBLOOD\n\nCreated by Fran Pérez Sevilla.\n\nDesign, code and direction by Frainzzel.\nBuilt with Phaser.\n\nMUSIC\n“Gnossienne No. 1” — Erik Satie (1890).\nArranged for ViceBlood."
    );
    return result;
  };
}

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
installVampireVeilPolicy();
installPlaytestSurfacePolicy();
installTrafficPlaytestPolicy();
installTrafficContextualHornPolicy();
installFootPolicePedestrianPolicy();
installDistrictGunfireHeatPolicy();
installMainMenuThemePolicy();

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
  scene: [BootScene, MainMenuScene, GameScene, UIScene]
};

window.NBD_PHASER_GAME = new Phaser.Game(config);
