import { WORLD } from "./data/balance.js";
import { installBloodSensePresentationPolicy } from "./policies/BloodSensePresentationPolicy.js";
import { installCityPracticalLightPresentationPolicy } from "./policies/CityPracticalLightPresentationPolicy.js";
import { installCitySurfacePresentationPolicy } from "./policies/CitySurfacePresentationPolicy.js";
import { installCityVehicleLightPresentationPolicy } from "./policies/CityVehicleLightPresentationPolicy.js";
import { installCityWetStreetPresentationPolicy } from "./policies/CityWetStreetPresentationPolicy.js";
import { installDistrictGunfireHeatPolicy } from "./policies/DistrictGunfireHeatPolicy.js";
import { installFootPolicePedestrianPolicy } from "./policies/FootPolicePedestrianPolicy.js";
import { installPlaytestSurfacePolicy } from "./policies/PlaytestSurfacePolicy.js";
import { installPoliceScreenPursuitPolicy } from "./policies/PoliceScreenPursuitPolicy.js";
import { installSidewalkCoveragePresentationPolicy } from "./policies/SidewalkCoveragePresentationPolicy.js";
import { installTrafficContextualHornPolicy } from "./policies/TrafficContextualHornPolicy.js";
import { installTrafficFeedbackPolicy } from "./policies/TrafficFeedbackPolicy.js";
import { installTrafficPlaytestPolicy } from "./policies/TrafficPlaytestPolicy.js";
import { installVampireVeilPolicy } from "./policies/VampireVeilPolicy.js";
import { installVehicleDamagePresentationPolicy } from "./policies/VehicleDamagePresentationPolicy.js";
import { installVehicleWallCollisionAudioPolicy } from "./policies/VehicleWallCollisionAudioPolicy.js";
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
const MAIN_MENU_THEME_URL = new URL("../assets/audio/music/main-menu-theme-01.mp3", import.meta.url).href;
const MAIN_MENU_THEME_VOLUME = 0.28;
const MAIN_MENU_THEME_FADE_MS = 430;

function createMainMenuThemeController() {
  const audio = document.getElementById("viceblood-main-menu-theme") || new Audio(MAIN_MENU_THEME_URL);
  if (!audio.src) audio.src = MAIN_MENU_THEME_URL;
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

patchReadableCanvasText();
installCitySurfacePresentationPolicy(GameScene);
installCityPracticalLightPresentationPolicy(GameScene);
installCityVehicleLightPresentationPolicy(GameScene);
installCityWetStreetPresentationPolicy(GameScene);
installSidewalkCoveragePresentationPolicy(GameScene);
installVampireVeilPolicy();
installPlaytestSurfacePolicy();
installBloodSensePresentationPolicy();
installPoliceScreenPursuitPolicy();
installTrafficPlaytestPolicy();
installTrafficFeedbackPolicy();
installTrafficContextualHornPolicy();
installFootPolicePedestrianPolicy();
installDistrictGunfireHeatPolicy();
installVehicleDamagePresentationPolicy();
installVehicleWallCollisionAudioPolicy();

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
