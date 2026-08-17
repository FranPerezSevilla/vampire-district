import { LAYERS } from "../data/district.js";
import { vehicleArchetype } from "../data/vehicles.js";
import { pointAlongPolyline } from "../streaming/TrafficMaterializationSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { stepPresentationTransmission, vehicleEngineTelemetry } from "../vehicles/VehicleEngineModel.js";
import { paintVehicle } from "../vehicles/VehicleView.js";
import {
  advancePoliceRoute,
  buildPoliceRoute,
  chooseResponseOrigin,
  desiredMotorizedUnits,
  finite,
  motorizedRole,
  MOTORIZED_POLICE_ROLES,
  MOTORIZED_POLICE_TACTICS,
  policeTacticLabel,
  predictInterceptPoint,
  rearQuarterTarget,
  reservedOfficerCount,
  rotateToward,
  shortestDistrictPath
} from "./MotorizedPolicePolicy.js";

const DEFAULTS = Object.freeze({
  maxUnits: 2,
  officersPerUnit: 2,
  materializeRadius: 920,
  dismountDistance: 150,
  roadblockTriggerDistance: 210,
  collisionCooldownSeconds: 0.9,
  abandonedVehicleMemorySeconds: 4,
  localTacticsRadius: 460,
  spawnSafetyRadius: 135,
  ramTelegraphSeconds: 0.72,
  ramCommitSeconds: 0.72,
  ramCooldownSeconds: 4.2,
  pitTelegraphSeconds: 0.48,
  pitCommitSeconds: 0.60,
  pitCooldownSeconds: 3.6,
  preferredOrigins: Object.freeze(["harbor-north", "blackwater", "old-quarter"])
});

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.46;
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));
}

function cloneMemory(memory) {
  return memory ? { ...memory } : null;
}

function polylineLength(points) {
  const list = Array.isArray(points) ? points : [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(finite(list[index + 1]?.x) - finite(list[index]?.x), finite(list[index + 1]?.y) - finite(list[index]?.y));
  }
  return total;
}

