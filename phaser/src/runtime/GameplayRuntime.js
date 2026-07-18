import { CombatSystem } from "../combat/CombatSystem.js";
import { DrainSystem } from "../combat/DrainSystem.js";
import { PlayerDamageSystem } from "../combat/PlayerDamageSystem.js";
import { LAYERS } from "../data/district.js";
import { InputSystem } from "../input/InputSystem.js";
import { createEmptyInputFrame } from "../input/actions.js";
import { isTraversalAction } from "../systems/InteractionSystem.js";
import { AiStateSystem } from "../systems/AiStateSystem.js";
import { MovementNoiseSystem } from "../systems/MovementNoiseSystem.js";
import { PoliceViolenceSystem } from "../systems/PoliceViolenceSystem.js";
import { PropDamageSystem } from "../systems/PropDamageSystem.js";
import { SensoryAwarenessSystem } from "../systems/SensoryAwarenessSystem.js";
import { TaskRevealSystem } from "../systems/TaskRevealSystem.js";
import { UxGuidanceSystem } from "../systems/UxGuidanceSystem.js";
import { WeaponSystem } from "../systems/WeaponSystem.js";
import { RuntimeDiagnostics } from "./RuntimeDiagnostics.js";

function splitActions(options = []) {
  const movement = [];
  const interaction = [];
  for (const option of options) {
    (isTraversalAction(option) ? movement : interaction).push(option);
  }
  return { movement, interaction };
}

function nearest(scene, options = []) {
  return scene.interactionSystem.sortOptions(options)[0] || null;
}

export class GameplayRuntime {
  constructor(scene) {
    this.scene = scene;
    this.diagnostics = new RuntimeDiagnostics({ sampleSize: 180 });
    this.installDiagnostics();

    scene.inputSystem?.destroy?.();
    scene.inputSystem = new InputSystem(scene);
    scene.keys = scene.inputSystem.keys;
    scene.currentInputFrame = scene.inputSystem.snapshot();

    scene.weaponSystem = new WeaponSystem(scene);
    scene.combatSystem = new CombatSystem(scene);
    scene.playerDamageSystem = new PlayerDamageSystem(scene);
    scene.drainSystem = new DrainSystem(scene);
    scene.movementNoiseSystem = new MovementNoiseSystem(scene);
    scene.propDamageSystem = new PropDamageSystem(scene);
    scene.sensoryAwarenessSystem = new SensoryAwarenessSystem(scene);
    scene.aiStateSystem = new AiStateSystem(scene);
    scene.policeViolenceSystem = new PoliceViolenceSystem(scene);
    scene.taskRevealSystem = new TaskRevealSystem(scene);
    scene.uxGuidanceSystem = new UxGuidanceSystem(scene);

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
    diagnostics.claim("PowersSystem.update", "PowersSystem");
    diagnostics.claim("NpcSystem.updateNpc", "NpcSystem");
    diagnostics.claim("WitnessSystem.drawMarkers", "WitnessSystem");
    diagnostics.claim("PoliceSystem.updatePolice", "PoliceSystem");
    diagnostics.claim("HunterSystem.updateHunters", "HunterSystem");
    diagnostics.claim("CombatSystem.notifyViolence", "CombatSystem");
    diagnostics.claim("TaskRevealSystem.play", "TaskRevealSystem");

    for (const name of [
      "InputSystem",
      "WeaponSystem",
      "CombatSystem",
      "PlayerDamageSystem",
      "DrainSystem",
      "MovementNoiseSystem",
      "PropDamageSystem",
      "SensoryAwarenessSystem",
      "AiStateSystem",
      "PoliceViolenceSystem",
      "TaskRevealSystem",
      "UxGuidanceSystem"
    ]) diagnostics.registerSystem(name);

    if (typeof window !== "undefined") diagnostics.expose(window);
    else diagnostics.expose(globalThis);
  }

