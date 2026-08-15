import { LAYERS } from "../data/district.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { vehicleExitOffsets, vehicleSpeedKph } from "./VehicleModel.js";
import { registerVehicleTheft } from "./VehicleConsequences.js";

const ENTER_RADIUS = 30;
const EXIT_SPEED_LIMIT = 12;
const EXIT_ESCAPE_PROBE = 18;
const EXIT_CORRIDOR_STEPS = Object.freeze([0, 0.5, 1]);

export function vehicleStatusLabel(vehicle) {
  switch (vehicle.status) {
    case VEHICLE_OWNERSHIP.OWNED: return "Owned";
    case VEHICLE_OWNERSHIP.STOLEN: return "Stolen";
    case VEHICLE_OWNERSHIP.FACTION: return "Faction vehicle";
    case VEHICLE_OWNERSHIP.POLICE: return "Police vehicle";
    default: return "Parked vehicle";
  }
}

export function vehicleTrunkLabel(system, vehicle) {
  const trunk = system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity);
  return `limited mobile storage · ${trunk.used}/${trunk.capacity}`;
}

function exitDirections(vehicle, point) {
  const dx = Number(point?.x) - Number(vehicle?.x);
  const dy = Number(point?.y) - Number(vehicle?.y);
  const length = Math.hypot(dx, dy) || 1;
  const outward = { x: dx / length, y: dy / length };
  const tangent = { x: -outward.y, y: outward.x };
  return [outward, tangent, { x: -tangent.x, y: -tangent.y }, { x: -outward.x, y: -outward.y }];
}

function clearExitCorridor(system, point, direction, distance) {
  return EXIT_CORRIDOR_STEPS.every(progress => system.scene.canStandAt(
    point.x + direction.x * distance * progress,
    point.y + direction.y * distance * progress
  ));
}

export function vehicleExitPointHasClearStep(system, vehicle, point, probe = EXIT_ESCAPE_PROBE) {
  if (!point || !system?.scene?.canStandAt?.(point.x, point.y)) return false;
  const distance = Math.max(8, Number(probe) || EXIT_ESCAPE_PROBE);
  return exitDirections(vehicle, point).some(direction => clearExitCorridor(system, point, direction, distance));
}

export function chooseVehicleExitPoint(system, vehicle) {
  for (const anchor of vehicleExitOffsets(vehicle, vehicle.archetype, 12)) {
    if (!system.scene.canStandAt(anchor.x, anchor.y)) continue;
    for (const direction of exitDirections(vehicle, anchor)) {
      if (!clearExitCorridor(system, anchor, direction, EXIT_ESCAPE_PROBE)) continue;
      return {
        x: anchor.x + direction.x * EXIT_ESCAPE_PROBE,
        y: anchor.y + direction.y * EXIT_ESCAPE_PROBE,
        escapeDirX: direction.x,
        escapeDirY: direction.y
      };
    }
  }
  return null;
}

function restoreStreetControl(scene, exitPoint) {
  const player = scene.player;
  scene.currentLayer = LAYERS.STREET;
  scene.registry?.set?.("vehicleOccupied", null);
  player?.setActive?.(true);
  player?.setVisible?.(true);
  player?.setPosition?.(exitPoint.x, exitPoint.y);
  if (player?.body) {
    player.body.enable = true;
    player.body.setEnable?.(true);
    player.body.setVelocity?.(0, 0);
  }
  scene.currentInputFrame = {
    ...(scene.currentInputFrame || {}),
    worldEnabled: true,
    move: { x: 0, y: 0 },
    hasMovementIntent: false,
    vehicleActionPressed: false
  };
}

