import { CombatSystem } from "../combat/CombatSystem.js";
import { DeathRecoverySystem } from "../combat/DeathRecoverySystem.js";
import { DrainSystem } from "../combat/DrainSystem.js";
import { PlayerDamageSystem } from "../combat/PlayerDamageSystem.js";
import { PoliceFirearmSystem } from "../combat/PoliceFirearmSystem.js";
import { CITY_ANCHORS, LAYERS } from "../data/district.js";
import { InputSystem } from "../input/InputSystem.js";
import { createEmptyInputFrame } from "../input/actions.js";
import { isTraversalAction } from "../systems/InteractionSystem.js";
import { AiStateSystem } from "../systems/AiStateSystem.js";
import { MovementNoiseSystem } from "../systems/MovementNoiseSystem.js";
import { ObjectiveMarkerSystem } from "../systems/ObjectiveMarkerSystem.js";
import { OutskirtsSystem } from "../systems/OutskirtsSystem.js";
import { PoliceViolenceSystem } from "../systems/PoliceViolenceSystem.js";
import { PropDamageSystem } from "../systems/PropDamageSystem.js";
import { SensoryAwarenessSystem } from "../systems/SensoryAwarenessSystem.js";
import { TaskRevealSystem } from "../systems/TaskRevealSystem.js";
import { UxGuidanceSystem } from "../systems/UxGuidanceSystem.js";
import { WeaponSystem } from "../systems/WeaponSystem.js";
import { RuntimeDiagnostics } from "./RuntimeDiagnostics.js";

const HOSPITAL_BLOOD_BAG_ID = "hospital_recovery_blood_bag";
const CORE_PROFILE_SYSTEMS = Object.freeze([
  "Core.Input",
  "Core.Combat",
  "Core.InteractionQuery",
  "Core.WorldActors",
  "Core.WorldState",
  "Core.InteractionRefresh",
  "Core.Finalize"
]);
const FINALIZE_PROFILE_SYSTEMS = Object.freeze([
  "Finalize.MovementNoise",
  "Finalize.UxGuidance",
  "Finalize.Camera",
  "Finalize.Markers",
  "Finalize.Diagnostics",
  "Finalize.StatePublisher",
  "Finalize.PublishState"
]);

function splitActions(options = []) {
  const movement = [];
  const interaction = [];
  for (const option of options) {
    (isTraversalAction(option) ? movement : interaction).push(option);
  }
  return { movement, interaction };
}

function nearest(scene, options = []) {
  const bestOption = scene.interactionSystem?.bestOption;
  if (typeof bestOption === "function") return bestOption.call(scene.interactionSystem, options);
  return scene.interactionSystem.sortOptions(options)[0] || null;
}

