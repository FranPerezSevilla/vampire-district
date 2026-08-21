import { MOTORIZED_POLICE_ROLES, MOTORIZED_POLICE_TACTICS, predictInterceptPoint } from "./MotorizedPolicePolicy.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeAngle(angle) {
  let value = finite(angle);
  const tau = Math.PI * 2;
  while (value > Math.PI) value -= tau;
  while (value < -Math.PI) value += tau;
  return value;
}

export function desiredContainmentFleet(level) {
  const wanted = Math.max(0, Math.floor(finite(level)));
  if (wanted >= 3) return Object.freeze({ pursuers: 3, roadblocks: 1, total: 4 });
  if (wanted >= 2) return Object.freeze({ pursuers: 3, roadblocks: 0, total: 3 });
  return Object.freeze({ pursuers: 0, roadblocks: 0, total: 0 });
}

export function containmentRole(index, level) {
  const fleet = desiredContainmentFleet(level);
  return fleet.roadblocks > 0 && Number(index) >= fleet.pursuers
    ? MOTORIZED_POLICE_ROLES.ROADBLOCK
    : MOTORIZED_POLICE_ROLES.PURSUIT;
}

export function policeEncounterIntent(unit, vehicle, {
  encounterDistance = 285,
  encounterLateral = 150,
  interceptLeadSeconds = 1.45,
  cutOffDistance = 42
} = {}) {
  if (!unit || !vehicle) return null;
  const speed = Math.abs(finite(vehicle.speed));
  if (speed <= 0.001) return null;

  const travelAngle = finite(vehicle.travelAngle, vehicle.angle);
  const forwardX = Math.cos(travelAngle);
  const forwardY = Math.sin(travelAngle);
  const sideX = -forwardY;
  const sideY = forwardX;
  const dx = finite(unit.x) - finite(vehicle.x);
  const dy = finite(unit.y) - finite(vehicle.y);
  const distance = Math.hypot(dx, dy);
  const along = dx * forwardX + dy * forwardY;
  const lateral = dx * sideX + dy * sideY;
  if (distance > encounterDistance || Math.abs(lateral) > encounterLateral || along < -95) return null;

  const ahead = predictInterceptPoint(vehicle, {
    leadSeconds: interceptLeadSeconds,
    maxLead: 205
  });
  const side = Number(unit.index) % 2 === 0 ? -1 : 1;
  const target = {
    x: finite(ahead.x) + sideX * side * cutOffDistance,
    y: finite(ahead.y) + sideY * side * cutOffDistance
  };
  const desiredAngle = Math.atan2(target.y - finite(unit.y), target.x - finite(unit.x));
  const turnDelta = normalizeAngle(desiredAngle - finite(unit.angle));
  const passedOrWrongWay = along < 25 || Math.abs(turnDelta) > Math.PI * 0.52;
  return Object.freeze({
    target: Object.freeze(target),
    along,
    lateral,
    distance,
    turnDelta,
    mode: passedOrWrongWay ? "turnaround" : "cutoff"
  });
}