export class MotorizedPoliceSystem {
  constructor(scene, options = {}) {
    if (!scene?.macroTrafficPoliceSystem
      || !scene?.trafficMaterializationSystem
      || !scene?.vehicleSystem
      || !scene?.policeSystem
      || !scene?.cityStreamSystem) {
      throw new TypeError("MotorizedPoliceSystem requires macro traffic, local traffic, vehicles, police and city streaming.");
    }

    this.scene = scene;
    this.macro = scene.macroTrafficPoliceSystem;
    this.traffic = scene.trafficMaterializationSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.policeSystem = scene.policeSystem;
    this.city = scene.cityStreamSystem;
    this.maxUnits = Math.max(1, Math.floor(finite(options.maxUnits, DEFAULTS.maxUnits)));
    this.officersPerUnit = Math.max(1, Math.floor(finite(options.officersPerUnit, DEFAULTS.officersPerUnit)));
    this.materializeRadius = Math.max(240, finite(options.materializeRadius, DEFAULTS.materializeRadius));
    this.dismountDistance = Math.max(48, finite(options.dismountDistance, DEFAULTS.dismountDistance));
    this.roadblockTriggerDistance = Math.max(this.dismountDistance, finite(
      options.roadblockTriggerDistance,
      DEFAULTS.roadblockTriggerDistance
    ));
    this.collisionCooldownSeconds = Math.max(0.2, finite(
      options.collisionCooldownSeconds,
      DEFAULTS.collisionCooldownSeconds
    ));
    this.abandonedVehicleMemorySeconds = Math.max(0, finite(
    options.abandonedVehicleMemorySeconds,
    DEFAULTS.abandonedVehicleMemorySeconds
  ));
  this.localTacticsRadius = Math.max(180, finite(options.localTacticsRadius, DEFAULTS.localTacticsRadius));
  this.spawnSafetyRadius = Math.max(80, finite(options.spawnSafetyRadius, DEFAULTS.spawnSafetyRadius));
  this.ramTelegraphSeconds = Math.max(0.35, finite(options.ramTelegraphSeconds, DEFAULTS.ramTelegraphSeconds));
  this.ramCommitSeconds = Math.max(0.35, finite(options.ramCommitSeconds, DEFAULTS.ramCommitSeconds));
  this.ramCooldownSeconds = Math.max(1, finite(options.ramCooldownSeconds, DEFAULTS.ramCooldownSeconds));
  this.pitTelegraphSeconds = Math.max(0.25, finite(options.pitTelegraphSeconds, DEFAULTS.pitTelegraphSeconds));
  this.pitCommitSeconds = Math.max(0.30, finite(options.pitCommitSeconds, DEFAULTS.pitCommitSeconds));
  this.pitCooldownSeconds = Math.max(1, finite(options.pitCooldownSeconds, DEFAULTS.pitCooldownSeconds));
  this.preferredOrigins = [...(options.preferredOrigins || DEFAULTS.preferredOrigins)];

    this.units = [];
    this.slots = [];
    this.ready = false;
    this.destroyed = false;
    this.suspectMemory = null;
    this.totalDeployments = 0;
    this.totalDismounts = 0;
    this.totalDisabled = 0;
    this.lastPublishedKey = "";
    this.initializationError = null;
    this.originalVehicleCanOccupy = null;
    this.motorizedAwareCanOccupy = null;

    this.installVehicleCollisionHook();
    this.installBrowserApi();
    const macroReady = this.macro.initialization || Promise.resolve(this.macro);
    const trafficReady = this.traffic.initialization || Promise.resolve(this.traffic);
    this.initialization = Promise.all([macroReady, trafficReady])
      .then(() => {
        this.ensureSlots(this.maxUnits);
        this.ready = true;
        this.reconcile(true);
        this.publish(true);
        return this;
      })
      .catch(error => {
        this.initializationError = error;
        this.publish(true);
        throw error;
      });

    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  graph() {
    return this.macro.graph;
  }

  lanes() {
    return this.traffic.lanes;
  }

  wantedLevel() {
    return Math.max(0, Math.min(3, Math.floor(finite(
      this.scene.policeSystem?.wantedLevel?.() ?? this.scene.heatSystem?.level?.() ?? this.scene.exposureSystem?.level?.()
    ))));
  }

  nowSeconds() {
    return Math.max(0, finite(this.scene.time?.now) / 1000);
  }

  ensureSlots(count) {
    while (this.slots.length < count) this.slots.push(this.createSlot(this.slots.length));
    return this.slots;
  }

  createSlot(index) {
    const archetype = vehicleArchetype("police");
    if (!archetype) throw new Error("Police cruiser archetype is unavailable.");
    const definition = {
      id: `motorized-police-slot-${index}`,
      name: "Police response cruiser",
      archetypeId: "police",
      angle: 0
    };
    const container = this.scene.add.container(0, 0)
      .setDepth(45.85)
      .setActive(false)
      .setVisible(false);
    const visual = paintVehicle(this.scene, container, definition, archetype);
    const sirenRed = this.scene.add.rectangle(-3, -1, 4, 3, 0xff3b50, 1);
  const sirenBlue = this.scene.add.rectangle(3, 1, 4, 3, 0x4f8dff, 1);
  const tacticLabel = this.scene.add.text(0, -18, "", {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "10px",
    fontStyle: "bold",
    color: "#fff4b8",
    backgroundColor: "rgba(94, 12, 20, .90)",
    padding: { x: 3, y: 1 }
  }).setOrigin(0.5, 1).setVisible(false);
  tacticLabel.setStroke?.("#100207", 2);
  container.add([sirenRed, sirenBlue, tacticLabel]);
    return {
      slotIndex: index,
      unitId: null,
      archetype,
      radius: vehicleRadius(archetype),
      container,
      visual,
    sirenRed,
    sirenBlue,
    tacticLabel
  };
  }

  targetFocus() {
    const current = this.vehicleSystem.currentVehicle?.();
    const now = this.nowSeconds();
    if (current) {
      this.suspectMemory = {
        vehicleId: current.id,
        x: current.x,
        y: current.y,
        angle: current.angle,
        rememberedAt: now,
        expiresAt: now + this.abandonedVehicleMemorySeconds
      };
      return {
      x: current.x,
      y: current.y,
      angle: current.angle,
      travelAngle: current.travelAngle,
      speed: current.speed,
      velocityX: current.velocityX,
      velocityY: current.velocityY,
      kind: "suspect-vehicle",
      vehicleId: current.id
    };
    }
    if (this.suspectMemory && now <= this.suspectMemory.expiresAt) {
      return {
        x: this.suspectMemory.x,
        y: this.suspectMemory.y,
        kind: "abandoned-vehicle",
        vehicleId: this.suspectMemory.vehicleId
      };
    }
    if (this.suspectMemory && now > this.suspectMemory.expiresAt) this.suspectMemory = null;
    const focus = this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 };
  return {
    x: finite(focus.x),
    y: finite(focus.y),
    velocityX: finite(focus.velocityX, finite(focus.vx, finite(focus.body?.velocity?.x))),
    velocityY: finite(focus.velocityY, finite(focus.vy, finite(focus.body?.velocity?.y))),
    kind: "player"
  };
  }

  targetDistrict(focus = this.targetFocus()) {
    return this.macro.districtAt?.(focus.x, focus.y)
      || this.macro.nearestDistrict?.(focus.x, focus.y)
      || null;
  }

  currentDistrict(unit) {
    const leg = unit?.legs?.[unit.legIndex];
    if (!leg) return unit?.targetDistrictId || unit?.originDistrictId || null;
    return unit.progress < 0.5 ? leg.fromId : leg.toId;
  }

  routeUnit(unit, targetDistrictId, { force = false } = {}) {
    const graph = this.graph();
    const lanes = this.lanes();
    if (!graph || !lanes || !targetDistrictId) return false;
    if (!force && unit.targetDistrictId === targetDistrictId && unit.legs?.length) return false;

    const fromId = unit.legs?.length
      ? this.currentDistrict(unit)
      : unit.originDistrictId;
    let path = shortestDistrictPath(graph, fromId, targetDistrictId);
    if (path.length < 2) {
      const neighbours = graph.nodes?.[targetDistrictId]?.neighbours || [];
      const entry = neighbours[(unit.index || 0) % Math.max(1, neighbours.length)];
      path = entry ? [entry, targetDistrictId] : [targetDistrictId];
    }
    const legs = buildPoliceRoute(graph, lanes, path);
    if (!legs.length) return false;

    unit.routeDistricts = path;
    unit.legs = legs;
    unit.legIndex = 0;
    unit.progress = 0;
    unit.arrived = false;
    unit.targetDistrictId = targetDistrictId;
    unit.status = "responding";
    unit.blockedSeconds = 0;
    return true;
  }

