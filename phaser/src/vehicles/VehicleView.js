import { WORLD } from "../data/balance.js";
import { VEHICLE_CLASSES, VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { vehicleGearCount, vehicleHealthPercent, vehicleSpeedKph } from "./VehicleModel.js";

function driftDegrees(vehicle) {
  return Math.round(Math.abs(Number(vehicle?.driftAngle) || 0) * 180 / Math.PI);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "vehicle")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function vehiclePalette(definition, archetype) {
  const palettes = Array.isArray(archetype?.palettes) && archetype.palettes.length
    ? archetype.palettes
    : [{ color: archetype.color, trim: archetype.trim }];
  return palettes[stableHash(definition?.id || archetype?.id) % palettes.length] || palettes[0];
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
  const palette = vehiclePalette(definition, archetype);
  const color = Number(palette?.color ?? archetype.color);
  const trim = Number(palette?.trim ?? archetype.trim);
  const style = String(archetype.bodyStyle || "sedan");
  const parts = [];
  const detail = (x, y, w, h, fill, alpha = 1) => {
    const part = scene.add.rectangle(x, y, Math.max(1, w), Math.max(1, h), fill, alpha);
    parts.push(part);
    return part;
  };

  const body = detail(0, 0, width, height, color, 1).setStrokeStyle(1, trim, 0.95);
  let cabinX = -width * 0.04;
  let cabinWidth = width * 0.42;
  let cabinHeight = height * 0.70;
  let hoodX = width * 0.33;
  let hoodWidth = width * 0.18;

  if (["compact", "hatchback", "junker"].includes(style)) {
    cabinX = -width * 0.08;
    cabinWidth = width * 0.50;
    hoodWidth = width * 0.16;
  } else if (["muscle", "sports", "coupe", "police-interceptor"].includes(style)) {
    cabinX = -width * 0.11;
    cabinWidth = width * 0.34;
    cabinHeight = height * 0.62;
    hoodX = width * 0.30;
    hoodWidth = width * 0.28;
  } else if (["suv", "police-suv"].includes(style)) {
    cabinWidth = width * 0.58;
    cabinHeight = height * 0.72;
  } else if (["van", "delivery-van"].includes(style)) {
    cabinX = width * 0.22;
    cabinWidth = width * 0.27;
    cabinHeight = height * 0.78;
    hoodX = width * 0.43;
    hoodWidth = width * 0.09;
  } else if (style === "pickup") {
    cabinX = width * 0.16;
    cabinWidth = width * 0.28;
    hoodX = width * 0.39;
    hoodWidth = width * 0.14;
  } else if (style === "limousine") {
    cabinWidth = width * 0.66;
    hoodX = width * 0.39;
    hoodWidth = width * 0.15;
  } else if (style === "hearse") {
    cabinX = width * 0.16;
    cabinWidth = width * 0.26;
    hoodX = width * 0.40;
    hoodWidth = width * 0.14;
  }

  const cabin = detail(cabinX, 0, cabinWidth, cabinHeight, 0x111522, 0.96)
    .setStrokeStyle(1, trim, 0.55);
  const hood = detail(hoodX, 0, hoodWidth, height * 0.62, trim, 0.30);

  if (style === "hatchback") detail(-width * 0.38, 0, width * 0.14, height * 0.64, 0x111522, 0.78);
  if (style === "taxi") detail(-width * 0.03, 0, width * 0.14, height * 0.25, 0xf3c64d, 1).setStrokeStyle(1, 0x2b2417, 0.9);
  if (style === "muscle") {
    detail(0, -height * 0.10, width * 0.84, 1.7, 0x16171b, 0.80);
    detail(0, height * 0.10, width * 0.84, 1.7, 0x16171b, 0.80);
  }
  if (style === "sports") {
    detail(-width * 0.36, 0, width * 0.16, height * 0.55, 0x15171c, 0.72);
    detail(width * 0.27, 0, width * 0.10, height * 0.50, 0x0c0d11, 0.70);
  }
  if (["suv", "police-suv"].includes(style)) {
    detail(-width * 0.08, -height * 0.37, width * 0.50, 1.5, 0x15171b, 0.95);
    detail(-width * 0.08, height * 0.37, width * 0.50, 1.5, 0x15171b, 0.95);
  }
  if (style === "pickup") detail(-width * 0.27, 0, width * 0.38, height * 0.70, 0x282520, 0.94).setStrokeStyle(1, trim, 0.50);
  if (["van", "delivery-van"].includes(style)) detail(-width * 0.19, 0, width * 0.50, height * 0.72, trim, 0.10).setStrokeStyle(1, trim, 0.25);
  if (style === "limousine") {
    detail(-width * 0.08, 0, 1.2, height * 0.60, trim, 0.42);
    detail(-width * 0.24, 0, 1.2, height * 0.60, trim, 0.42);
  }
  if (style === "hearse") {
    detail(-width * 0.24, 0, width * 0.48, height * 0.72, 0x121318, 0.90).setStrokeStyle(1, trim, 0.38);
    detail(-width * 0.24, 0, width * 0.23, 1.4, trim, 0.62);
    detail(-width * 0.24, 0, 1.4, height * 0.30, trim, 0.62);
  }
  if (["coupe", "junker"].includes(style)) {
    detail(-width * 0.24, height * 0.22, width * 0.18, height * 0.20, 0x553a30, 0.68).setRotation(-0.10);
  }

  if (archetype.vehicleClass === VEHICLE_CLASSES.POLICE) {
    if (archetype.policeRole !== "unmarked") {
      detail(-width * 0.12, 0, width * 0.28, height * 0.66, 0xe4e8ed, 0.82);
      detail(-width * 0.04, -height * 0.18, 5.5, 2.2, 0x4f8dff, 1);
      detail(-width * 0.04, height * 0.18, 5.5, 2.2, 0xff3b50, 1);
    } else {
      detail(width * 0.12, -height * 0.17, 2.6, 1.5, 0x4f8dff, 0.92);
      detail(width * 0.12, height * 0.17, 2.6, 1.5, 0xff3b50, 0.92);
    }
  }

  const wheels = [
    scene.add.rectangle(-width * 0.28, -height * 0.60, width * 0.20, 3, 0x08090e, 1),
    scene.add.rectangle(width * 0.28, -height * 0.60, width * 0.20, 3, 0x08090e, 1),
    scene.add.rectangle(-width * 0.28, height * 0.60, width * 0.20, 3, 0x08090e, 1),
    scene.add.rectangle(width * 0.28, height * 0.60, width * 0.20, 3, 0x08090e, 1)
  ];
  const nose = scene.add.triangle(width / 2 + 2, 0, -3, -3, 3, 0, -3, 3, trim, 0.92);
  const vehicleLabel = archetype.vehicleClass === VEHICLE_CLASSES.POLICE
    ? (archetype.policeRole === "unmarked" ? "UNMARKED" : "POLICE")
    : archetype.label.toUpperCase();
  const label = scene.add.text(0, -height - 5, vehicleLabel, {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "12px",
    fontStyle: "bold",
    color: `#${trim.toString(16).padStart(6, "0")}`,
    backgroundColor: "rgba(5, 6, 11, .68)",
    padding: { x: 3, y: 1 }
  }).setOrigin(0.5, 1).setRotation(-(Number(definition.angle) || 0));
  label.setResolution?.(3);
  label.setStroke?.("#05060b", 2);
  container.add([...parts, ...wheels, nose, label]);
  return { body, cabin, hood, wheels, nose, label, details: parts.slice(3) };
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
    gear: Math.max(1, Math.round(Number(vehicle.gear) || 1)),
    gearCount: vehicleGearCount(archetype),
    shifting: (Number(vehicle.gearShiftTimer) || 0) > 0,
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
  const gear = Math.max(1, Math.round(Number(vehicle.gear) || 1));
  const gearText = vehicle.speed < -0.5 ? "R" : `G${gear}/${vehicleGearCount(vehicle.archetype)}${(vehicle.gearShiftTimer || 0) > 0 ? "↑" : ""}`;
  const driftText = drift >= 7 && Math.abs(vehicle.speed) > 24 ? ` · DRIFT ${drift}°` : "";
  const state = vehicle.disabled
    ? "WRECKED · ENTER exit"
    : `${system.handbrakeActive ? "HANDBRAKE · " : ""}SPACE handbrake · ENTER exit`;
  system.hud.setText(
    `${vehicle.name.toUpperCase()} · ${gearText} · ${vehicleSpeedKph(vehicle.speed)} km/h${driftText} · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}% · trunk ${trunk.used}/${trunk.capacity} · ${state}`
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
  return `${vehicle.name} · G${Math.max(1, Math.round(Number(vehicle.gear) || 1))} · ${vehicleSpeedKph(vehicle.speed)} km/h${drift >= 7 ? ` · drift ${drift}°` : ""} · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%`;
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
