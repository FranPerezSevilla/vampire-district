import { PLAYER } from "./data/balance.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { PowersSystem } from "./systems/PowersSystem.js";

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

function nearest(scene, options) {
  return scene.interactionSystem.sortOptions(options)[0] || null;
}

function runMovementAction(scene, options) {
  const option = nearest(scene, options);
  if (!option) return false;
  scene.interactionSystem.runOption(option);
  return true;
}

function installGameMovementControls() {
  if (GameScene.prototype.__nbdMovementControlsPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalPublishState = GameScene.prototype.publishState;

  GameScene.prototype.create = function createWithMovementControls(...args) {
    const result = originalCreate.apply(this, args);
    this.nearestMovement = null;
    return result;
  };

  GameScene.prototype.update = function updateWithSeparatedControls(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);

    if (this.transitionSystem?.active) {
      this.nearestMovement = null;
      this.nearestInteraction = null;
      this.updateCameraForLayer();
      this.drawPromptMarker();
      this.publishState();
      return;
    }

    if (this.interactionSystem.isOpen) {
      this.interactionSystem.updateInput(this.keys);
      this.nearestMovement = null;
      this.nearestInteraction = null;
      this.npcSystem.refreshVisibility();
      this.updateCameraForLayer();
      this.drawPromptMarker();
      this.publishState();
      return;
    }

    this.handleLayerDebugKeys();
    this.powersSystem.update(dt, this.keys);

    let availableActions = this.collectInteractions();
    let split = splitActions(availableActions);
    this.nearestMovement = nearest(this, split.movement);
    this.nearestInteraction = nearest(this, split.interaction);

    if (Phaser.Input.Keyboard.JustDown(this.keys.space) && !this.feedingSystem.isActive()) {
      const handledMovement = runMovementAction(this, split.movement);
      if (handledMovement) {
        this.nearestMovement = null;
        this.nearestInteraction = null;
      }
    }

    if (!this.transitionSystem?.active && Phaser.Input.Keyboard.JustDown(this.keys.interact) && split.interaction.length) {
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
        this.feedingSystem.update(dt, this.playerHasMovementIntent());
        this.npcSystem.update(0);
      } else {
        this.updatePlayerMovement(dt);
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

  GameScene.prototype.updatePlayerMovement = function updatePlayerMovementWithSpaceSprint(dt) {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.keys.left.isDown || this.keys.a.isDown) dir.x -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) dir.x += 1;
    if (this.keys.up.isDown || this.keys.w.isDown) dir.y -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown) dir.y += 1;
    if (dir.lengthSq() === 0) return;

    dir.normalize();
    const speed = this.playerSpeed * (this.keys.space.isDown ? PLAYER.sprintMultiplier : 1);
    const nextX = this.player.x + dir.x * speed * dt;
    const nextY = this.player.y + dir.y * speed * dt;

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
    this.witnessSystem?.drawMarkers(this.promptGraphics);
    this.evidenceSystem?.drawMarkers(this.promptGraphics);
    this.drawFeedingProgress();
  };

  GameScene.prototype.publishState = function publishStateWithContextPrompt(...args) {
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

  GameScene.prototype.__nbdMovementControlsPatch = true;
}

function installInteractionMenuControls() {
  if (InteractionSystem.prototype.__nbdMovementControlsPatch) return;

  InteractionSystem.prototype.updateInput = function updateInputWithoutSpace(keys) {
    if (!this.menu) return false;

    if (this.justDown(keys.escape)) {
      this.close();
      return true;
    }

    if (this.justDown(keys.up) || this.justDown(keys.w)) {
      this.menu.index = (this.menu.index - 1 + this.menu.options.length) % this.menu.options.length;
      this.publish();
      return true;
    }

    if (this.justDown(keys.down) || this.justDown(keys.s)) {
      this.menu.index = (this.menu.index + 1) % this.menu.options.length;
      this.publish();
      return true;
    }

    const digitKeys = [keys.street, keys.roofLow, keys.roofHigh, keys.sewer, keys.five, keys.six, keys.seven, keys.eight, keys.nine];
    for (let i = 0; i < digitKeys.length; i++) {
      if (this.justDown(digitKeys[i]) && i < this.menu.options.length) {
        this.runOption(this.menu.options[i]);
        return true;
      }
    }

    if (this.justDown(keys.interact) || this.justDown(keys.enter)) {
      this.runSelected();
      return true;
    }

    return true;
  };

  InteractionSystem.prototype.__nbdMovementControlsPatch = true;
}

