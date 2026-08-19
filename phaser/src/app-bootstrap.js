import { BOOT_MODES, bootProfile } from "./boot/BootProfile.js";
import { titleScreenController } from "./ui/TitleScreenController.js";

const PHASER_VERSION = "3.90.0";
const PLAYTEST_ASSET_VERSION = "2026-08-03-vehicle-incidents-1";
window.NBD_RC_TEST_MODE = bootProfile.enableHarness;
window.NBD_PLAYTEST_ASSET_VERSION = PLAYTEST_ASSET_VERSION;

const LOCAL_PHASER_SOURCE = Object.freeze({
  kind: "local-node-modules",
  src: new URL("../../node_modules/phaser/dist/phaser.min.js", import.meta.url).href
});

const CDN_PHASER_SOURCES = Object.freeze([
  Object.freeze({
    kind: "jsdelivr",
    src: `https://cdn.jsdelivr.net/npm/phaser@${PHASER_VERSION}/dist/phaser.min.js`
  }),
  Object.freeze({
    kind: "unpkg",
    src: `https://unpkg.com/phaser@${PHASER_VERSION}/dist/phaser.min.js`
  })
]);

function localPhaserAllowed() {
  const protocol = window.location?.protocol || "";
  const hostname = window.location?.hostname || "";
  return protocol === "file:"
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]";
}

function phaserScriptSources() {
  return localPhaserAllowed()
    ? [LOCAL_PHASER_SOURCE, ...CDN_PHASER_SOURCES]
    : CDN_PHASER_SOURCES;
}

let playtestBootCover = null;

// Automation/direct-game boot bypasses the production title surface completely.
if (bootProfile.enableHarness) titleScreenController.disableForHarness();

function publishPhaserSource({ kind, src = null, version = PHASER_VERSION }) {
  const detail = Object.freeze({ kind, src, version });
  window.NBD_PHASER_SOURCE_DETAIL = detail;
  window.NBD_PHASER_SOURCE = kind === "local-node-modules" ? "local" : kind;
  return detail;
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nbd-phaser="${source.kind}"]`);
    if (existing) {
      if (window.Phaser) {
        resolve(source);
        return;
      }
      existing.addEventListener("load", () => resolve(source), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Unable to load ${source.src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = source.src;
    script.async = false;
    script.dataset.nbdPhaser = source.kind;
    script.addEventListener("load", () => resolve(source), { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load ${source.src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensurePhaser() {
  if (window.Phaser) {
    return publishPhaserSource({
      kind: "existing",
      version: window.Phaser.VERSION || "unknown"
    });
  }

  let lastError = null;
  for (const source of phaserScriptSources()) {
    try {
      await loadScript(source);
      if (window.Phaser) {
        return publishPhaserSource({
          kind: source.kind,
          src: source.src,
          version: window.Phaser.VERSION || PHASER_VERSION
        });
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Phaser could not be loaded.");
}

async function preparePlaytestEntry() {
  if (bootProfile.mode !== BOOT_MODES.PLAYTEST) return;
  playtestBootCover = await import("./playtest/PlaytestBootCover.js");
  playtestBootCover.showPlaytestBootCover();
}

function installPlaytestIntroPolicy(UIScene) {
  const prototype = UIScene?.prototype;
  if (!prototype || prototype.__nbdPlaytestIntroPolicy) return;
  const originalOpenModal = prototype.openModal;
  if (typeof originalOpenModal !== "function") return;

  prototype.openModal = function playtestAwareOpenModal(type) {
    if (type === "intro" && bootProfile.playtestSession) {
      this.introOpen = false;
      this.pauseOpen = false;
      this.resultOpen = false;
      this.ledgerOpen = false;
      return false;
    }
    return originalOpenModal.call(this, type);
  };

  Object.defineProperty(prototype, "__nbdPlaytestIntroPolicy", {
    value: true,
    configurable: true
  });
}

function renderBootFailure(error) {
  console.error("Viceblood failed to boot", error);
  if (titleScreenController.showFailure(error)) return;

  const root = document.getElementById("game-root");
  if (!root) return;
  root.innerHTML = `
    <div style="display:grid;place-items:center;min-height:320px;padding:32px;text-align:center;background:#090a12;color:#f4ecff;border:1px solid #513c65">
      <div>
        <strong style="display:block;margin-bottom:10px;color:#ffb02e">Viceblood could not start</strong>
        <span style="font-size:13px;line-height:1.5;color:#c9bfd7">${String(error?.message || error || "Unknown boot error")}</span>
      </div>
    </div>
  `;
}

try {
  await preparePlaytestEntry();
  const phaser = await ensurePhaser();
  await import("./campaign/preload.js");
  await import("./police/VehicleIncidentPoliceWitnessPolicy.js");

  if (bootProfile.mode === BOOT_MODES.PLAYTEST) {
    const { UIScene } = await import("./scenes/UIScene.js");
    installPlaytestIntroPolicy(UIScene);
  }

  await import("./main.js");
  await import("./ui/AccessibilityKeyboardBridge.js");
  await import("./responsive-layout.js");
  await import("./campaign/bootstrap.js");
  await import("./tutorial/bootstrap.js");
  // Campaign entry and the refuge mission board are intentionally not booted
  // while the production mission registry is empty.
  await import("./vehicles/maintenance-bootstrap.js");

  if (bootProfile.mode === BOOT_MODES.PLAYTEST) {
    await import(`./playtest/bootstrap.js?v=${PLAYTEST_ASSET_VERSION}`);
  }
  if (bootProfile.enableHarness) await import("./testing/bootstrap.js");
  if (bootProfile.mode === BOOT_MODES.SCENARIO) await import("./testing/scenario-bootstrap.js");

  window.NBD_APP_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:app-ready", {
    detail: {
      phaser,
      campaign: true,
      registeredMissions: 0,
      rcTest: bootProfile.rcTest,
      bootProfile,
      playtestAssetVersion: bootProfile.mode === BOOT_MODES.PLAYTEST ? PLAYTEST_ASSET_VERSION : null
    }
  }));
} catch (error) {
  window.NBD_APP_READY = false;
  window.NBD_APP_ERROR = error;
  playtestBootCover?.failPlaytestBootCover?.(error);
  renderBootFailure(error);
}
