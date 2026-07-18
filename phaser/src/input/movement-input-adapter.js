import { PlayerDamageSystem } from "../combat/PlayerDamageSystem.js";
import { InputSystem } from "./InputSystem.js";
import { INPUT_ACTIONS, modeAllows } from "./actions.js";

if (!InputSystem.prototype.__nbdTraversalOnlySpacePatch) {
  const originalBeginFrame = InputSystem.prototype.beginFrame;

  InputSystem.prototype.beginFrame = function beginFrameWithQuietMovement(...args) {
    const frame = originalBeginFrame.apply(this, args);
    const movementAllowed = frame.worldEnabled && modeAllows(this.controlMode, INPUT_ACTIONS.MOVE);
    frame.quietHeld = movementAllowed && this.isDown(this.keys.shift);
    frame.sprintHeld = false;
    this.frame = frame;
    return frame;
  };

  InputSystem.prototype.__nbdTraversalOnlySpacePatch = true;
}

if (!PlayerDamageSystem.prototype.__nbdQuietMovementFilterPatch) {
  const originalFilterFrame = PlayerDamageSystem.prototype.filterFrame;

  PlayerDamageSystem.prototype.filterFrame = function filterFrameWithoutQuietMovementDuringStun(frame) {
    const filtered = originalFilterFrame.call(this, frame);
    if (filtered !== frame) filtered.quietHeld = false;
    return filtered;
  };

  PlayerDamageSystem.prototype.__nbdQuietMovementFilterPatch = true;
}
