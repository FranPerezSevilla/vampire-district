import { MOTORIZED_POLICE_ROLES, MOTORIZED_POLICE_TACTICS, predictInterceptPoint } from "./MotorizedPolicePolicy.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function installMotorizedPoliceContainmentPolicy(system, {
  stopSpeed = 14,
  stopHoldSeconds = 0.72,
  interceptLeadSeconds = 1.25,
  cutOffDistance = 46
} = {}) {
  if (!system?.updateUnit || !system?.moveTacticalUnit || !system?.dismountUnit) {
    throw new TypeError("Motorized police containment policy requires MotorizedPoliceSystem.");
  }
  if (system.__nbdContainmentPolicy) return system.__nbdContainmentPolicy;

  const originalUpdateUnit = system.updateUnit;
  const originalMoveTacticalUnit = system.moveTacticalUnit;
  const originalDismountUnit = system.dismountUnit;
  let preventedDismounts = 0;
  let cutOffMoves = 0;

  function containmentUpdateUnit(unit, dt, level, focus, targetDistrictId) {
    const vehicle = this.vehicleSystem.currentVehicle?.();
    const driving = Boolean(vehicle && this.vehicleSystem.isDriving?.());
    if (driving) {
      const speed = Math.abs(finite(vehicle.speed));
      unit.containmentStoppedSeconds = speed <= stopSpeed
        ? finite(unit.containmentStoppedSeconds) + Math.max(0, finite(dt))
        : 0;
      unit.containmentState = unit.containmentStoppedSeconds >= stopHoldSeconds
        ? "contained"
        : "vehicle-moving";
    } else {
      unit.containmentStoppedSeconds = stopHoldSeconds;
      unit.containmentState = "on-foot";
    }
    return originalUpdateUnit.call(this, unit, dt, level, focus, targetDistrictId);
  }

  function containmentMoveTacticalUnit(unit, target, dt, speed, options = {}) {
    const vehicle = this.vehicleSystem.currentVehicle?.();
    const driving = Boolean(vehicle && this.vehicleSystem.isDriving?.());
    const pursuitCutoff = driving
      && unit?.role === MOTORIZED_POLICE_ROLES.PURSUIT
      && unit.index > 0
      && unit.tactic === MOTORIZED_POLICE_TACTICS.REAR_QUARTER
      && Math.abs(finite(vehicle.speed)) > stopSpeed;
    if (!pursuitCutoff) return originalMoveTacticalUnit.call(this, unit, target, dt, speed, options);

    const ahead = predictInterceptPoint(vehicle, {
      leadSeconds: interceptLeadSeconds,
      maxLead: 145
    });
    const angle = finite(vehicle.travelAngle, vehicle.angle);
    const side = unit.index % 2 === 0 ? -1 : 1;
    const cutOff = {
      x: finite(ahead.x) - Math.sin(angle) * side * cutOffDistance,
      y: finite(ahead.y) + Math.cos(angle) * side * cutOffDistance
    };
    unit.status = "cutting-off-suspect";
    cutOffMoves++;
    return originalMoveTacticalUnit.call(this, unit, cutOff, dt, Math.max(speed, 150), {
      ...options,
      turnRate: Math.max(finite(options.turnRate, 2.2), 2.6)
    });
  }

  function containmentDismountUnit(unitId, reason = "intercept") {
    const unit = this.units.find(candidate => candidate.id === unitId);
    const vehicle = this.vehicleSystem.currentVehicle?.();
    const driving = Boolean(vehicle && this.vehicleSystem.isDriving?.());
    const forced = reason.includes("disabled") || reason.includes("cruiser-disabled");
    if (unit && driving && !forced && finite(unit.containmentStoppedSeconds) < stopHoldSeconds) {
      preventedDismounts++;
      unit.status = "containing-moving-vehicle";
      return unit.officerIds ? [...unit.officerIds] : [];
    }
    return originalDismountUnit.call(this, unitId, reason);
  }

  system.updateUnit = containmentUpdateUnit;
  system.moveTacticalUnit = containmentMoveTacticalUnit;
  system.dismountUnit = containmentDismountUnit;

  const policy = {
    snapshot() {
      return {
        stopSpeed,
        stopHoldSeconds,
        preventedDismounts,
        cutOffMoves,
        units: system.units.map(unit => ({
          id: unit.id,
          containmentState: unit.containmentState || null,
          stoppedSeconds: Math.round(finite(unit.containmentStoppedSeconds) * 100) / 100
        }))
      };
    },
    destroy() {
      if (system.updateUnit === containmentUpdateUnit) system.updateUnit = originalUpdateUnit;
      if (system.moveTacticalUnit === containmentMoveTacticalUnit) system.moveTacticalUnit = originalMoveTacticalUnit;
      if (system.dismountUnit === containmentDismountUnit) system.dismountUnit = originalDismountUnit;
      if (system.__nbdContainmentPolicy === policy) delete system.__nbdContainmentPolicy;
    }
  };
  system.__nbdContainmentPolicy = policy;
  return policy;
}
