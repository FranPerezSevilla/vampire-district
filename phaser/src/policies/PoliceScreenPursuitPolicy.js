import { PoliceSystem } from "../systems/PoliceSystem.js";

export function copIsOnScreen(scene, cop, margin = 18) {
  const view = scene?.cameras?.main?.worldView;
  if (!view || !cop) return false;
  const padding = Math.max(0, Number(margin) || 0);
  const right = Number.isFinite(view.right) ? view.right : (Number(view.x) || 0) + (Number(view.width) || 0);
  const bottom = Number.isFinite(view.bottom) ? view.bottom : (Number(view.y) || 0) + (Number(view.height) || 0);
  return cop.x >= view.x - padding
    && cop.x <= right + padding
    && cop.y >= view.y - padding
    && cop.y <= bottom + padding;
}

export function pursuingCopHasScreenContact(scene, cop) {
  return Boolean(
    cop?.chasingPlayer
    && !cop?.dead
    && !cop?.inactive
    && cop?.layer === scene?.currentLayer
    && copIsOnScreen(scene, cop)
  );
}

export function installPoliceScreenPursuitPolicy() {
  if (PoliceSystem.prototype.__viceBloodScreenPursuitPolicy) return;
  PoliceSystem.prototype.__viceBloodScreenPursuitPolicy = true;
  const originalPlayerVisibleToCop = PoliceSystem.prototype.playerVisibleToCop;

  PoliceSystem.prototype.playerVisibleToCop = function viceBloodPlayerVisibleToCop(cop, radius, shadowRadius = 0) {
    // Once a pursuit is established, an officer who is visibly sharing the
    // player's screen keeps pressure instead of forgetting the target because
    // their narrow perception cone happens to rotate away for a frame.
    if (pursuingCopHasScreenContact(this.scene, cop)) return true;
    return originalPlayerVisibleToCop.call(this, cop, radius, shadowRadius);
  };
}
