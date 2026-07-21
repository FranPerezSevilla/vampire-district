import { LAYERS } from "../data/district.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { vehicleExitOffsets, vehicleSpeedKph } from "./VehicleModel.js";
import { registerVehicleTheft } from "./VehicleConsequences.js";

const ENTER_RADIUS = 30;
const EXIT_SPEED_LIMIT = 12;

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

export function collectVehicleInteractions(system) {
  const current = system.currentVehicle();
  if (current) {
    const mayExit = current.disabled || Math.abs(current.speed) <= EXIT_SPEED_LIMIT;
    return [{
      id: `exit_${current.id}`,
      type: "vehicleExit",
      label: mayExit
        ? `Exit ${current.disabled ? "wreck" : current.name}`
        : `Slow down to exit ${current.name}`,
      detail: mayExit
        ? "ENTER · vehicle → street"
        : `${vehicleSpeedKph(current.speed)} km/h · exit below ${vehicleSpeedKph(EXIT_SPEED_LIMIT)} km/h`,
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
    const distance = Phaser.Math.Distance.Between(
      system.scene.player.x,
      system.scene.player.y,
      vehicle.x,
      vehicle.y
    );
    if (distance > ENTER_RADIUS) continue;
    options.push({
      id: `enter_${vehicle.id}`,
      type: "vehicleEnter",
      label: `Enter ${vehicle.name}`,
      detail: `ENTER · ${vehicleStatusLabel(vehicle)} · ${vehicle.archetype.label}`,
      priority: 96,
      distance,
      x: vehicle.x,
      y: vehicle.y,
      target: vehicle,
      run: () => system.enterVehicle(vehicle.id)
    });
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
  return options;
}

export function canEnterVehicle(system, vehicle) {
  if (!vehicle || vehicle.disabled || system.currentVehicle()) return false;
  if (system.scene.currentLayer !== LAYERS.STREET || vehicle.layer !== LAYERS.STREET) return false;
  if (system.scene.feedingSystem?.isActive?.() || system.scene.evidenceSystem?.draggingBody) return false;
  if (system.scene.combatSystem?.isBusy?.() || system.scene.playerDamageSystem?.isHitStunned?.()) return false;
  return Phaser.Math.Distance.Between(
    system.scene.player.x,
    system.scene.player.y,
    vehicle.x,
    vehicle.y
  ) <= ENTER_RADIUS;
}

export function enterVehicle(system, vehicleId, { force = false } = {}) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle || (!force && !canEnterVehicle(system, vehicle))) {
    system.scene.lastActionText = vehicle?.disabled
      ? `${vehicle.name} is disabled.`
      : "Move closer and finish the current action before entering the vehicle.";
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

  const previousStatus = system.campaign.vehicles.status(vehicle);
  if (previousStatus !== VEHICLE_OWNERSHIP.OWNED && previousStatus !== VEHICLE_OWNERSHIP.STOLEN) {
    registerVehicleTheft(system, vehicle, previousStatus);
  } else {
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

  const exit = vehicleExitOffsets(vehicle, vehicle.archetype)
    .find(point => system.scene.canStandAt(point.x, point.y));
  if (!exit && !force) {
    system.scene.lastActionText = `No safe space to exit ${vehicle.name}. Reposition the vehicle.`;
    RawAudio.play("cancel");
    return false;
  }

  vehicle.speed = 0;
  vehicle.parked = true;
  vehicle.handbrake = false;
  system.handbrakeActive = false;
  system.currentVehicleId = null;
  system.scene.player.setVisible(true).setPosition(exit?.x ?? vehicle.x, exit?.y ?? vehicle.y);
  system.scene.cameras.main.startFollow(system.scene.player, true, 0.12, 0.12);
  system.scene.registry?.set?.("vehicleOccupied", null);
  system.scene.inputSystem?.resetWorldEdges?.();
  system.persistVehicle(vehicle);
  system.hud.setVisible(false);
  system.scene.lastActionText = vehicle.disabled
    ? `You climb out of the disabled ${vehicle.name}.`
    : `${vehicle.name} parked. You return to street movement.`;
  RawAudio.play("confirm");
  system.publish();
  system.scene.events?.emit?.("vehicle:exited", { vehicleId: vehicle.id, disabled: vehicle.disabled });
  return true;
}

export function inspectVehicleTrunk(system, vehicleId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle) return false;
  const trunk = system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity);
  system.scene.lastActionText = trunk.items.length
    ? `${vehicle.name} trunk ${trunk.used}/${trunk.capacity}: ${trunk.items.join(", ")}.`
    : `${vehicle.name} trunk empty · capacity ${trunk.capacity}. It is limited mobile storage, not the refuge stash.`;
  system.publish();
  return true;
}

export function storeVehicleTrunkItem(system, vehicleId, itemId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle) throw new RangeError(`Unknown vehicle ${vehicleId}.`);
  const result = system.campaign.vehicles.storeItem(vehicle.id, itemId, vehicle.archetype.trunkCapacity);
  system.publish();
  return result;
}

export function removeVehicleTrunkItem(system, vehicleId, itemId) {
  const vehicle = system.vehicle(vehicleId);
  if (!vehicle) throw new RangeError(`Unknown vehicle ${vehicleId}.`);
  const result = system.campaign.vehicles.removeItem(vehicle.id, itemId, vehicle.archetype.trunkCapacity);
  system.publish();
  return result;
}
