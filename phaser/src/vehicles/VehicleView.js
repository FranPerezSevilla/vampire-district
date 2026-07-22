import { WORLD } from "../data/balance.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { vehicleHealthPercent, vehicleSpeedKph } from "./VehicleModel.js";

function driftDegrees(vehicle) {
  return Math.round(Math.abs(Number(vehicle?.driftAngle) || 0) * 180 / Math.PI);
}

export function createVehicleHud(scene) {
  const hud = scene.add.text(WORLD.width / 2, WORLD.height - 18, "", {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13px",
    fontStyle: "bold",
    color: "#d7ffec",
    backgroundColor: "rgba(5, 6, 11, .86)",
    padding: { x: 9, y: 5 }
  }).setOrigin(0.5, 1).setDepth(94).setScrollFactor(0).setVisible(false);
  hud.setResolution?.(3);
  hud.setStroke?.("#05060b", 2);
  return hud;
}

export function paintVehicle(scene, container, definition, archetype) {
  const width = archetype.width;
  const height = archetype.height;
  const wheelColor = 0x08090e;
  const body = scene.add.rectangle(0, 0, width, height, archetype.color, 1)
    .setStrokeStyle(1, archetype.trim, 0.95);
  const cabin = scene.add.rectangle(-width * 0.04, 0, width * 0.42, height * 0.70, 0x111522, 0.96)
    .setStrokeStyle(1, archetype.trim, 0.55);
  const hood = scene.add.rectangle(width * 0.33, 0, width * 0.18, height * 0.62, archetype.trim, 0.38);
  const wheels = [
    scene.add.rectangle(-width * 0.28, -height * 0.60, width * 0.20, 3, wheelColor, 1),
    scene.add.rectangle(width * 0.28, -height * 0.60, width * 0.20, 3, wheelColor, 1),
    scene.add.rectangle(-width * 0.28, height * 0.60, width * 0.20, 3, wheelColor, 1),
    scene.add.rectangle(width * 0.28, height * 0.60, width * 0.20, 3, wheelColor, 1)
  ];
  const nose = scene.add.triangle(
    width / 2 + 2,
    0,
    -3,
    -3,
    3,
    0,
    -3,
    3,
    archetype.trim,
    0.92
  );
  const label = scene.add.text(0, -height - 5, archetype.id === "police" ? "POLICE" : archetype.label.toUpperCase(), {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "12px",
    fontStyle: "bold",
    color: `#${archetype.trim.toString(16).padStart(6, "0")}`,
    backgroundColor: "rgba(5, 6, 11, .68)",
    padding: { x: 3, y: 1 }
  }).setOrigin(0.5, 1).setRotation(-(Number(definition.angle) || 0));
  label.setResolution?.(3);
  label.setStroke?.("#05060b", 2);
  container.add([...wheels, body, cabin, hood, nose, label]);
  return { body, cabin, hood, wheels, nose, label };
}

function plainVehicle(vehicle) {
  const archetype = vehicle.archetype;
  return {
    id: vehicle.id,
    name: vehicle.name,
    archetypeId: vehicle.archetypeId,
    status: vehicle.status,
    ownership: vehicle.ownership,
    ownerId: vehicle.ownerId,
    factionId: vehicle.factionId,
    x: vehicle.x,
    y: vehicle.y,
    angle: vehicle.angle,
    travelAngle: vehicle.travelAngle ?? vehicle.angle,
    driftDegrees: driftDegrees(vehicle),
    velocityX: Number(vehicle.velocityX) || 0,
    velocityY: Number(vehicle.velocityY) || 0,
    speed: vehicle.speed,
    speedKph: vehicleSpeedKph(vehicle.speed),
    health: vehicle.health,
    healthPercent: vehicleHealthPercent(vehicle.health, archetype.maxHealth),
    maxHealth: archetype.maxHealth,
    disabled: vehicle.disabled,
    parked: vehicle.parked,
    handbrake: Boolean(vehicle.handbrake),
    streamState: vehicle.streamState || "active",
    trunkCapacity: archetype.trunkCapacity
  };
}

export function updateVehicleHud(system) {
  const vehicle = system.currentVehicle();
  if (!vehicle) {
    system.hud.setVisible(false);
    return;
  }
  const trunk = system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity);
  const drift = driftDegrees(vehicle);
  const driftText = drift >= 7 && Math.abs(vehicle.speed) > 24 ? ` · DRIFT ${drift}°` : "";
  const state = vehicle.disabled
    ? "WRECKED · ENTER exit"
    : `${system.handbrakeActive ? "HANDBRAKE · " : ""}SPACE handbrake · ENTER exit`;
  system.hud.setText(
    `${vehicle.name.toUpperCase()} · ${vehicleSpeedKph(vehicle.speed)} km/h${driftText} · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}% · trunk ${trunk.used}/${trunk.capacity} · ${state}`
  ).setVisible(true);
}

export function refreshVehicleVisibility(system) {
  for (const vehicle of system.vehicles) {
    const streamed = system.scene.entityStreamSystem?.shouldRenderVehicle?.(vehicle) ?? true;
    vehicle.container.setVisible(streamed && system.scene.currentLayer === vehicle.layer);
  }
}

export function vehicleSystemSnapshot(system) {
  return {
    occupiedVehicleId: system.currentVehicleId,
    driving: system.isDriving(),
    handbrakeActive: Boolean(system.handbrakeActive),
    vehicles: system.vehicles.map(vehicle => ({
      ...plainVehicle(vehicle),
      trunk: system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity)
    }))
  };
}

export function vehicleSystemSummary(system) {
  const vehicle = system.currentVehicle();
  if (!vehicle) {
    const stolen = system.vehicles.filter(candidate => candidate.status === VEHICLE_OWNERSHIP.STOLEN).length;
    const active = system.vehicles.filter(candidate => candidate.streamState !== "dormant").length;
    return `On foot · vehicles ${active}/${system.vehicles.length} active · stolen ${stolen}`;
  }
  const drift = driftDegrees(vehicle);
  return `${vehicle.name} · ${vehicleSpeedKph(vehicle.speed)} km/h${drift >= 7 ? ` · drift ${drift}°` : ""} · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%`;
}

export function publishVehicleState(system) {
  const snapshot = vehicleSystemSnapshot(system);
  const summary = vehicleSystemSummary(system);
  system.scene.statePublisher?.setMany?.({ vehicleText: summary, vehicleState: snapshot });
  if (!system.scene.statePublisher) {
    system.scene.registry?.set?.("vehicleText", summary);
    system.scene.registry?.set?.("vehicleState", snapshot);
  }
  return snapshot;
}

export function installVehicleBrowserApi(system) {
  if (typeof window === "undefined") return;
  window.NBD_VEHICLES = Object.freeze({
    snapshot: () => system.snapshot(),
    enter: vehicleId => system.enterVehicle(vehicleId),
    exit: () => system.exitVehicle(),
    damage: (vehicleId, amount) => system.damageVehicle(vehicleId, amount, { reason: "browser-api" }),
    trunk: vehicleId => {
      const vehicle = system.vehicle(vehicleId);
      return vehicle
        ? system.campaign.vehicles.trunkSnapshot(vehicle.id, vehicle.archetype.trunkCapacity)
        : null;
    },
    store: (vehicleId, itemId) => system.storeInTrunk(vehicleId, itemId),
    remove: (vehicleId, itemId) => system.removeFromTrunk(vehicleId, itemId)
  });
  window.NBD_VEHICLES_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:vehicles-ready", { detail: system.snapshot() }));
}