export function installMotorizedPoliceContainmentPolicy(system, {
  stopSpeed = 14,
  stopHoldSeconds = 0.72,
  interceptLeadSeconds = 1.35,
  cutOffDistance = 46,
  encounterDistance = 285,
  encounterLateral = 150
} = {}) {
  if (!system?.updateUnit || !system?.moveTacticalUnit || !system?.dismountUnit || !system?.reconcile) {
    throw new TypeError("Motorized police containment policy requires MotorizedPoliceSystem.");
  }
  if (system.__nbdContainmentPolicy) return system.__nbdContainmentPolicy;

  const originalUpdateUnit = system.updateUnit;
  const originalMoveTacticalUnit = system.moveTacticalUnit;
  const originalDismountUnit = system.dismountUnit;
  const originalReconcile = system.reconcile;
  const originalSnapshot = system.snapshot;
  const originalMaxUnits = system.maxUnits;
  let preventedDismounts = 0;
  let cutOffMoves = 0;
  let turnaroundMoves = 0;
  let fleetExpansions = 0;

  system.maxUnits = Math.max(4, finite(system.maxUnits, 3));
  system.ensureSlots?.(system.maxUnits);

  function containmentReconcile(force = false) {
    if (!this.ready || this.destroyed) return false;
    const level = this.wantedLevel();
    const fleet = desiredContainmentFleet(level);
    const focus = this.targetFocus();
    const targetDistrictId = this.targetDistrict(focus);
    let changed = false;

    this.ensureSlots?.(fleet.total);
    while (this.units.length < fleet.total) {
      const index = this.units.length;
      const unit = this.createUnit(index, targetDistrictId, level);
      unit.role = containmentRole(index, level);
      this.units.push(unit);
      fleetExpansions++;
      changed = true;
    }
    while (this.units.length > fleet.total) {
      const retired = this.units.pop();
      this.releaseSlot(retired.index);
      changed = true;
    }
    if (!fleet.total) {
      this.clearUnits();
      this.publish(force || changed);
      return changed;
    }

    for (const unit of this.units) {
      const role = containmentRole(unit.index, level);
      if (unit.role !== role) {
        unit.role = role;
        unit.arrived = false;
        unit.tactic = MOTORIZED_POLICE_TACTICS.ROUTE;
        changed = true;
      }
      if (targetDistrictId && unit.targetDistrictId !== targetDistrictId && (!unit.visible || unit.arrived)) {
        changed = this.routeUnit(unit, targetDistrictId, { force: true }) || changed;
      }
    }
    this.publish(force || changed);
    return changed;
  }

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
    const movingTarget = driving && Math.abs(finite(vehicle.speed)) > stopSpeed;
    const pursuitUnit = unit?.role === MOTORIZED_POLICE_ROLES.PURSUIT;
    const encounter = movingTarget && pursuitUnit
      ? policeEncounterIntent(unit, vehicle, {
        encounterDistance,
        encounterLateral,
        interceptLeadSeconds,
        cutOffDistance
      })
      : null;

    if (encounter) {
      const turnaround = encounter.mode === "turnaround";
      unit.status = turnaround ? "turning-to-reengage" : "blocking-suspect-path";
      if (turnaround) turnaroundMoves++;
      else cutOffMoves++;
      return originalMoveTacticalUnit.call(this, unit, encounter.target, dt, Math.max(speed, turnaround ? 178 : 165), {
        ...options,
        committedAngle: null,
        turnRate: Math.max(finite(options.turnRate, 2.2), turnaround ? 4.1 : 3.25)
      });
    }

    const plannedCutoff = movingTarget
      && pursuitUnit
      && unit.index > 0
      && unit.tactic === MOTORIZED_POLICE_TACTICS.REAR_QUARTER;
    if (!plannedCutoff) return originalMoveTacticalUnit.call(this, unit, target, dt, speed, options);

    const ahead = predictInterceptPoint(vehicle, {
      leadSeconds: interceptLeadSeconds,
      maxLead: 170
    });
    const angle = finite(vehicle.travelAngle, vehicle.angle);
    const side = unit.index % 2 === 0 ? -1 : 1;
    const cutOff = {
      x: finite(ahead.x) - Math.sin(angle) * side * cutOffDistance,
      y: finite(ahead.y) + Math.cos(angle) * side * cutOffDistance
    };
    unit.status = "cutting-off-suspect";
    cutOffMoves++;
    return originalMoveTacticalUnit.call(this, unit, cutOff, dt, Math.max(speed, 158), {
      ...options,
      turnRate: Math.max(finite(options.turnRate, 2.2), 2.85)
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

  function containmentSnapshot() {
    const snapshot = originalSnapshot.call(this);
    const fleet = desiredContainmentFleet(snapshot.wantedLevel);
    const activePursuers = this.units.filter(unit => unit.role === MOTORIZED_POLICE_ROLES.PURSUIT).length;
    const activeRoadblocks = this.units.filter(unit => unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK).length;
    const reservedOfficers = this.units.reduce((total, unit) => (
      unit.officersDismounted ? total : total + Math.max(1, Math.floor(finite(this.officersPerUnit, 2)))
    ), 0);
    return {
      ...snapshot,
      desiredUnits: fleet.total,
      desiredPursuers: fleet.pursuers,
      desiredRoadblocks: fleet.roadblocks,
      activePursuers,
      activeRoadblocks,
      reservedOfficers
    };
  }

  system.reconcile = containmentReconcile;
  system.updateUnit = containmentUpdateUnit;
  system.moveTacticalUnit = containmentMoveTacticalUnit;
  system.dismountUnit = containmentDismountUnit;
  system.snapshot = containmentSnapshot;

  const policy = {
    snapshot() {
      const level = system.wantedLevel?.() || 0;
      return {
        stopSpeed,
        stopHoldSeconds,
        desiredFleet: desiredContainmentFleet(level),
        preventedDismounts,
        cutOffMoves,
        turnaroundMoves,
        fleetExpansions,
        units: system.units.map(unit => ({
          id: unit.id,
          role: unit.role,
          containmentState: unit.containmentState || null,
          stoppedSeconds: Math.round(finite(unit.containmentStoppedSeconds) * 100) / 100,
          status: unit.status || null
        }))
      };
    },
    destroy() {
      if (system.reconcile === containmentReconcile) system.reconcile = originalReconcile;
      if (system.updateUnit === containmentUpdateUnit) system.updateUnit = originalUpdateUnit;
      if (system.moveTacticalUnit === containmentMoveTacticalUnit) system.moveTacticalUnit = originalMoveTacticalUnit;
      if (system.dismountUnit === containmentDismountUnit) system.dismountUnit = originalDismountUnit;
      if (system.snapshot === containmentSnapshot) system.snapshot = originalSnapshot;
      system.maxUnits = originalMaxUnits;
      if (system.__nbdContainmentPolicy === policy) delete system.__nbdContainmentPolicy;
    }
  };
  system.__nbdContainmentPolicy = policy;
  return policy;
}
