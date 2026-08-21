import { MOTORIZED_POLICE_ROLES, MOTORIZED_POLICE_TACTICS, predictInterceptPoint, rearQuarterTarget } from "./MotorizedPolicePolicy.js";

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

export const POLICE_PURSUIT_STATES = Object.freeze({
  ACQUIRE: "acquire",
  INTERCEPT: "intercept",
  PRESSURE: "pressure",
  BLOCK: "block",
  REENGAGE: "reengage",
  CONTAINED: "contained",
  DEPLOYED: "deployed",
  ROADBLOCK: "roadblock"
});

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

function pursuitGeometry(unit, vehicle) {
  const travelAngle = finite(vehicle?.travelAngle, vehicle?.angle);
  const forwardX = Math.cos(travelAngle);
  const forwardY = Math.sin(travelAngle);
  const sideX = -forwardY;
  const sideY = forwardX;
  const dx = finite(unit?.x) - finite(vehicle?.x);
  const dy = finite(unit?.y) - finite(vehicle?.y);
  const distance = Math.hypot(dx, dy);
  const along = dx * forwardX + dy * forwardY;
  const lateral = dx * sideX + dy * sideY;
  const unitFacingDelta = normalizeAngle(Math.atan2(finite(vehicle?.y) - finite(unit?.y), finite(vehicle?.x) - finite(unit?.x)) - finite(unit?.angle));
  return { travelAngle, forwardX, forwardY, sideX, sideY, distance, along, lateral, unitFacingDelta };
}

export function nextPolicePursuitState(unit, vehicle, {
  stopSpeed = 14,
  stopHoldSeconds = 0.72,
  acquireDistance = 520,
  blockAheadMin = 20,
  blockAheadMax = 220,
  crossTrackLimit = 150
} = {}) {
  if (!unit) return POLICE_PURSUIT_STATES.ACQUIRE;
  if (unit.officersDismounted) return POLICE_PURSUIT_STATES.DEPLOYED;
  if (unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK) return POLICE_PURSUIT_STATES.ROADBLOCK;
  if (!vehicle) return POLICE_PURSUIT_STATES.ACQUIRE;

  const speed = Math.abs(finite(vehicle.speed));
  if (speed <= stopSpeed && finite(unit.containmentStoppedSeconds) >= stopHoldSeconds) {
    return POLICE_PURSUIT_STATES.CONTAINED;
  }

  const geometry = pursuitGeometry(unit, vehicle);
  if (geometry.distance > acquireDistance) return POLICE_PURSUIT_STATES.ACQUIRE;

  const crossedOrFacingAway = geometry.along < -25 || Math.abs(geometry.unitFacingDelta) > Math.PI * 0.62;
  if (crossedOrFacingAway) return POLICE_PURSUIT_STATES.REENGAGE;

  if (geometry.along >= blockAheadMin
    && geometry.along <= blockAheadMax
    && Math.abs(geometry.lateral) <= crossTrackLimit) {
    return POLICE_PURSUIT_STATES.BLOCK;
  }

  if (Number(unit.index) === 0 && geometry.distance < 175) return POLICE_PURSUIT_STATES.PRESSURE;
  return POLICE_PURSUIT_STATES.INTERCEPT;
}

export function pursuitTargetForState(state, unit, vehicle) {
  const geometry = pursuitGeometry(unit, vehicle);
  const side = Number(unit?.index) % 2 === 0 ? -1 : 1;
  if (state === POLICE_PURSUIT_STATES.PRESSURE) {
    return rearQuarterTarget(vehicle, unit.index, { rearDistance: 44, lateralDistance: 16 });
  }
  if (state === POLICE_PURSUIT_STATES.BLOCK) {
    const lead = predictInterceptPoint(vehicle, { leadSeconds: 0.9, maxLead: 125 });
    return {
      x: finite(lead.x) + geometry.sideX * side * 28,
      y: finite(lead.y) + geometry.sideY * side * 28
    };
  }
  if (state === POLICE_PURSUIT_STATES.REENGAGE) {
    const lead = predictInterceptPoint(vehicle, { leadSeconds: 1.6, maxLead: 220 });
    return {
      x: finite(lead.x) + geometry.sideX * side * 34,
      y: finite(lead.y) + geometry.sideY * side * 34
    };
  }
  const lead = predictInterceptPoint(vehicle, { leadSeconds: 1.35, maxLead: 190 });
  return {
    x: finite(lead.x) + geometry.sideX * side * (Number(unit?.index) === 0 ? 18 : 44),
    y: finite(lead.y) + geometry.sideY * side * (Number(unit?.index) === 0 ? 18 : 44)
  };
}