  createUnit(index, targetDistrictId, level) {
    const graph = this.graph();
    const originDistrictId = chooseResponseOrigin(graph, targetDistrictId, index, this.preferredOrigins);
    const archetype = vehicleArchetype("police");
    const unit = {
      id: `motorized-police-${index + 1}`,
      index,
      role: motorizedRole(index, level),
      status: "responding",
      originDistrictId,
      targetDistrictId: null,
      routeDistricts: [],
      legs: [],
      legIndex: 0,
      progress: 0,
      arrived: false,
      x: finite(graph?.nodes?.[originDistrictId]?.center?.x),
      y: finite(graph?.nodes?.[originDistrictId]?.center?.y),
      angle: 0,
      health: finite(archetype?.maxHealth, 104),
      maxHealth: finite(archetype?.maxHealth, 104),
      disabled: false,
      officersDismounted: false,
      officerIds: [],
      blockedSeconds: 0,
      impactCooldown: 0,
    tactic: MOTORIZED_POLICE_TACTICS.ROUTE,
    tacticTimer: 0,
    tacticCooldown: 0,
    tacticTarget: null,
    tacticSide: index % 2 === 0 ? -1 : 1,
    commitAngle: null,
    localSpeed: 0,
    visible: false,
      engineSpeed: 0,
      engineGear: 1,
      engineGearShiftTimer: 0,
      engineRpm: 0.18,
      deploymentReason: level >= 3 ? "wanted-three" : "wanted-two"
    };
    this.routeUnit(unit, targetDistrictId, { force: true });
    this.totalDeployments++;
    return unit;
  }

  clearUnits() {
    for (const unit of this.units) this.releaseSlot(unit.index);
    this.units = [];
    this.suspectMemory = null;
  }

  reconcile(force = false) {
    if (!this.ready || this.destroyed) return false;
    const level = this.wantedLevel();
    const desired = desiredMotorizedUnits(level);
    const focus = this.targetFocus();
    const targetDistrictId = this.targetDistrict(focus);
    let changed = false;

    while (this.units.length < desired && this.units.length < this.maxUnits) {
      this.units.push(this.createUnit(this.units.length, targetDistrictId, level));
      changed = true;
    }
    while (this.units.length > desired) {
      const retired = this.units.pop();
      this.releaseSlot(retired.index);
      changed = true;
    }
    if (!desired) {
      if (this.units.length) changed = true;
      this.clearUnits();
      this.publish(force || changed);
      return changed;
    }

    for (const unit of this.units) {
      const role = motorizedRole(unit.index, level);
      if (unit.role !== role) {
        unit.role = role;
        unit.arrived = false;
        changed = true;
      }
      if (targetDistrictId && unit.targetDistrictId !== targetDistrictId && (!unit.visible || unit.arrived)) {
        changed = this.routeUnit(unit, targetDistrictId, { force: true }) || changed;
      }
    }
    this.publish(force || changed);
    return changed;
  }
  unitPoint(unit, state = unit) {
  const leg = unit?.legs?.[state.legIndex];
  if (!leg) return { x: unit.x, y: unit.y, angle: unit.angle };
  const point = pointAlongPolyline(leg.points, state.progress);
  const roadblock = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK && state.arrived;
  if (!roadblock) return { x: point.x, y: point.y, angle: point.angle };
  const gapSide = unit.index % 2 === 0 ? -1 : 1;
  const lateral = 13;
  return {
    x: point.x - Math.sin(point.angle) * gapSide * lateral,
    y: point.y + Math.cos(point.angle) * gapSide * lateral,
    angle: point.angle + Math.PI / 2
  };
}

  safeCandidate(unit, point) {
    const slot = this.slots[unit.index];
    const radius = slot?.radius || 18;
    for (const trafficSlot of this.traffic.pool || []) {
      if (!trafficSlot.tokenId || trafficSlot.container?.active === false) continue;
      if (Math.hypot(trafficSlot.x - point.x, trafficSlot.y - point.y) < radius + trafficSlot.radius + 8) {
        return false;
      }
    }
    for (const vehicle of this.vehicleSystem.vehicles || []) {
      const otherRadius = vehicleRadius(vehicle.archetype);
      const padding = vehicle.id === this.vehicleSystem.currentVehicleId ? 12 : 7;
      if (Math.hypot(vehicle.x - point.x, vehicle.y - point.y) < radius + otherRadius + padding) {
        return false;
      }
    }
    for (const other of this.units) {
      if (other === unit || !other.visible) continue;
      const otherSlot = this.slots[other.index];
      if (Math.hypot(other.x - point.x, other.y - point.y) < radius + (otherSlot?.radius || 18) + 10) {
        return false;
      }
    }
    return true;
  }
  shouldMaterialize(unit, focus) {
  if (this.scene.currentLayer !== LAYERS.STREET) return false;
  if (distance(unit, focus) > this.materializeRadius) return false;
  const slot = this.slots[unit.index];
  if (!slot?.unitId && distance(unit, focus) < this.spawnSafetyRadius) return false;
  return Boolean(this.city.isPointReady?.(unit.x, unit.y) ?? true);
}

