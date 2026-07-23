import { bootProfile } from "../boot/BootProfile.js";
import { ScenarioRegistry } from "./ScenarioRegistry.js";

function attachScenario() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  const harness = window.NBD_RC_HARNESS;
  if (!scene?.vehicleSystem
    || !scene?.campaignCheckpointSystem
    || !scene?.tutorialDirector
    || !uiScene?.dom
    || !harness) {
    window.setTimeout(attachScenario, 16);
    return;
  }
  if (window.NBD_SCENARIOS) return;

  const registry = new ScenarioRegistry(scene, uiScene, harness);
  window.NBD_SCENARIOS = Object.freeze({
    list: () => registry.list(),
    apply: id => registry.apply(id),
    snapshot: () => registry.snapshot()
  });

  try {
    registry.apply(bootProfile.scenarioId);
    window.NBD_SCENARIO_READY = true;
    window.dispatchEvent(new CustomEvent("nbd:scenario-ready", {
      detail: registry.snapshot()
    }));
  } catch (error) {
    window.NBD_SCENARIO_READY = false;
    window.NBD_SCENARIO_ERROR = error;
    throw error;
  }
}

window.NBD_SCENARIO_READY = false;
attachScenario();
