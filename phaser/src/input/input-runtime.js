import { CombatSystem } from "../combat/CombatSystem.js";
import { PLAYER } from "../data/balance.js";
import { LAYERS } from "../data/district.js";
import { GameScene } from "../scenes/GameScene.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { PowersSystem } from "../systems/PowersSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { InputSystem } from "./InputSystem.js";
import { createEmptyInputFrame } from "./actions.js";

const MOVEMENT_ACTION_TYPES = new Set([
  "fireEscapeUp",
  "fireEscapeDown",
  "sewerDown",
  "sewerUp",
  "privateShaft",
  "roofJump",
  "roofDrop"
]);

function isMovementAction(option) {
  return Boolean(option && MOVEMENT_ACTION_TYPES.has(option.type));
}

function splitActions(options = []) {
  const movement = [];
  const interaction = [];
  for (const option of options) {
    (isMovementAction(option) ? movement : interaction).push(option);
  }
  return { movement, interaction };
}

function nearest(scene, options = []) {
  return scene.interactionSystem.sortOptions(options)[0] || null;
}

function runMovementAction(scene, options) {
  const option = nearest(scene, options);
  if (!option) return false;
  scene.interactionSystem.runOption(option);
  return true;
}

function installGameSceneInputRuntime() {
  if (GameScene.prototype.__nbdInputRuntimePatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalPublishState = GameScene.prototype.publishState;

  GameScene.prototype.create = function createWithInputSystem(...args) {
    const result = originalCreate.apply(this, args);
    this.inputSystem?.destroy?.();
    this.inputSystem = new InputSystem(this, { keys: this.keys });
    this.keys = this.inputSystem.keys;
    this.currentInputFrame = this.inputSystem.snapshot();
    this.combatSystem?.destroy?.();
    this.combatSystem = new CombatSystem(this);
    this.nearestMovement = null;
    return result;
  };

  GameScene.prototype.update = function updateFromInputFrame(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const frame = this.inputSystem?.beginFrame() || createEmptyInputFrame();
    this.currentInputFrame = frame;

    if (this.transitionSystem?.active) {
      this.nearestMovement = null;
      this.nearestInteraction = null;
      this.updateCameraForLayer();
      this.drawPromptMarker();
      this.publishState();
      return;
    }

    if (this.interactionSystem.isOpen) {
      this.interactionSystem.updateInput(frame);
      this.nearestMovement = null;
      this.nearestInteraction = null;
      this.npcSystem.refreshVisibility();
      this.updateCameraForLayer();
      this.drawPromptMarker();
      this.publishState();
      return;
    }

    this.handleLayerDebugInput(frame);
    this.powersSystem.update(dt, frame);
    this.combatSystem?.update(dt, frame);

    let availableActions = this.collectInteractions();
    let split = splitActions(availableActions);
    this.nearestMovement = nearest(this, split.movement);
    this.nearestInteraction = nearest(this, split.interaction);

    const combatBusy = Boolean(this.combatSystem?.isBusy());
    if (!combatBusy && frame.traversePressed && !this.feedingSystem.isActive()) {
      const handledMovement = runMovementAction(this, split.movement);
      if (handledMovement) {
        this.nearestMovement = null;
        this.nearestInteraction = null;
      }
    }

    if (!combatBusy && !this.transitionSystem?.active && frame.interactPressed && split.interaction.length) {
      const handled = this.interactionSystem.handleAction(split.interaction);
      if (handled) {
        this.nearestInteraction = this.interactionSystem.isOpen
          ? null
          : nearest(this, splitActions(this.collectInteractions()).interaction);
      }
    }

    if (!this.interactionSystem.isOpen && !this.transitionSystem?.active) {
      if (this.feedingSystem.isActive()) {
        this.witnessSystem.update(dt);
        this.feedingSystem.update(dt, frame.hasMovementIntent);
        this.npcSystem.update(0);
      } else {
        if (!this.combatSystem?.blocksMovement()) this.updatePlayerMovement(dt, frame);
        this.npcSystem.update(dt);
        this.witnessSystem.update(dt);
      }

      this.evidenceSystem.update(dt);
      this.exposureSystem.cool(dt);
      this.policeSystem.update(dt);
      this.hunterSystem.update(dt);
      this.missionSystem.update();

      availableActions = this.collectInteractions();
      split = splitActions(availableActions);
      this.nearestMovement = nearest(this, split.movement);
      this.nearestInteraction = nearest(this, split.interaction);
    }

    this.updateCameraForLayer();
    this.drawPromptMarker();
    this.publishState();
  };

  GameScene.prototype.handleLayerDebugInput = function handleLayerDebugInput(frame = this.currentInputFrame) {
    const layer = Number(frame?.debugLayerPressed || 0);
    if (layer === 1) this.switchLayer(LAYERS.STREET, { x: 488, y: 326 }, "Debug: street layer.");
    if (layer === 2) this.switchLayer(LAYERS.ROOF_LOW, { x: 345, y: 168 }, "Debug: low rooftops.");
    if (layer === 3) this.switchLayer(LAYERS.ROOF_HIGH, { x: 150, y: 146 }, "Debug: high refuge rooftop.");
    if (layer === 4) this.switchLayer(LAYERS.SEWER, { x: 472, y: 326 }, "Debug: sewer layer.");
  };

  GameScene.prototype.playerHasMovementIntent = function playerHasMovementIntent(frame = this.currentInputFrame) {
    return Boolean(frame?.hasMovementIntent);
  };

  GameScene.prototype.updatePlayerMovement = function updatePlayerMovementFromFrame(dt, frame = this.currentInputFrame) {
    const move = frame?.move || { x: 0, y: 0 };
    if (!frame?.hasMovementIntent) return;

    const speed = this.playerSpeed * (frame.sprintHeld ? PLAYER.sprintMultiplier : 1);
    const nextX = this.player.x + move.x * speed * dt;
    const nextY = this.player.y + move.y * speed * dt;

    if (this.canStandAt(nextX, this.player.y)) this.player.x = nextX;
    if (this.canStandAt(this.player.x, nextY)) this.player.y = nextY;
  };

  GameScene.prototype.drawPromptMarker = function drawPromptMarkerForContext() {
    this.promptGraphics.clear();
    const target = this.nearestMovement || this.nearestInteraction;
    if (target) {
      const { x, y } = target;
      const movement = isMovementAction(target);
      const color = movement ? 0x78c7a3 : 0xfff2a8;
      this.promptGraphics.lineStyle(2, color, 0.95).strokeCircle(x, y, 15);
      this.promptGraphics.fillStyle(color, 0.15).fillCircle(x, y, 15);
    }
    this.npcSystem?.drawMarkers?.(this.promptGraphics);
    this.witnessSystem?.drawMarkers?.(this.promptGraphics);
    this.evidenceSystem?.drawMarkers?.(this.promptGraphics);
    this.drawFeedingProgress?.();
  };

  GameScene.prototype.publishState = function publishStateFromInputRuntime(...args) {
    const result = originalPublishState.apply(this, args);
    const prompt = this.interactionSystem.isOpen
      ? ""
      : this.nearestMovement
        ? `SPACE: ${this.nearestMovement.label}`
        : this.nearestInteraction
          ? `E: ${this.nearestInteraction.label}`
          : "";
    this.registry.set("interactionPrompt", prompt);
    return result;
  };

  GameScene.prototype.__nbdInputRuntimePatch = true;
  GameScene.prototype.__nbdMovementControlsPatch = true;
}

function installInteractionInputRuntime() {
  if (InteractionSystem.prototype.__nbdInputRuntimePatch) return;

  InteractionSystem.prototype.updateInput = function updateInteractionMenuFromFrame(frame) {
    if (!this.menu) return false;

    if (frame?.menuCancelPressed) {
      this.close();
      return true;
    }

    if (frame?.menuUpPressed) {
      this.menu.index = (this.menu.index - 1 + this.menu.options.length) % this.menu.options.length;
      RawAudio.play("menu");
      this.publish();
      return true;
    }

    if (frame?.menuDownPressed) {
      this.menu.index = (this.menu.index + 1) % this.menu.options.length;
      RawAudio.play("menu");
      this.publish();
      return true;
    }

    const digit = Number(frame?.menuDigitPressed || 0);
    if (digit >= 1 && digit <= this.menu.options.length) {
      this.runOption(this.menu.options[digit - 1]);
      return true;
    }

    if (frame?.menuConfirmPressed) {
      this.runSelected();
      return true;
    }

    return true;
  };

  InteractionSystem.prototype.__nbdInputRuntimePatch = true;
  InteractionSystem.prototype.__nbdMovementControlsPatch = true;
}

function installPowerInputRuntime() {
  if (PowersSystem.prototype.__nbdInputRuntimePatch) return;

  PowersSystem.prototype.update = function updatePowersFromFrame(dt, frame) {
    this.scene.feedingSystem?.addPassiveHunger(dt);
    this.cooldowns.dash = Math.max(0, this.cooldowns.dash - dt);
    this.cooldowns.whisper = Math.max(0, this.cooldowns.whisper - dt);
    this.cooldowns.sense = Math.max(0, this.cooldowns.sense - dt);
    this.senseTimer = Math.max(0, this.senseTimer - dt);

    const move = frame?.move || { x: 0, y: 0 };
    if (frame?.hasMovementIntent) this.lastDir = { x: move.x, y: move.y };

    if (!this.scene.interactionSystem?.isOpen && !this.scene.feedingSystem?.isActive()) {
      if (frame?.bloodSensePressed) this.useBloodSense();
      if (frame?.whisperPressed) this.useWhisper();
      if (frame?.dashPressed) this.useDash();
    }

    this.drawSenseOverlay();
    this.drawLureLines();
  };

  PowersSystem.prototype.__nbdInputRuntimePatch = true;
  PowersSystem.prototype.__nbdMovementControlsPatch = true;
}

installGameSceneInputRuntime();
installInteractionInputRuntime();
installPowerInputRuntime();