export function collectVehicleInteractions(system) {
  const current = system.currentVehicle();
  if (current) {
    const mayExit = current.disabled || Math.abs(current.speed) <= EXIT_SPEED_LIMIT;
    return [{
      id: `exit_${current.id}`,
      type: "vehicleExit",
      label: mayExit ? `Exit ${current.disabled ? "wreck" : current.name}` : `Slow down to exit ${current.name}`,
      detail: mayExit ? "ENTER · vehicle → street" : `${vehicleSpeedKph(current.speed)} km/h · exit below ${vehicleSpeedKph(EXIT_SPEED_LIMIT)} km/h`,
      priority: 240,
      distance: 0,
      x: current.x,
      y: current.y,
      target: current,
      run: () => system.exitVehicle()
    }];
  }

  if (system.scene.currentLayer !== LAYERS.STREET) return [];
  const options = [];
  for (const vehicle of system.vehicles) {
    if (vehicle.disabled) continue;
    const status = vehicle.transient ? vehicle.status : system.campaign.vehicles.status(vehicle);
    if (status === VEHICLE_OWNERSHIP.POLICE || vehicle.ownership === VEHICLE_OWNERSHIP.POLICE) continue;
    const distance = Phaser.Math.Distance.Between(system.scene.player.x, system.scene.player.y, vehicle.x, vehicle.y);
    if (distance > ENTER_RADIUS) continue;
    const theft = status !== VEHICLE_OWNERSHIP.OWNED && status !== VEHICLE_OWNERSHIP.STOLEN;
    options.push({
      id: `enter_${vehicle.id}`,
      type: "vehicleEnter",
      label: `${theft ? "Steal" : "Enter"} ${vehicle.name}`,
      detail: `ENTER · ${vehicleStatusLabel({ ...vehicle, status })} · ${vehicle.archetype.label}`,
      priority: 96,
      distance,
      x: vehicle.x,
      y: vehicle.y,
      target: vehicle,
      run: () => system.enterVehicle(vehicle.id)
    });
    if (!vehicle.transient) {
      options.push({
        id: `trunk_${vehicle.id}`,
        type: "vehicleTrunk",
        label: `Inspect ${vehicle.name} trunk`,
        detail: vehicleTrunkLabel(system, vehicle),
        priority: 58,
        distance,
        x: vehicle.x,
        y: vehicle.y,
        target: vehicle,
        run: () => system.inspectTrunk(vehicle.id)
      });
    }
  }
  return options;
}

export function canEnterVehicle(system, vehicle) {
  if (!vehicle || vehicle.disabled || system.currentVehicle()) return false;
  const status = vehicle.transient ? vehicle.status : system.campaign.vehicles.status(vehicle);
  if (status === VEHICLE_OWNERSHIP.POLICE || vehicle.ownership === VEHICLE_OWNERSHIP.POLICE) return false;
  if (system.scene.currentLayer !== LAYERS.STREET || vehicle.layer !== LAYERS.STREET) return false;
  if (system.scene.feedingSystem?.isActive?.() || system.scene.evidenceSystem?.draggingBody) return false;
  if (system.scene.combatSystem?.isBusy?.() || system.scene.playerDamageSystem?.isHitStunned?.()) return false;
  return Phaser.Math.Distance.Between(system.scene.player.x, system.scene.player.y, vehicle.x, vehicle.y) <= ENTER_RADIUS;
}

export function enterVehicle(system, vehicleId, { force = false } = {}) {
  const vehicle = system.vehicle(vehicleId);
  const status = vehicle ? (vehicle.transient ? vehicle.status : system.campaign.vehicles.status(vehicle)) : null;
  const policeVehicle = status === VEHICLE_OWNERSHIP.POLICE || vehicle?.ownership === VEHICLE_OWNERSHIP.POLICE;
  if (!vehicle || policeVehicle || (!force && !canEnterVehicle(system, vehicle))) {
    system.scene.lastActionText = policeVehicle ? "Police vehicles cannot be stolen." : vehicle?.disabled ? `${vehicle.name} is disabled.` : "Move closer and finish the current action before entering the vehicle.";
    RawAudio.play("cancel");
    return false;
  }

  system.currentVehicleId = vehicle.id;
  vehicle.parked = false;
  system.scene.currentLayer = LAYERS.STREET;
  system.scene.player.setPosition(vehicle.x, vehicle.y).setVisible(false);
  system.scene.cameras.main.startFollow(vehicle.container, true, 0.10, 0.10);
  system.scene.registry?.set?.("vehicleOccupied", vehicle.id);
  system.scene.inputSystem?.resetWorldEdges?.();

  const previousStatus = vehicle.transient ? vehicle.status : system.campaign.vehicles.status(vehicle);
  if (previousStatus !== VEHICLE_OWNERSHIP.OWNED && previousStatus !== VEHICLE_OWNERSHIP.STOLEN) registerVehicleTheft(system, vehicle, previousStatus);
  else {
    vehicle.status = previousStatus;
    system.scene.lastActionText = `You enter ${vehicle.name}. W/S accelerate and brake · A/D steer · Space handbrake · Enter exits.`;
  }

  RawAudio.play("confirm");
  system.updateHud();
  system.publish();
  system.scene.events?.emit?.("vehicle:entered", { vehicleId: vehicle.id, status: vehicle.status });
  return true;
}