  updateSlot(unit, focus) {
    const slot = this.slots[unit.index];
    if (!slot) return false;
    const visible = this.shouldMaterialize(unit, focus);
    slot.unitId = visible ? unit.id : null;
    slot.container
      .setPosition(unit.x, unit.y)
      .setRotation(unit.angle)
      .setActive(visible)
      .setVisible(visible);
    slot.visual.label?.setRotation?.(-unit.angle);
  const pulse = Math.floor(this.nowSeconds() * 5 + unit.index) % 2 === 0;
  const displayedTactic = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK && unit.arrived
    ? MOTORIZED_POLICE_TACTICS.ROADBLOCK
    : unit.tactic;
  const tacticText = policeTacticLabel(displayedTactic);
  slot.tacticLabel
    ?.setText?.(tacticText)
    ?.setRotation?.(-unit.angle)
    ?.setAlpha?.(pulse ? 1 : 0.62)
    ?.setVisible?.(visible && Boolean(tacticText));
    slot.sirenRed?.setAlpha?.(pulse ? 1 : 0.35);
    slot.sirenBlue?.setAlpha?.(pulse ? 0.35 : 1);
    if (unit.disabled) {
      slot.container.setAlpha?.(0.56);
      slot.visual.hood?.setFillStyle?.(0x3f2027, 0.92);
    } else {
      slot.container.setAlpha?.(0.98);
      slot.visual.hood?.setFillStyle?.(slot.archetype.trim, 0.38);
    }
    unit.visible = visible;
    return visible;
  }

  engineReferenceSpeed(unit, level) {
    const leg = unit?.legs?.[unit.legIndex];
    if (!leg) return 80;
    const base = polylineLength(leg.points) / Math.max(0.25, finite(leg.travelSeconds, 6));
    return Math.max(65, base * (2.35 + Math.max(0, finite(level)) * 0.15));
  }

  updateEngineAudio(unit, dt, level, previousPoint = null) {
    const archetype = this.slots[unit.index]?.archetype || vehicleArchetype("police");
    if (!unit || !archetype || unit.disabled) {
      if (unit?.id) RawAudio.stopVehicleEngine(`police:${unit.id}`);
      return false;
    }
    const seconds = Math.max(0, finite(dt));
    const moved = previousPoint && seconds > 0.0001
      ? Math.hypot(unit.x - previousPoint.x, unit.y - previousPoint.y) / seconds
      : 0;
    const movingSpeed = unit.officersDismounted || unit.arrived ? 0 : moved;
    const referenceSpeed = this.engineReferenceSpeed(unit, level);
    const transmission = stepPresentationTransmission({
      gear: unit.engineGear,
      gearShiftTimer: unit.engineGearShiftTimer
    }, movingSpeed, seconds, archetype, { maxSpeed: referenceSpeed });
    unit.engineSpeed = movingSpeed;
    unit.engineGear = transmission.gear;
    unit.engineGearShiftTimer = transmission.gearShiftTimer;
    const listener = this.vehicleSystem.currentVehicle?.() || this.scene.player || { x: unit.x, y: unit.y };
    const engine = vehicleEngineTelemetry({
      speed: unit.engineSpeed,
      archetype,
      gear: unit.engineGear,
      gearShiftTimer: unit.engineGearShiftTimer,
      throttle: unit.engineSpeed > 1 ? 0.78 : 0.10,
      x: unit.x,
      y: unit.y,
      listener,
      maxSpeed: referenceSpeed,
      maxDistance: 720
    });
    unit.engineRpm = engine.rpm;
    return RawAudio.updateVehicleEngine(`police:${unit.id}`, { ...engine, priority: 2 });
  }

  releaseSlot(index) {
    const slot = this.slots[index];
    if (!slot) return false;
    slot.unitId = null;
    slot.container.setActive(false).setVisible(false);
    return true;
  }


  resetTactic(unit, cooldown = 0) {
    if (!unit) return false;
    unit.tactic = MOTORIZED_POLICE_TACTICS.ROUTE;
    unit.tacticTimer = 0;
    unit.tacticCooldown = Math.max(unit.tacticCooldown || 0, Math.max(0, finite(cooldown)));
    unit.tacticTarget = null;
    unit.commitAngle = null;
    unit.localSpeed = 0;
    return true;
  }

  beginTactic(unit, tactic, duration, target = null) {
    unit.tactic = tactic;
    unit.tacticTimer = Math.max(0, finite(duration));
    unit.tacticTarget = target ? { x: finite(target.x), y: finite(target.y) } : null;
    if (tactic === MOTORIZED_POLICE_TACTICS.RAM_COMMIT
      || tactic === MOTORIZED_POLICE_TACTICS.PIT_COMMIT) {
      const aim = unit.tacticTarget || target || unit;
      unit.commitAngle = Math.atan2(finite(aim.y) - unit.y, finite(aim.x) - unit.x);
    }
    return tactic;
  }

