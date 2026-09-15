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

function phaserScriptSources() {
  // The pinned engine is published with the game. Do not block boot on a
  // third-party CDN when the same-origin copy is already available.
  return [LOCAL_PHASER_SOURCE, ...CDN_PHASER_SOURCES];
}

let playtestBootCover = null;

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
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Engine download timed out: ${source.src}`));
    }, 8000);
    script.src = source.src;
    script.async = false;
    script.dataset.nbdPhaser = source.kind;
    script.addEventListener("load", () => { window.clearTimeout(timer); resolve(source); }, { once: true });
    script.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error(`Unable to load ${source.src}`)); }, { once: true });
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
  window.NBD_BOOT_STARTED_AT = performance.now();
  await preparePlaytestEntry();
  const phaser = await ensurePhaser();
  window.NBD_ENGINE_READY_AT = performance.now();
  await import("./campaign/preload.js");
  await import("./police/VehicleIncidentPoliceWitnessPolicy.js");

  // Load the compiled presentation before any scene is created. It contains
  // React/Radix only, never another copy of Phaser or campaign services.
  const interfaceView = await import("../ui-dist/interface.js");
  window.NBD_INTERFACE_VIEW = interfaceView;
  await import("./responsive-layout.js");
  await import("./main.js");
  await import("./campaign/bootstrap.js");
  await import("./tutorial/bootstrap.js");
  await import("./vehicles/maintenance-bootstrap.js");

  if (bootProfile.mode === BOOT_MODES.PLAYTEST) {
    await import(`./playtest/bootstrap.js?v=${PLAYTEST_ASSET_VERSION}`);
  }
  if (bootProfile.enableHarness) await import("./testing/bootstrap.js");
  if (bootProfile.mode === BOOT_MODES.SCENARIO) await import("./testing/scenario-bootstrap.js");

  window.NBD_APP_READY = true;
  window.NBD_APP_READY_AT = performance.now();
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
