import { LAYERS } from "../data/district.js";

const SCENARIO_IDS = Object.freeze([
  "vehicle-core",
  "street-damage",
  "police-escalation",
  "input-locks",
  "urban-explore"
]);

function clearTransientThreats(scene) {
  scene.campaignCheckpointSystem?.resetTransientThreats?.();
  if (scene.exposureSystem) {
    scene.exposureSystem.value = 0;
    scene.exposureSystem.lastReason = "Scenario baseline.";
  }
  for (const npc of scene.npcSystem?.npcs || []) {
    npc.alarmed = false;
    npc.hasReported = false;
    npc.chasingPlayer = false;
    npc.enemyAttack = null;
    npc.reportTarget = null;
    npc.reactionTimer = 0;
    npc.soundReactionTimer = 0;
  }
  scene.npcSystem?.rebuildSpatialIndex?.();
}

function normalizeUi(uiScene) {
  uiScene.introOpen = false;
  uiScene.pauseOpen = false;
  uiScene.resultOpen = false;
  uiScene.resultType = null;
  uiScene.pauseSnapshot = null;
  uiScene.dom?.modal?.classList?.remove?.("open");
  uiScene.updateUiPause?.();
}

export class ScenarioRegistry {
  constructor(scene, uiScene, harness) {
    this.scene = scene;
    this.uiScene = uiScene;
    this.harness = harness;
    this.activeId = null;
  }

  list() {
    return [...SCENARIO_IDS];
  }

  apply(id) {
    const scenarioId = String(id || "");
    if (!SCENARIO_IDS.includes(scenarioId)) {
      throw new Error(`Unknown test scenario: ${scenarioId}`);
    }

    this.harness?.unlockPostTutorialWorld?.();
    normalizeUi(this.uiScene);
    this.scene.vehicleSystem?.exitVehicle?.({ force: true });
    clearTransientThreats(this.scene);

    switch (scenarioId) {
      case "vehicle-core":
        this.placeNearVehicle("refuge_compact");
        break;
      case "street-damage":
        this.placeNearVehicle("refuge_compact");
        break;
      case "police-escalation":
        this.scene.switchLayer(LAYERS.STREET, { x: 488, y: 326 }, "Scenario: police escalation loop.");
        break;
      case "input-locks":
        this.scene.switchLayer(LAYERS.STREET, { x: 520, y: 326 }, "Scenario: input lock loop.");
        break;
      case "urban-explore":
        this.scene.switchLayer(LAYERS.STREET, { x: 438, y: 326 }, "Scenario: expanded district exploration.");
        break;
      default:
        break;
    }

    this.activeId = scenarioId;
    this.scene.registry?.set?.("testScenario", scenarioId);
    this.scene.inputSystem?.reset?.();
    this.scene.inputSystem?.resetWorldEdges?.();
    this.scene.redrawLayer?.(`SCENARIO READY · ${scenarioId}`);
    return this.snapshot();
  }

  placeNearVehicle(vehicleId) {
    const vehicle = this.scene.vehicleSystem?.vehicle?.(vehicleId);
    if (!vehicle) throw new Error(`Scenario vehicle unavailable: ${vehicleId}`);
    vehicle.speed = 0;
    vehicle.disabled = false;
    this.scene.switchLayer(
      LAYERS.STREET,
      { x: vehicle.x - 18, y: vehicle.y },
      `Scenario: approach ${vehicleId}.`
    );
  }

  snapshot() {
    return {
      activeId: this.activeId,
      available: this.list(),
      layer: this.scene.currentLayer,
      player: { x: this.scene.player.x, y: this.scene.player.y },
      activeMissionId: this.scene.campaignSystem?.state?.missions?.activeMissionId || null,
      tutorialState: this.scene.tutorialDirector?.state || null,
      occupiedVehicleId: this.scene.vehicleSystem?.occupiedVehicleId || null,
      wantedLevel: this.scene.exposureSystem?.level?.() || 0
    };
  }
}