  tacticalCandidateSafe(unit, point) {
    const slot = this.slots[unit.index];
    if (!slot) return false;
    const proxy = {
      id: `police-tactic:${unit.id}`,
      x: unit.x,
      y: unit.y,
      angle: unit.angle,
      archetype: slot.archetype
    };
    const staticSafe = typeof this.originalVehicleCanOccupy !== "function"
      || this.originalVehicleCanOccupy.call(
        this.vehicleSystem,
        proxy,
        point.x,
        point.y,
        point.angle
      );
    return staticSafe && this.safeCandidate(unit, point);
  }

  moveTacticalUnit(unit, target, dt, speed, {
    turnRate = 2.2,
    committedAngle = null
  } = {}) {
    const dx = finite(target?.x) - unit.x;
    const dy = finite(target?.y) - unit.y;
    const separation = Math.hypot(dx, dy);
    const desired = Number.isFinite(committedAngle)
      ? committedAngle
      : Math.atan2(dy, dx);
    const angle = rotateToward(unit.angle, desired, Math.max(0, finite(turnRate)) * dt);
    const step = Math.min(Math.max(0, separation), Math.max(0, finite(speed)) * dt);
    const point = {
      x: unit.x + Math.cos(angle) * step,
      y: unit.y + Math.sin(angle) * step,
      angle
    };
    if (!this.tacticalCandidateSafe(unit, point)) {
      unit.blockedSeconds += dt;
      unit.localSpeed = 0;
      return false;
    }
    unit.x = point.x;
    unit.y = point.y;
    unit.angle = point.angle;
    unit.localSpeed = dt > 0.0001 ? step / dt : 0;
    unit.blockedSeconds = Math.max(0, unit.blockedSeconds - dt * 2);
    return true;
  }

  updateLocalTactic(unit, dt, level, focus) {
    if (!unit.visible
      || unit.role !== MOTORIZED_POLICE_ROLES.PURSUIT
      || this.scene.currentLayer !== LAYERS.STREET
      || distance(unit, focus) > this.localTacticsRadius) return false;

    const playerDriving = Boolean(this.vehicleSystem.isDriving?.());
    const separation = distance(unit, focus);
    if (playerDriving) {
      const vehicle = this.vehicleSystem.currentVehicle?.();
      if (!vehicle) return false;
      const pressureTarget = rearQuarterTarget(vehicle, unit.index, {
        rearDistance: 52,
        lateralDistance: 18
      });

      if (level >= 2
        && unit.index === 0
        && unit.tacticCooldown <= 0
        && ![MOTORIZED_POLICE_TACTICS.PIT_TELEGRAPH, MOTORIZED_POLICE_TACTICS.PIT_COMMIT].includes(unit.tactic)
        && separation >= 52
        && separation <= 165) {
        unit.tacticSide = pressureTarget.side;
        this.beginTactic(unit, MOTORIZED_POLICE_TACTICS.PIT_TELEGRAPH, this.pitTelegraphSeconds, pressureTarget);
      }

      if (unit.tactic === MOTORIZED_POLICE_TACTICS.PIT_TELEGRAPH) {
        unit.status = "pit-telegraph";
        this.moveTacticalUnit(unit, pressureTarget, dt, 108, { turnRate: 1.55 });
        if (unit.tacticTimer <= 0) {
          this.beginTactic(unit, MOTORIZED_POLICE_TACTICS.PIT_COMMIT, this.pitCommitSeconds, {
            x: vehicle.x,
            y: vehicle.y
          });
        }
        return true;
      }

      if (unit.tactic === MOTORIZED_POLICE_TACTICS.PIT_COMMIT) {
        unit.status = "pit-commit";
        const contactTarget = {
          x: vehicle.x - Math.sin(vehicle.angle || 0) * unit.tacticSide * 5,
          y: vehicle.y + Math.cos(vehicle.angle || 0) * unit.tacticSide * 5
        };
        this.moveTacticalUnit(unit, contactTarget, dt, 190, {
          turnRate: 0.82,
          committedAngle: unit.commitAngle
        });
        if (unit.tacticTimer <= 0) this.resetTactic(unit, this.pitCooldownSeconds);
        return true;
      }

      unit.tactic = MOTORIZED_POLICE_TACTICS.REAR_QUARTER;
      unit.status = unit.index % 2 === 0 ? "pressure-left-rear" : "pressure-right-rear";
      this.moveTacticalUnit(unit, pressureTarget, dt, 138, { turnRate: 2.35 });
      return true;
    }

    const intercept = predictInterceptPoint(focus, { leadSeconds: 0.92, maxLead: 115 });
    if (level >= 2
      && unit.index === 0
      && unit.tacticCooldown <= 0
      && ![MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH, MOTORIZED_POLICE_TACTICS.RAM_COMMIT].includes(unit.tactic)
      && separation >= 115
      && separation <= 315) {
      this.beginTactic(unit, MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH, this.ramTelegraphSeconds, intercept);
    }

    if (unit.tactic === MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH) {
      unit.status = "ram-telegraph";
      this.moveTacticalUnit(unit, unit.tacticTarget || intercept, dt, 62, { turnRate: 1.35 });
      if (unit.tacticTimer <= 0) {
        const target = unit.tacticTarget || intercept;
        const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
        this.beginTactic(unit, MOTORIZED_POLICE_TACTICS.RAM_COMMIT, this.ramCommitSeconds, {
          x: unit.x + Math.cos(angle) * 210,
          y: unit.y + Math.sin(angle) * 210
        });
      }
      return true;
    }

    if (unit.tactic === MOTORIZED_POLICE_TACTICS.RAM_COMMIT) {
      unit.status = "ram-commit";
      this.moveTacticalUnit(unit, unit.tacticTarget, dt, 205, {
        turnRate: 0.28,
        committedAngle: unit.commitAngle
      });
      if (unit.tacticTimer <= 0) this.resetTactic(unit, this.ramCooldownSeconds);
      return true;
    }

    unit.tactic = MOTORIZED_POLICE_TACTICS.INTERCEPT;
    unit.status = "intercepting-foot-target";
    this.moveTacticalUnit(unit, intercept, dt, 128, { turnRate: 2.45 });
    return true;
  }

