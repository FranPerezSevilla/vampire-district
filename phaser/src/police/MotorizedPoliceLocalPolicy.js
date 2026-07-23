import { MOTORIZED_POLICE_ROLES } from "./MotorizedPolicePolicy.js";

export function installMotorizedPoliceLocalPolicy(system) {
  if (!system?.safeCandidate || !system?.dismountUnit) {
    throw new TypeError("Motorized police local policy requires a response system.");
  }

  const originalSafeCandidate = system.safeCandidate;
  const originalDismountUnit = system.dismountUnit;

  function macroAwareSafeCandidate(unit, point) {
    // Distant response movement is abstract. Local blockers matter only after
    // the candidate position enters the local materialization window.
    const candidate = { ...unit, x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
    const focus = this.targetFocus?.() || this.scene?.renderFocus?.() || this.scene?.player || { x: 0, y: 0 };
    const candidateWillBeLocal = Boolean(this.shouldMaterialize?.(candidate, focus));
    if (!unit?.visible && !candidateWillBeLocal) return true;
    return originalSafeCandidate.call(this, unit, point);
  }

  function arrivalAwareDismount(unitId, reason = "intercept") {
    const unit = this.units?.find?.(candidate => candidate.id === unitId);
    const blockedLongEnough = Number(unit?.blockedSeconds) >= 1.15;
    if (unit?.role === MOTORIZED_POLICE_ROLES.ROADBLOCK
      && reason === "roadblock"
      && !unit.arrived
      && !blockedLongEnough) {
      return [];
    }
    return originalDismountUnit.call(this, unitId, reason);
  }

  system.safeCandidate = macroAwareSafeCandidate;
  system.dismountUnit = arrivalAwareDismount;

  return Object.freeze({
    destroy() {
      if (system.safeCandidate === macroAwareSafeCandidate) {
        system.safeCandidate = originalSafeCandidate;
      }
      if (system.dismountUnit === arrivalAwareDismount) {
        system.dismountUnit = originalDismountUnit;
      }
    }
  });
}
