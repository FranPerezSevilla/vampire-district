import { movementSpeed } from "../data/movement.js";
import { evaluateTraversalCandidate, selectTraversalCandidate } from "../data/traversal.js";
import { GameScene } from "../scenes/GameScene.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { MovementNoiseSystem } from "../systems/MovementNoiseSystem.js";

const TRAVERSAL_TYPES = new Set([
  "fireEscapeUp",
  "fireEscapeDown",
  "sewerDown",
  "sewerUp",
  "privateShaft",
  "roofJump",
  "roofDrop"
]);

function isTraversal(option) {
  return Boolean(option && TRAVERSAL_TYPES.has(option.type));
}

function installTraversalSelection() {
  if (InteractionSystem.prototype.__nbdDeterministicTraversalPatch) return;

  const originalSortOptions = InteractionSystem.prototype.sortOptions;
  InteractionSystem.prototype.sortOptions = function sortOptionsWithTraversalAim(options = []) {
    if (options.length && options.every(isTraversal) && this.scene?.player) {
      const player = { x: this.scene.player.x, y: this.scene.player.y };
      const aim = this.scene.combatSystem?.aimDirection || { x: 0, y: -1 };
      const selected = selectTraversalCandidate(player, aim, options);
      if (!selected) return [];
      return [...options].sort((a, b) => {
        if (a === selected) return -1;
        if (b === selected) return 1;
        const ea = evaluateTraversalCandidate(player, aim, a);
        const eb = evaluateTraversalCandidate(player, aim, b);
        const score = ea.score - eb.score;
        if (Math.abs(score) > 1e-9) return score;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
    }
    return originalSortOptions.call(this, options);
  };

  InteractionSystem.prototype.__nbdDeterministicTraversalPatch = true;
}

function installMovementRuntime() {
  if (GameScene.prototype.__nbdMilestone5MovementPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalUpdate = GameScene.prototype.update;
  const originalDrawPromptMarker = GameScene.prototype.drawPromptMarker;

  GameScene.prototype.create = function createWithDefaultRun(...args) {
    const result = originalCreate.apply(this, args);
    this.movementNoiseSystem?.destroy?.();
    this.movementNoiseSystem = new MovementNoiseSystem(this);
    this.traversalPromptLabel?.destroy?.();
    this.traversalPromptLabel = this.add.text(0, 0, "SPACE", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "9px",
      fontStyle: "bold",
      color: "#dfffee",
      backgroundColor: "rgba(5, 12, 11, .82)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    this.traversalPromptLabel.setResolution?.(3);
    this.traversalPromptLabel.setStroke?.("#05060b", 2);
    return result;
  };

  GameScene.prototype.updatePlayerMovement = function updatePlayerMovementDefaultRun(dt, frame = this.currentInputFrame) {
    const move = frame?.move || { x: 0, y: 0 };
    if (!frame?.hasMovementIntent) return;

    const speed = movementSpeed(this.playerSpeed, frame.quietHeld);
    const nextX = this.player.x + move.x * speed * dt;
    const nextY = this.player.y + move.y * speed * dt;

    if (this.canStandAt(nextX, this.player.y)) this.player.x = nextX;
    if (this.canStandAt(this.player.x, nextY)) this.player.y = nextY;
  };

  GameScene.prototype.update = function updateWithMovementNoise(...args) {
    const result = originalUpdate.apply(this, args);
    this.movementNoiseSystem?.update(this.currentInputFrame);
    return result;
  };

  GameScene.prototype.drawPromptMarker = function drawPromptMarkerWithTraversalIcon(...args) {
    const result = originalDrawPromptMarker.apply(this, args);
    const target = this.nearestMovement;
    const visible = Boolean(target && !this.transitionSystem?.active && !this.interactionSystem?.isOpen);
    this.traversalPromptLabel
      ?.setPosition(target?.x || 0, (target?.y || 0) - 18)
      .setVisible(visible);
    return result;
  };

  GameScene.prototype.__nbdMilestone5MovementPatch = true;
}

installTraversalSelection();
installMovementRuntime();