  processOnFootRam(unit) {
    if (this.vehicleSystem.isDriving?.()
      || unit.tactic !== MOTORIZED_POLICE_TACTICS.RAM_COMMIT
      || !unit.visible
      || unit.impactCooldown > 0) return false;
    const player = this.scene.player;
    const slot = this.slots[unit.index];
    if (!player || !slot) return false;
    const separation = distance(unit, player);
    if (separation > slot.radius + 15) return false;

    let dx = finite(player.x) - unit.x;
    let dy = finite(player.y) - unit.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    for (const shove of [28, 20, 12]) {
      const x = finite(player.x) + dx * shove;
      const y = finite(player.y) + dy * shove;
      if (this.scene.canStandAt?.(x, y) === false) continue;
      player.setPosition?.(x, y);
      if (!player.setPosition) {
        player.x = x;
        player.y = y;
      }
      break;
    }
    unit.impactCooldown = this.collisionCooldownSeconds;
    unit.localSpeed = 0;
    RawAudio.play("vehicleCollisionLight", { cooldown: 0.24 });
    this.scene.lastActionText = "A police cruiser commits to the ram and clips you before the officers deploy.";
    this.scene.events?.emit?.("police:player-rammed", {
      unitId: unit.id,
      x: player.x,
      y: player.y,
      suggestedDamage: 12,
      tactic: MOTORIZED_POLICE_TACTICS.RAM_COMMIT
    });
    this.resetTactic(unit, this.ramCooldownSeconds);
    return true;
  }

  updateUnit(unit, dt, level, focus, targetDistrictId) {
  unit.impactCooldown = Math.max(0, finite(unit.impactCooldown) - dt);
  unit.tacticCooldown = Math.max(0, finite(unit.tacticCooldown) - dt);
  unit.tacticTimer = Math.max(0, finite(unit.tacticTimer) - dt);
  const previousPoint = { x: unit.x, y: unit.y };

  if (unit.officersDismounted || unit.disabled) {
    unit.status = unit.disabled ? "disabled" : "officers-deployed";
    this.updateSlot(unit, focus);
    this.updateEngineAudio(unit, dt, level, previousPoint);
    if (unit.disabled && !unit.officersDismounted) this.dismountUnit(unit.id, "disabled-cruiser");
    this.processPlayerImpact(unit);
    return;
  }

  if (targetDistrictId && targetDistrictId !== unit.targetDistrictId && (!unit.visible || unit.arrived)) {
    this.routeUnit(unit, targetDistrictId, { force: true });
  }

  const tacticalMovement = this.updateLocalTactic(unit, dt, level, focus);
  if (!tacticalMovement) {
    if (unit.tactic !== MOTORIZED_POLICE_TACTICS.ROUTE
      && unit.tactic !== MOTORIZED_POLICE_TACTICS.ROADBLOCK) {
      this.resetTactic(unit, unit.tacticCooldown);
    }
    const finalStopPhase = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK ? 0.72 : 1;
    const candidate = advancePoliceRoute(unit, dt, {
      speedMultiplier: 2.35 + level * 0.15,
      finalStopPhase
    });
    const point = this.unitPoint(unit, candidate);
    if (this.safeCandidate(unit, point)) {
      unit.legIndex = candidate.legIndex;
      unit.progress = candidate.progress;
      unit.arrived = candidate.arrived;
      unit.blockedSeconds = Math.max(0, unit.blockedSeconds - dt * 2);
      unit.x = point.x;
      unit.y = point.y;
      unit.angle = point.angle;
    } else {
      unit.blockedSeconds += dt;
    }

    if (unit.arrived) {
      unit.tactic = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK
        ? MOTORIZED_POLICE_TACTICS.ROADBLOCK
        : MOTORIZED_POLICE_TACTICS.INTERCEPT;
      unit.status = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK ? "roadblock" : "intercept";
      const arrivedPoint = this.unitPoint(unit, unit);
      unit.x = arrivedPoint.x;
      unit.y = arrivedPoint.y;
      unit.angle = arrivedPoint.angle;
    } else if (unit.blockedSeconds > 0.2) {
      unit.status = "traffic-blocked";
    } else {
      unit.status = "responding";
    }
  }

  this.updateSlot(unit, focus);
  this.updateEngineAudio(unit, dt, level, previousPoint);
  const rammed = this.processOnFootRam(unit);
  this.processPlayerImpact(unit);

  if (!unit.visible || this.scene.currentLayer !== LAYERS.STREET) return;
  if (rammed) {
    this.dismountUnit(unit.id, "ram-complete");
    return;
  }
  const separation = distance(unit, focus);
  const playerDriving = this.vehicleSystem.isDriving?.();
  const ramActive = [
    MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH,
    MOTORIZED_POLICE_TACTICS.RAM_COMMIT
  ].includes(unit.tactic);
  const shouldDismount = unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK
    ? unit.arrived || separation <= this.roadblockTriggerDistance
    : separation <= this.dismountDistance
      && (!playerDriving || unit.arrived || unit.blockedSeconds >= 0.65)
      && !ramActive;
  if (shouldDismount || unit.blockedSeconds >= 1.15) {
    this.dismountUnit(unit.id, unit.role === MOTORIZED_POLICE_ROLES.ROADBLOCK ? "roadblock" : "intercept");
  }
}