  update(_time, deltaMs) {
    const scene = this.scene;
    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    this.diagnostics.beginFrame();

    const rawFrame = scene.inputSystem?.beginFrame() || createEmptyInputFrame();
    scene.playerDamageSystem?.preUpdate(rawFrame);
    const frame = scene.playerDamageSystem?.filterFrame(rawFrame) || rawFrame;
    scene.currentInputFrame = frame;
    scene.aiStateSystem?.preUpdate?.(dt, frame);
    scene.weaponSystem?.update(frame);

    if (!frame.worldEnabled) {
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.drainSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      scene.movementNoiseSystem?.update(frame);
      scene.uxGuidanceSystem?.update?.(0, frame);
      this.finishFrame();
      return;
    }

    if (scene.transitionSystem?.active) {
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.drainSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      scene.movementNoiseSystem?.update(frame);
      scene.uxGuidanceSystem?.update?.(0, frame);
      this.finishFrame();
      return;
    }

    if (scene.interactionSystem.isOpen) {
      scene.interactionSystem.updateInput(frame);
      scene.nearestMovement = null;
      scene.nearestInteraction = null;
      scene.npcSystem.refreshVisibility();
      scene.drainSystem?.update(0, frame);
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
      scene.movementNoiseSystem?.update(frame);
      scene.uxGuidanceSystem?.update?.(0, frame);
      this.finishFrame();
      return;
    }

    scene.handleLayerDebugInput(frame);
    scene.powersSystem.update(dt, frame);
    scene.combatSystem?.update(dt, frame);
    scene.drainSystem?.update(dt, frame);

    let availableActions = scene.collectInteractions();
    let split = splitActions(availableActions);
    scene.nearestMovement = nearest(scene, split.movement);
    scene.nearestInteraction = nearest(scene, split.interaction);

    const combatBusy = Boolean(
      scene.combatSystem?.isBusy()
      || scene.playerDamageSystem?.isHitStunned()
      || scene.drainSystem?.isBusy()
    );

    if (!combatBusy && frame.traversePressed && !scene.feedingSystem.isActive()) {
      const option = nearest(scene, split.movement);
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
          : nearest(scene, splitActions(scene.collectInteractions()).interaction);
      }
    }

    if (!scene.interactionSystem.isOpen && !scene.transitionSystem?.active) {
      if (scene.feedingSystem.isActive()) {
        scene.witnessSystem.update(dt);
        scene.feedingSystem.update(dt, frame.hasMovementIntent);
        scene.npcSystem.update(0);
      } else {
        const movementBlocked = scene.combatSystem?.blocksMovement() || scene.playerDamageSystem?.blocksMovement();
        if (!movementBlocked) scene.updatePlayerMovement(dt, frame);
        scene.npcSystem.update(dt);
        scene.witnessSystem.update(dt);
      }

      scene.evidenceSystem.update(dt);
      scene.exposureSystem.cool(dt);
      scene.policeSystem.update(dt);
      scene.hunterSystem.update(dt);
      scene.npcSystem.rebuildSpatialIndex?.();
      scene.aiStateSystem?.postUpdate?.(dt, frame);
      scene.playerDamageSystem?.postUpdate(dt, frame);
      scene.missionSystem.update();

      availableActions = scene.collectInteractions();
      split = splitActions(availableActions);
      scene.nearestMovement = nearest(scene, split.movement);
      scene.nearestInteraction = nearest(scene, split.interaction);
    } else {
      scene.playerDamageSystem?.postUpdate(0, frame);
      scene.aiStateSystem?.postUpdate?.(0, frame);
    }

    scene.movementNoiseSystem?.update(frame);
    scene.uxGuidanceSystem?.update?.(dt, frame);
    this.finishFrame();
  }

  finishFrame() {
    const scene = this.scene;
    scene.updateCameraForLayer();
    scene.drawPromptMarker();
    const frameMs = this.diagnostics.endFrame();
    scene.statePublisher?.setMany?.({
      runtimeText: this.diagnostics.summary(),
      performanceText: `Frame ${frameMs.toFixed(2)} ms · spatial NPCs ${scene.npcSystem?.spatial?.size?.() || 0}`,
      runtimeDiagnostics: this.diagnostics.snapshot()
    });
    scene.publishState();
  }

  handleLayerDebugInput(frame = this.scene.currentInputFrame) {
    const layer = Number(frame?.debugLayerPressed || 0);
    if (layer === 1) this.scene.switchLayer(LAYERS.STREET, { x: 488, y: 326 }, "Debug: street layer.");
    if (layer === 2) this.scene.switchLayer(LAYERS.ROOF_LOW, { x: 345, y: 168 }, "Debug: low rooftops.");
    if (layer === 3) this.scene.switchLayer(LAYERS.ROOF_HIGH, { x: 150, y: 146 }, "Debug: high refuge rooftop.");
    if (layer === 4) this.scene.switchLayer(LAYERS.SEWER, { x: 472, y: 326 }, "Debug: sewer layer.");
  }

  destroy() {
    this.scene.traversalPromptLabel?.destroy?.();
    this.scene.traversalPromptLabel = null;
  }
}