export class GameplayRuntime {
  constructor(scene) {
    this.scene = scene;
    this.diagnostics = new RuntimeDiagnostics({ sampleSize: 180 });
    this.lastDiagnosticsSnapshot = null;
    this.installDiagnostics();

    scene.inputSystem?.destroy?.();
    scene.inputSystem = new InputSystem(scene);
    scene.keys = scene.inputSystem.keys;
    scene.currentInputFrame = scene.inputSystem.snapshot();

    scene.weaponSystem = new WeaponSystem(scene);
    scene.combatSystem = new CombatSystem(scene);
    scene.playerDamageSystem = new PlayerDamageSystem(scene);
    scene.deathRecoverySystem = new DeathRecoverySystem(scene);
    scene.policeFirearmSystem = new PoliceFirearmSystem(scene);
    scene.drainSystem = new DrainSystem(scene);
    scene.movementNoiseSystem = new MovementNoiseSystem(scene);
    scene.propDamageSystem = new PropDamageSystem(scene);
    scene.sensoryAwarenessSystem = new SensoryAwarenessSystem(scene);
    scene.aiStateSystem = new AiStateSystem(scene);
    scene.policeViolenceSystem = new PoliceViolenceSystem(scene);
    scene.taskRevealSystem = new TaskRevealSystem(scene);
    scene.outskirtsSystem = new OutskirtsSystem(scene);
    scene.objectiveMarkerSystem = new ObjectiveMarkerSystem(scene);
    scene.uxGuidanceSystem = new UxGuidanceSystem(scene);

    scene.drawMissionMarker = () => {};

    scene.traversalPromptLabel?.destroy?.();
    scene.traversalPromptLabel = scene.add.text(0, 0, "SPACE", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#dfffee",
      backgroundColor: "rgba(5, 12, 11, .82)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    scene.traversalPromptLabel.setResolution?.(3);
    scene.traversalPromptLabel.setStroke?.("#05060b", 2);

    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  installDiagnostics() {
    const diagnostics = this.diagnostics;
    diagnostics.claim("GameScene.update", "GameplayRuntime");
    diagnostics.claim("GameScene.updatePlayerMovement", "GameScene");
    diagnostics.claim("InteractionSystem.sortOptions", "InteractionSystem");
    diagnostics.claim("InteractionSystem.bestOption", "InteractionSystem");
    diagnostics.claim("PowersSystem.update", "PowersSystem");
    diagnostics.claim("NpcSystem.updateNpc", "NpcSystem");
    diagnostics.claim("WitnessSystem.drawMarkers", "WitnessSystem");
    diagnostics.claim("PoliceSystem.updatePolice", "PoliceSystem");
    diagnostics.claim("HunterSystem.updateHunters", "HunterSystem");
    diagnostics.claim("CombatSystem.notifyViolence", "CombatSystem");
    diagnostics.claim("TaskRevealSystem.play", "TaskRevealSystem");
    diagnostics.claim("ObjectiveMarkerSystem.update", "ObjectiveMarkerSystem");
    diagnostics.claim("OutskirtsSystem.updatePresentation", "OutskirtsSystem");
    diagnostics.claim("TutorialDirector.filterActions", "TutorialDirector");

    for (const name of [
      "InputSystem",
      "WeaponSystem",
      "CombatSystem",
      "PlayerDamageSystem",
      "DeathRecoverySystem",
      "PoliceFirearmSystem",
      "DrainSystem",
      "MovementNoiseSystem",
      "PropDamageSystem",
      "SensoryAwarenessSystem",
      "AiStateSystem",
      "PoliceViolenceSystem",
      "TaskRevealSystem",
      "OutskirtsSystem",
      "ObjectiveMarkerSystem",
      "UxGuidanceSystem",
      ...CORE_PROFILE_SYSTEMS,
      ...FINALIZE_PROFILE_SYSTEMS
    ]) diagnostics.registerSystem(name);

    if (typeof window !== "undefined") diagnostics.expose(window);
    else diagnostics.expose(globalThis);
  }

  update(_time, deltaMs) {
    const scene = this.scene;
    const diagnostics = this.diagnostics;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    diagnostics.beginFrame();

    let coreMark = diagnostics.beginSystem("Core.Input");
    scene.deathRecoverySystem?.update?.(dt);
    this.autoConsumeHospitalBloodBag();

    const rawFrame = scene.inputSystem?.beginFrame() || createEmptyInputFrame();
    scene.playerDamageSystem?.preUpdate(rawFrame);
    const frame = scene.playerDamageSystem?.filterFrame(rawFrame) || rawFrame;
    scene.currentInputFrame = frame;
    scene.aiStateSystem?.preUpdate?.(dt, frame);
    scene.weaponSystem?.update(frame);
    diagnostics.endSystem("Core.Input", coreMark);

    if (!frame.worldEnabled) {
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.drainSystem?.update(0, frame);
      scene.policeFirearmSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      this.updateFinalizeSystems(0, frame);
      coreMark = diagnostics.beginSystem("Core.Finalize");
      this.finishFrame();
      diagnostics.endSystem("Core.Finalize", coreMark);
      return;
    }

    if (scene.transitionSystem?.active) {
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.drainSystem?.update(0, frame);
      scene.policeFirearmSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      this.updateFinalizeSystems(0, frame);
      coreMark = diagnostics.beginSystem("Core.Finalize");
      this.finishFrame();
      diagnostics.endSystem("Core.Finalize", coreMark);
      return;
    }

    if (scene.interactionSystem.isOpen) {
      scene.interactionSystem.updateInput(frame);
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.npcSystem.refreshVisibility();
      scene.drainSystem?.update(0, frame);
      scene.policeFirearmSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      this.updateFinalizeSystems(0, frame);
      coreMark = diagnostics.beginSystem("Core.Finalize");
      this.finishFrame();
      diagnostics.endSystem("Core.Finalize", coreMark);
      return;
    }

    coreMark = diagnostics.beginSystem("Core.Combat");
    scene.handleLayerDebugInput(frame);
    scene.powersSystem.update(dt, frame);
    scene.combatSystem?.update(dt, frame);
    scene.drainSystem?.update(dt, frame);
    diagnostics.endSystem("Core.Combat", coreMark);

    coreMark = diagnostics.beginSystem("Core.InteractionQuery");
    let availableActions = this.filterActions(scene.collectInteractions());
    let split = splitActions(availableActions);
    scene.nearestMovement = nearest(scene, split.movement);
    scene.nearestInteraction = nearest(scene, split.interaction);

    const combatBusy = Boolean(
      scene.combatSystem?.isBusy()
      || scene.playerDamageSystem?.isHitStunned()
      || scene.drainSystem?.isBusy()
    );

    if (!combatBusy && frame.traversePressed && !scene.feedingSystem.isActive()) {
      const option = scene.nearestMovement;
      if (option) {
        scene.interactionSystem.runOption(option);
        scene.nearestMovement = null;
        scene.nearestInteraction = null;
      }
    }

    if (!combatBusy && !scene.transitionSystem?.active && frame.interactPressed && split.interaction.length) {
      const handled = scene.interactionSystem.handleAction(split.interaction);
      if (handled) {
        scene.nearestInteraction = scene.interactionSystem.isOpen
          ? null
          : nearest(scene, splitActions(this.filterActions(scene.collectInteractions())).interaction);
      }
    }
    diagnostics.endSystem("Core.InteractionQuery", coreMark);

    coreMark = diagnostics.beginSystem("Core.WorldActors");
    if (!scene.interactionSystem.isOpen && !scene.transitionSystem?.active) {
      if (scene.feedingSystem.isActive()) {
        scene.witnessSystem.update(dt);
        scene.feedingSystem.update(dt, frame.hasMovementIntent);
        scene.npcSystem.update(0);
      } else {
        const movementBlocked = scene.combatSystem?.blocksMovement() || scene.playerDamageSystem?.blocksMovement();
        if (!movementBlocked) {
          const leaving = scene.outskirtsSystem?.isTryingToLeave?.(frame);
          scene.updatePlayerMovement(dt, frame);
          if (leaving) void scene.outskirtsSystem?.warnBoundary?.();
        }
        scene.npcSystem.update(dt);
        scene.witnessSystem.update(dt);
      }
    }
    diagnostics.endSystem("Core.WorldActors", coreMark);

    coreMark = diagnostics.beginSystem("Core.WorldState");
    if (!scene.interactionSystem.isOpen && !scene.transitionSystem?.active) {
      scene.evidenceSystem.update(dt);
      scene.heatSystem?.cool?.(dt);
      scene.exposureSystem.cool(dt);
      scene.policeSystem.update(dt);
      scene.policeFirearmSystem?.update(dt, frame);
      scene.hunterSystem.update(dt);
      scene.npcSystem.rebuildSpatialIndex?.();
      scene.aiStateSystem?.postUpdate?.(dt, frame);
      scene.playerDamageSystem?.postUpdate(dt, frame);
      scene.missionSystem.update();
      scene.tutorialDirector?.update?.(dt, frame);
    } else {
      scene.policeFirearmSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
    }
    diagnostics.endSystem("Core.WorldState", coreMark);

    if (!scene.interactionSystem.isOpen && !scene.transitionSystem?.active) {
      coreMark = diagnostics.beginSystem("Core.InteractionRefresh");
      availableActions = this.filterActions(scene.collectInteractions());
      split = splitActions(availableActions);
      scene.nearestMovement = nearest(scene, split.movement);
      scene.nearestInteraction = nearest(scene, split.interaction);
      diagnostics.endSystem("Core.InteractionRefresh", coreMark);
    }

    coreMark = diagnostics.beginSystem("Core.Finalize");
    this.updateFinalizeSystems(dt, frame);
    this.finishFrame();
    diagnostics.endSystem("Core.Finalize", coreMark);
  }

  updateFinalizeSystems(dt, frame) {
    const scene = this.scene;
    const diagnostics = this.diagnostics;

    let finalizeMark = diagnostics.beginSystem?.("Finalize.MovementNoise") ?? null;
    scene.movementNoiseSystem?.update(frame);
    diagnostics.endSystem?.("Finalize.MovementNoise", finalizeMark);

    finalizeMark = diagnostics.beginSystem?.("Finalize.UxGuidance") ?? null;
    scene.uxGuidanceSystem?.update?.(dt, frame);
    diagnostics.endSystem?.("Finalize.UxGuidance", finalizeMark);
  }

  autoConsumeHospitalBloodBag() {
    const scene = this.scene;
    const recovery = scene.deathRecoverySystem;
    if (!recovery?.hospitalRecoveryIntroComplete || recovery.recoveryBagCollected) return false;
    if (scene.currentLayer !== LAYERS.STREET || scene.interactionSystem?.isOpen || scene.transitionSystem?.active) return false;
    const option = recovery.collectInteractions?.().find(candidate => candidate?.id === HOSPITAL_BLOOD_BAG_ID);
    if (!option || typeof option.run !== "function") return false;
    if (typeof scene.interactionSystem?.runOption === "function") scene.interactionSystem.runOption(option);
    else option.run();
    return true;
  }

  filterActions(options) {
    return this.scene.tutorialDirector?.filterActions?.(options) || options;
  }

  finishFrame() {
    const scene = this.scene;
    const diagnostics = this.diagnostics;

    let finalizeMark = diagnostics.beginSystem?.("Finalize.Camera") ?? null;
    const cinematicOwnsCamera = Boolean(
      scene.taskRevealCinematic?.active
      || scene.registry?.get?.("taskRevealActive")
    );
    if (!cinematicOwnsCamera) scene.updateCameraForLayer();
    diagnostics.endSystem?.("Finalize.Camera", finalizeMark);

    finalizeMark = diagnostics.beginSystem?.("Finalize.Markers") ?? null;
    scene.outskirtsSystem?.updatePresentation?.();
    scene.objectiveMarkerSystem?.update?.(scene.time?.now || 0);
    scene.drawPromptMarker();
    diagnostics.endSystem?.("Finalize.Markers", finalizeMark);

    finalizeMark = diagnostics.beginSystem?.("Finalize.Diagnostics") ?? null;
    const frameMs = diagnostics.endFrame();
    const diagnosticsSnapshot = diagnostics.snapshot();
    diagnostics.endSystem?.("Finalize.Diagnostics", finalizeMark);

    finalizeMark = diagnostics.beginSystem?.("Finalize.StatePublisher") ?? null;
    scene.statePublisher?.setMany?.({
      performanceText: `Frame ${frameMs.toFixed(2)} ms · spatial NPCs ${scene.npcSystem?.spatial?.size?.() || 0}`
    });
    if (diagnosticsSnapshot !== this.lastDiagnosticsSnapshot) {
      this.lastDiagnosticsSnapshot = diagnosticsSnapshot;
      scene.statePublisher?.setMany?.({
        runtimeText: diagnostics.summary(),
        runtimeDiagnostics: diagnosticsSnapshot
      });
    }
    diagnostics.endSystem?.("Finalize.StatePublisher", finalizeMark);

    finalizeMark = diagnostics.beginSystem?.("Finalize.PublishState") ?? null;
    scene.publishState();
    diagnostics.endSystem?.("Finalize.PublishState", finalizeMark);
  }

  handleLayerDebugInput(frame = this.scene.currentInputFrame) {
    const layer = Number(frame?.debugLayerPressed || 0);
    if (layer === 1) this.scene.switchLayer(LAYERS.STREET, CITY_ANCHORS.streetSpawn, "Debug: street layer.");
    if (layer === 2) this.scene.switchLayer(LAYERS.ROOF_LOW, CITY_ANCHORS.roofLowSpawn, "Debug: low rooftops.");
    if (layer === 3) this.scene.switchLayer(LAYERS.ROOF_HIGH, CITY_ANCHORS.roofHighSpawn, "Debug: high refuge rooftop.");
    if (layer === 4) this.scene.switchLayer(LAYERS.SEWER, CITY_ANCHORS.sewerSpawn, "Debug: sewer layer.");
  }

  destroy() {
    this.scene.deathRecoverySystem?.destroy?.();
    this.scene.deathRecoverySystem = null;
    this.scene.policeFirearmSystem?.destroy?.();
    this.scene.policeFirearmSystem = null;
    this.scene.traversalPromptLabel?.destroy?.();
    this.scene.traversalPromptLabel = null;
  }
}