  processPlayerImpact(unit) {
  const vehicle = this.vehicleSystem.currentVehicle?.();
  const slot = this.slots[unit.index];
  if (!vehicle || !unit.visible || !slot || unit.impactCooldown > 0) return false;
  const impactSpeed = Math.abs(finite(vehicle.speed));
  const separation = Math.hypot(vehicle.x - unit.x, vehicle.y - unit.y);
  const threshold = vehicleRadius(vehicle.archetype) + slot.radius + 15;
  if (separation > threshold) return false;

  if (unit.tactic === MOTORIZED_POLICE_TACTICS.PIT_COMMIT) {
    const side = unit.tacticSide || (unit.index % 2 === 0 ? -1 : 1);
    const damage = Math.max(5, Math.min(13, 5 + impactSpeed * 0.035));
    unit.impactCooldown = this.collisionCooldownSeconds;
    vehicle.speed *= 0.62;
    vehicle.angle += side * 0.22;
    vehicle.travelAngle = finite(vehicle.travelAngle, vehicle.angle) + side * 0.30;
    vehicle.velocityX = Math.cos(vehicle.travelAngle) * vehicle.speed;
    vehicle.velocityY = Math.sin(vehicle.travelAngle) * vehicle.speed;
    this.vehicleSystem.damageVehicle?.(vehicle.id, damage, {
      reason: "controlled police PIT",
      persist: false
    });
    this.damageUnit(unit.id, damage * 0.42, { reason: "pit-contact" });
    RawAudio.play("vehicleCollisionLight", { cooldown: 0.24 });
    this.scene.events?.emit?.("police:pit-contact", {
      unitId: unit.id,
      vehicleId: vehicle.id,
      side,
      damage,
      x: vehicle.x,
      y: vehicle.y
    });
    this.resetTactic(unit, this.pitCooldownSeconds);
    return true;
  }

  if (impactSpeed < 110) return false;
  const damage = Math.max(5, Math.min(30, (impactSpeed - 90) * 0.12));
  unit.impactCooldown = this.collisionCooldownSeconds;
  vehicle.speed *= 0.42;
  this.vehicleSystem.damageVehicle?.(vehicle.id, damage * 0.55, {
    reason: "police cruiser collision"
  });
  this.damageUnit(unit.id, damage, { reason: "player-impact" });
  this.scene.policeSystem?.addHeat?.(unit.x, unit.y, 16, "High-speed collision with a police cruiser", { source: "police_cruiser_collision" });
  return true;
}

  damageUnit(unitId, amount, { reason = "damage" } = {}) {
    const unit = this.units.find(candidate => candidate.id === unitId);
    const damage = Math.max(0, finite(amount));
    if (!unit || !damage || unit.disabled) return false;
    unit.health = Math.max(0, unit.health - damage);
    if (unit.health <= 0) {
      unit.disabled = true;
      unit.status = "disabled";
      unit.blockedSeconds = 0;
      this.totalDisabled++;
      this.dismountUnit(unit.id, reason === "player-impact" ? "cruiser-disabled-by-player" : "disabled-cruiser");
    }
    this.updateSlot(unit, this.targetFocus());
    this.publish(true);
    return true;
  }

  dismountUnit(unitId, reason = "intercept") {
    const unit = this.units.find(candidate => candidate.id === unitId);
    if (!unit || unit.officersDismounted) return unit?.officerIds || [];
    const ids = this.policeSystem.spawnMotorizedOfficers?.(unit.id, {
      x: unit.x,
      y: unit.y,
      angle: unit.angle,
      count: this.officersPerUnit,
      reason,
      role: unit.role
    }) || [];
    unit.officersDismounted = true;
    unit.officerIds = [...ids];
    unit.status = unit.disabled ? "disabled" : "officers-deployed";
    this.totalDismounts++;
    this.publish(true);
    return [...unit.officerIds];
  }

  reservedOfficerCount(level = this.wantedLevel()) {
    return reservedOfficerCount(level, this.units, this.officersPerUnit);
  }

  projectileColliders() {
    if (this.scene.currentLayer !== LAYERS.STREET) return [];
    return Object.freeze(this.units
      .filter(unit => {
        const slot = this.slots[unit.index];
        return Boolean(
          unit.visible
          && slot?.unitId === unit.id
          && slot.container?.active !== false
          && slot.container?.visible !== false
        );
      })
      .map(unit => {
        const slot = this.slots[unit.index];
        return Object.freeze({
          id: `police-cruiser:${unit.id}`,
          x: finite(unit.x),
          y: finite(unit.y),
          angle: finite(unit.angle),
          layer: LAYERS.STREET,
          archetype: slot.archetype,
          transient: true,
          projectileProxy: "motorized-police",
          policeUnitId: unit.id
        });
      }));
  }