export function installMotorizedPoliceContainmentPolicy(system, {
  stopSpeed = 14,
  stopHoldSeconds = 0.72
} = {}) {
  if (!system?.updateUnit || !system?.moveTacticalUnit || !system?.dismountUnit || !system?.reconcile) {
    throw new TypeError("Motorized police containment policy requires MotorizedPoliceSystem.");
  }
  if (system.__nbdContainmentPolicy) return system.__nbdContainmentPolicy;

  const originalUpdateUnit = system.updateUnit;
  const originalUpdateLocalTactic = system.updateLocalTactic;
  const originalDismountUnit = system.dismountUnit;
  const originalReconcile = system.reconcile;
  const originalSnapshot = system.snapshot;
  const originalMaxUnits = system.maxUnits;
  let preventedDismounts = 0;
  let transitions = 0;

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
      unit.pursuitState = POLICE_PURSUIT_STATES.ACQUIRE;
      this.units.push(unit);
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
        unit.pursuitState = role === MOTORIZED_POLICE_ROLES.ROADBLOCK
          ? POLICE_PURSUIT_STATES.ROADBLOCK
          : POLICE_PURSUIT_STATES.ACQUIRE;
        changed = true;
      }
      if (targetDistrictId && unit.targetDistrictId !== targetDistrictId && (!unit.visible || unit.arrived)) {
        changed = this.routeUnit(unit, targetDistrictId, { force: true }) || changed;
      }
    }
    this.publish(force || changed);
    return changed;
  }

  function stateMachineUpdateLocalTactic(unit, dt, level, focus) {
    if (!unit.visible || this.scene.currentLayer !== 0 || unit.role !== MOTORIZED_POLICE_ROLES.PURSUIT) return false;
    const vehicle = this.vehicleSystem.currentVehicle?.();
    if (!vehicle || !this.vehicleSystem.isDriving?.()) return originalUpdateLocalTactic.call(this, unit, dt, level, focus);

    const nextState = nextPolicePursuitState(unit, vehicle, { stopSpeed, stopHoldSeconds });
    if (unit.pursuitState !== nextState) {
      unit.pursuitState = nextState;
      unit.pursuitStateSeconds = 0;
      transitions++;
    } else {
      unit.pursuitStateSeconds = finite(unit.pursuitStateSeconds) + Math.max(0, finite(dt));
    }

    if (nextState === POLICE_PURSUIT_STATES.CONTAINED) {
      unit.status = "suspect-contained";
      unit.localSpeed = 0;
      return true;
    }

    if (nextState === POLICE_PURSUIT_STATES.ACQUIRE) {
      unit.status = "acquiring-suspect";
      return false;
    }

    const target = pursuitTargetForState(nextState, unit, vehicle);
    const movement = {
      [POLICE_PURSUIT_STATES.INTERCEPT]: { speed: 170, turnRate: 3.0 },
      [POLICE_PURSUIT_STATES.PRESSURE]: { speed: 182, turnRate: 3.2 },
      [POLICE_PURSUIT_STATES.BLOCK]: { speed: 168, turnRate: 3.45 },
      [POLICE_PURSUIT_STATES.REENGAGE]: { speed: 190, turnRate: 4.4 }
    }[nextState] || { speed: 170, turnRate: 3.0 };

    unit.tactic = nextState === POLICE_PURSUIT_STATES.PRESSURE
      ? MOTORIZED_POLICE_TACTICS.REAR_QUARTER
      : MOTORIZED_POLICE_TACTICS.INTERCEPT;
    unit.status = `pursuit-${nextState}`;
    this.moveTacticalUnit(unit, target, dt, movement.speed, { turnRate: movement.turnRate, committedAngle: null });
    return true;
  }

  function containmentUpdateUnit(unit, dt, level, focus, targetDistrictId) {
    const vehicle = this.vehicleSystem.currentVehicle?.();
    const driving = Boolean(vehicle && this.vehicleSystem.isDriving?.());
    if (driving) {
      const speed = Math.abs(finite(vehicle.speed));
      unit.containmentStoppedSeconds = speed <= stopSpeed
        ? finite(unit.containmentStoppedSeconds) + Math.max(0, finite(dt))
        : 0;
    } else {
      unit.containmentStoppedSeconds = stopHoldSeconds;
    }
    return originalUpdateUnit.call(this, unit, dt, level, focus, targetDistrictId);
  }

  function containmentDismountUnit(unitId, reason = "intercept") {
    const unit = this.units.find(candidate => candidate.id === unitId);
    const vehicle = this.vehicleSystem.currentVehicle?.();
    const driving = Boolean(vehicle && this.vehicleSystem.isDriving?.());
    const forced = reason.includes("disabled") || reason.includes("cruiser-disabled");
    if (unit && driving && !forced && unit.pursuitState !== POLICE_PURSUIT_STATES.CONTAINED) {
      preventedDismounts++;
      unit.status = "holding-containment";
      return unit.officerIds ? [...unit.officerIds] : [];
    }
    if (unit) unit.pursuitState = POLICE_PURSUIT_STATES.DEPLOYED;
    return originalDismountUnit.call(this, unitId, reason);
  }

  function containmentSnapshot() {
    const snapshot = originalSnapshot.call(this);
    const fleet = desiredContainmentFleet(snapshot.wantedLevel);
    return {
      ...snapshot,
      desiredUnits: fleet.total,
      desiredPursuers: fleet.pursuers,
      desiredRoadblocks: fleet.roadblocks,
      activePursuers: this.units.filter(unit => unit.role === MOTORIZED_POLICE_ROLES.PURSUIT).length,
      activeRoadblocks: this.units.filter(unit => unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK).length,
      units: snapshot.units.map(item => {
        const unit = this.units.find(candidate => candidate.id === item.id);
        return { ...item, pursuitState: unit?.pursuitState || null };
      })
    };
  }

  system.reconcile = containmentReconcile;
  system.updateLocalTactic = stateMachineUpdateLocalTactic;
  system.updateUnit = containmentUpdateUnit;
  system.dismountUnit = containmentDismountUnit;
  system.snapshot = containmentSnapshot;

  const policy = {
    snapshot() {
      return {
        stopSpeed,
        stopHoldSeconds,
        transitions,
        preventedDismounts,
        desiredFleet: desiredContainmentFleet(system.wantedLevel?.() || 0),
        units: system.units.map(unit => ({
          id: unit.id,
          role: unit.role,
          pursuitState: unit.pursuitState || null,
          stateSeconds: Math.round(finite(unit.pursuitStateSeconds) * 100) / 100,
          stoppedSeconds: Math.round(finite(unit.containmentStoppedSeconds) * 100) / 100
        }))
      };
    },
    destroy() {
      if (system.reconcile === containmentReconcile) system.reconcile = originalReconcile;
      if (system.updateLocalTactic === stateMachineUpdateLocalTactic) system.updateLocalTactic = originalUpdateLocalTactic;
      if (system.updateUnit === containmentUpdateUnit) system.updateUnit = originalUpdateUnit;
      if (system.dismountUnit === containmentDismountUnit) system.dismountUnit = originalDismountUnit;
      if (system.snapshot === containmentSnapshot) system.snapshot = originalSnapshot;
      system.maxUnits = originalMaxUnits;
      if (system.__nbdContainmentPolicy === policy) delete system.__nbdContainmentPolicy;
    }
  };
  system.__nbdContainmentPolicy = policy;
  return policy;
}