export function exitVehicle(system, { force = false } = {}) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  if (!force && !vehicle.disabled && Math.abs(vehicle.speed) > EXIT_SPEED_LIMIT) {
    system.scene.lastActionText = `Slow ${vehicle.name} below ${vehicleSpeedKph(EXIT_SPEED_LIMIT)} km/h before exiting.`;
    RawAudio.play("cancel");
    return false;
  }

  const exit = chooseVehicleExitPoint(system, vehicle);
  if (!exit && !force) {
    system.scene.lastActionText = `No clear walking corridor to exit ${vehicle.name}. Reposition the vehicle.`;
    RawAudio.play("cancel");
    return false;
  }
  const forcedFallback = !exit ? vehicleExitOffsets(vehicle, vehicle.archetype, 14).find(point => system.scene.canStandAt(point.x, point.y)) : null;
  const exitPoint = exit || forcedFallback || { x: vehicle.x, y: vehicle.y };

  vehicle.speed = 0;
  vehicle.velocityX = 0;
  vehicle.velocityY = 0;
  vehicle.gear = 1;
  vehicle.gearShiftTimer = 0;
  vehicle.parked = true;
  vehicle.handbrake = false;
  system.handbrakeActive = false;
  system.currentVehicleId = null;
  RawAudio.stopVehicleEngine(`player:${vehicle.id}`);
  restoreStreetControl(system.scene, exitPoint);
  system.cameraLookAheadX = 0;
  system.cameraLookAheadY = 0;
  system.scene.cameras.main.setFollowOffset(0, 0);
  system.scene.cameras.main.startFollow(system.scene.player, true, 0.12, 0.12);
  system.persistVehicle(vehicle);
  system.hud.setVisible(false);
  system.scene.lastActionText = vehicle.disabled ? `You climb out of the disabled ${vehicle.name}.` : `${vehicle.name} parked. You return to street movement.`;
  RawAudio.play("confirm");
  system.publish();
  system.scene.events?.emit?.("vehicle:exited", {
    vehicleId: vehicle.id,
    disabled: vehicle.disabled,
    x: exitPoint.x,
    y: exitPoint.y,
    clearStep: Boolean(exit),
    clearCorridor: Boolean(exit),
    escapeDirX: Number(exit?.escapeDirX) || 0,
    escapeDirY: Number(exit?.escapeDirY) || 0
  });
  return true;
}

export function inspectVehicleTrunk(system, vehicleId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle || vehicle.transient) return false;
  const trunk = system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity);
  system.scene.lastActionText = trunk.items.length ? `${vehicle.name} trunk ${trunk.used}/${trunk.capacity}: ${trunk.items.join(", ")}.` : `${vehicle.name} trunk empty · capacity ${trunk.capacity}. It is limited mobile storage, not the refuge stash.`;
  system.publish();
  return true;
}

export function storeVehicleTrunkItem(system, vehicleId, itemId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle || vehicle.transient) throw new RangeError(`Unknown persistent vehicle ${vehicleId}.`);
  const result = system.campaign.vehicles.storeItem(vehicle.id, itemId, vehicle.archetype.trunkCapacity);
  system.publish();
  return result;
}

export function removeVehicleTrunkItem(system, vehicleId, itemId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle || vehicle.transient) throw new RangeError(`Unknown persistent vehicle ${vehicleId}.`);
  const result = system.campaign.vehicles.removeItem(vehicle.id, itemId, vehicle.archetype.trunkCapacity);
  system.publish();
  return result;
}