  blocksVehicle(x, y, radius = 0) {
    const ownRadius = Math.max(0, finite(radius));
    return this.units.some(unit => {
      const slot = this.slots[unit.index];
      return Boolean(unit.visible
        && slot?.container?.active !== false
        && Math.hypot(unit.x - finite(x), unit.y - finite(y)) < ownRadius + slot.radius);
    });
  }

  installVehicleCollisionHook() {
    this.originalVehicleCanOccupy = this.vehicleSystem.canOccupy;
    const system = this;
    this.motorizedAwareCanOccupy = function motorizedAwareCanOccupy(vehicle, x, y, angle) {
      if (!system.originalVehicleCanOccupy.call(this, vehicle, x, y, angle)) return false;
      return !system.blocksVehicle(x, y, vehicleRadius(vehicle?.archetype));
    };
    this.vehicleSystem.canOccupy = this.motorizedAwareCanOccupy;
  }

  step(seconds = 0) {
    let remaining = Math.max(0, finite(seconds));
    let changed = false;
    while (remaining > 0.000001) {
      const dt = Math.min(0.25, remaining);
      changed = this.update(dt) || changed;
      remaining -= dt;
    }
    return this.snapshot();
  }

  update(dt = 0) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const level = this.wantedLevel();
    this.reconcile(false);
    if (level < 2 || !this.units.length) return false;
    const focus = this.targetFocus();
    const targetDistrictId = this.targetDistrict(focus);
    for (const unit of this.units) this.updateUnit(unit, Math.max(0, finite(dt)), level, focus, targetDistrictId);
    this.publish(false);
    return true;
  }

  snapshot() {
    const level = this.wantedLevel();
    return {
      ready: this.ready,
      wantedLevel: level,
      desiredUnits: desiredMotorizedUnits(level),
      activeUnits: this.units.length,
      reservedOfficers: this.reservedOfficerCount(level),
      totalDeployments: this.totalDeployments,
      totalDismounts: this.totalDismounts,
      totalDisabled: this.totalDisabled,
      suspectMemory: cloneMemory(this.suspectMemory),
      units: this.units.map(unit => ({
        id: unit.id,
        index: unit.index,
        role: unit.role,
        status: unit.status,
        originDistrictId: unit.originDistrictId,
        targetDistrictId: unit.targetDistrictId,
        routeDistricts: [...unit.routeDistricts],
        legIndex: unit.legIndex,
        progress: round(unit.progress, 3),
        arrived: unit.arrived,
        x: round(unit.x),
        y: round(unit.y),
        angle: round(unit.angle, 3),
        health: round(unit.health),
        maxHealth: unit.maxHealth,
        disabled: unit.disabled,
        visible: unit.visible,
        blockedSeconds: round(unit.blockedSeconds, 3),
      tactic: unit.tactic,
      tacticTimer: round(unit.tacticTimer, 2),
      tacticCooldown: round(unit.tacticCooldown, 2),
      tacticTarget: unit.tacticTarget ? {
        x: round(unit.tacticTarget.x),
        y: round(unit.tacticTarget.y)
      } : null,
      localSpeed: round(unit.localSpeed, 1),
      officersDismounted: unit.officersDismounted,
        officerIds: [...unit.officerIds],
        engineSpeed: round(unit.engineSpeed, 1),
        gear: unit.engineGear,
        engineRpm: round(unit.engineRpm, 3)
      })),
      initializationError: this.initializationError ? String(this.initializationError.message || this.initializationError) : null
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.wantedLevel,
      snapshot.units.map(unit => [unit.id, unit.status, unit.tactic, unit.targetDistrictId, unit.visible, unit.officersDismounted, unit.disabled]),
      snapshot.initializationError
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      motorizedPoliceText: `Motorized police ${snapshot.activeUnits}/${snapshot.desiredUnits} · reserve ${snapshot.reservedOfficers}`,
      motorizedPoliceState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_MOTORIZED_POLICE_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_MOTORIZED_POLICE = Object.freeze({
      snapshot: () => this.snapshot(),
      reconcile: () => this.reconcile(true),
      step: seconds => this.step(seconds),
      damage: (unitId, amount) => this.damageUnit(unitId, amount, { reason: "browser-api" }),
      dismount: (unitId, reason = "browser-api") => this.dismountUnit(unitId, reason),
      blocks: (x, y, radius = 0) => this.blocksVehicle(x, y, radius)
    });
    window.NBD_MOTORIZED_POLICE_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const unit of this.units) RawAudio.stopVehicleEngine(`police:${unit.id}`);
    if (this.vehicleSystem && this.vehicleSystem.canOccupy === this.motorizedAwareCanOccupy) {
      this.vehicleSystem.canOccupy = this.originalVehicleCanOccupy;
    }
    for (const slot of this.slots) slot.container?.destroy?.();
    this.slots = [];
    this.units = [];
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_MOTORIZED_POLICE;
      window.NBD_MOTORIZED_POLICE_READY = false;
    }
  }
}