function installPowerControls() {
  if (PowersSystem.prototype.__nbdMovementControlsPatch) return;

  PowersSystem.prototype.update = function updateWithoutSpaceDash(dt, keys) {
    this.scene.feedingSystem?.addPassiveHunger(dt);
    this.cooldowns.dash = Math.max(0, this.cooldowns.dash - dt);
    this.cooldowns.whisper = Math.max(0, this.cooldowns.whisper - dt);
    this.cooldowns.sense = Math.max(0, this.cooldowns.sense - dt);
    this.senseTimer = Math.max(0, this.senseTimer - dt);

    this.rememberMoveDirection(keys);

    if (!this.scene.interactionSystem?.isOpen && !this.scene.feedingSystem?.isActive()) {
      if (Phaser.Input.Keyboard.JustDown(keys.sense)) this.useBloodSense();
      if (Phaser.Input.Keyboard.JustDown(keys.whisper)) this.useWhisper();
      if (Phaser.Input.Keyboard.JustDown(keys.dash)) this.useDash();
    }

    this.drawSenseOverlay();
    this.drawLureLines();
  };

  PowersSystem.prototype.__nbdMovementControlsPatch = true;
}

function installUiControlCopy() {
  if (UIScene.prototype.__nbdMovementControlsPatch) return;

  const originalBindDom = UIScene.prototype.bindDom;
  const originalSetModal = UIScene.prototype.setModal;

  UIScene.prototype.bindDom = function bindMovementPromptKey(...args) {
    const result = originalBindDom.apply(this, args);
    this.dom.promptKey = this.dom.prompt?.querySelector("kbd") || null;
    return result;
  };

  UIScene.prototype.renderPrompt = function renderPromptWithDynamicKey(data) {
    const hasMenu = Boolean(data.menu && data.menu.options?.length);
    const prompt = !this.modalBlocksInput() && !hasMenu ? String(data.prompt || "") : "";
    const movementPrompt = /^SPACE:\s*/i.test(prompt);
    const cleanPrompt = prompt.replace(/^(?:SPACE|E):\s*/i, "");

    this.setText(this.dom.promptKey, movementPrompt ? "SPACE" : "E");
    this.setText(this.dom.promptText, cleanPrompt);
    this.dom.prompt?.classList.toggle("visible", Boolean(cleanPrompt));
    this.dom.prompt?.classList.toggle("movement", Boolean(cleanPrompt && movementPrompt));

    const toast = !this.modalBlocksInput() && data.lastAction ? data.lastAction : "";
    if (toast && toast !== this.lastToastText) {
      this.lastToastText = toast;
      this.toastUntil = this.time.now + 2800;
      this.setText(this.dom.toastText, toast);
    }
    const toastVisible = !this.modalBlocksInput() && Boolean(this.dom.toastText?.textContent) && this.time.now < this.toastUntil;
    this.dom.toast?.classList.toggle("visible", toastVisible);
  };

  UIScene.prototype.setModal = function setModalWithMovementControls(title, bodyHtml, actionLabel) {
    const updatedBody = String(bodyHtml || "")
      .replace("WASD/arrows move · Shift sprint · E interact · Q/Space Dash", "WASD/arrows move · hold Space to run · Space jumps/climbs/descends · E interacts · Q Dash")
      .replace("Movement: WASD/arrows · Shift sprint", "Movement: WASD/arrows · hold Space to run · Space near routes to jump, climb or descend")
      .replace("Powers: Q/Space Dash", "Powers: Q Dash");
    return originalSetModal.call(this, title, updatedBody, actionLabel);
  };

  UIScene.prototype.__nbdMovementControlsPatch = true;
}

installGameMovementControls();
installInteractionMenuControls();
installPowerControls();
installUiControlCopy();
