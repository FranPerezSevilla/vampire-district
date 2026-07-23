import { MOTORIZED_POLICE_ROLES } from "./MotorizedPolicePolicy.js";

export function installMotorizedPoliceLocalPolicy(system) {
  if (!system?.safeCandidate || !system?.dismountUnit) {
    throw new TypeError("Motorized police local policy requires a response system.");
  }

  const originalSafeCandidate = system.safeCandidate;
  const originalDismountUnit = system.dismountUnit;

  function macroAwareSafeCandidate(unit, point) {
    // Distant response movement is abstract. Local traffic and authored parked
    // vehicles can only block a cruiser after that cruiser has materialized.
    if (!unit?.visible) return true;
    return originalSafeCandidate.call(this, unit, point);
  }

  function arrivalAwareDismount(unitId, reason = "intercept") {
    const unit = this.units?.find?.(candidate => candidate.id === unitId);
    if (unit?.role === MOTORIZED_POLICE_ROLES.ROADBLOCK
      && reason === "roadblock"
      && !unit.arrived) {
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
