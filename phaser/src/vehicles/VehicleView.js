import { WORLD } from "../data/balance.js";
import { VEHICLE_CLASSES, VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { createVehicleContactShadow } from "./VehicleGroundingPresentation.js";
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

  // One shallow contact footprint replaces the nearly coincident rectangular underlay. It remains
  // a child of the existing vehicle visual, so movement/rotation stay free and no shadow system scans the world.
  const shadow = createVehicleContactShadow(scene, archetype);
  parts.push(shadow);

  // The body remains deliberately flat to match ViceBlood's city rendering.
  const body = detail(0, 0, width, height, color, 1).setStrokeStyle(1, 0x111621, 0.95);

  // Embedded dark side bands make the footprint read as wheels/body rather than a floating box.
  detail(-width * 0.47, 0, width * 0.06, height * 0.74, 0x171b25, 0.84);
  detail(width * 0.47, 0, width * 0.06, height * 0.74, 0x171b25, 0.84);

  let cabinX = -width * 0.06;
  let cabinWidth = width * 0.43;
  let cabinHeight = height * 0.68;
  let hoodX = width * 0.31;
  let hoodWidth = width * 0.23;

  // Silhouette language: make each family readable before any small detail is noticed.
  if (["compact", "hatchback", "junker"].includes(style)) {
    cabinX = -width * 0.11;
    cabinWidth = width * 0.50;
    cabinHeight = height * 0.72;
    hoodX = width * 0.34;
    hoodWidth = width * 0.16;
    detail(-width * 0.43, 0, width * 0.10, height * 0.76, color, 0.88);
  } else if (["muscle", "sports", "coupe", "police-interceptor"].includes(style)) {
    cabinX = -width * 0.12;
    cabinWidth = width * 0.33;
    cabinHeight = height * 0.58;
    hoodX = width * 0.28;
    hoodWidth = width * 0.32;
    detail(width * 0.44, 0, width * 0.08, height * 0.84, color, 0.92);
  } else if (["suv", "police-suv"].includes(style)) {
    cabinX = -width * 0.05;
    cabinWidth = width * 0.57;
    cabinHeight = height * 0.76;
    hoodX = width * 0.34;
    hoodWidth = width * 0.18;
    detail(0, 0, width * 0.88, height * 0.90, color, 0.24);
  } else if (["van", "delivery-van"].includes(style)) {
    cabinX = width * 0.22;
    cabinWidth = width * 0.25;
    cabinHeight = height * 0.76;
    hoodX = width * 0.42;
    hoodWidth = width * 0.09;
    detail(-width * 0.15, 0, width * 0.57, height * 0.82, color, 0.42);
  } else if (style === "pickup") {
    cabinX = width * 0.12;
    cabinWidth = width * 0.29;
    cabinHeight = height * 0.68;
    hoodX = width * 0.38;
    hoodWidth = width * 0.16;
  } else if (style === "limousine") {
    cabinX = -width * 0.05;
    cabinWidth = width * 0.64;
    hoodX = width * 0.40;
    hoodWidth = width * 0.14;
  } else if (style === "hearse") {
    cabinX = width * 0.10;
    cabinWidth = width * 0.30;
    hoodX = width * 0.39;
    hoodWidth = width * 0.15;
  }

  // Stronger glass/body separation improves mid-tone and brown cars against asphalt.
  const cabin = detail(cabinX, 0, cabinWidth, cabinHeight, 0x0b1119, 0.99)
    .setStrokeStyle(1, 0x3e4b58, 0.90);
  const hood = detail(hoodX, 0, hoodWidth, height * 0.64, trim, 0.14)
    .setStrokeStyle(1, 0x111621, 0.56);

  detail(cabinX + cabinWidth * 0.26, 0, 1.2, cabinHeight * 0.82, 0x455463, 0.56);
  detail(cabinX - cabinWidth * 0.27, 0, 1.0, cabinHeight * 0.78, 0x06090e, 0.72);

  const lampH = Math.max(1.3, height * 0.18);
  detail(width * 0.43, -height * 0.31, width * 0.09, lampH, 0xc9d4d8, 0.84);
  detail(width * 0.43, height * 0.31, width * 0.09, lampH, 0xc9d4d8, 0.84);
  detail(-width * 0.43, -height * 0.31, width * 0.08, lampH, 0xa74841, 0.76);
  detail(-width * 0.43, height * 0.31, width * 0.08, lampH, 0xa74841, 0.76);

  if (style === "compact") {
    detail(width * 0.42, -height * 0.29, height * 0.17, height * 0.17, 0xd8bd7d, 0.92);
    detail(width * 0.42, height * 0.29, height * 0.17, height * 0.17, 0xd8bd7d, 0.92);
    detail(width * 0.39, 0, width * 0.08, height * 0.24, 0x151b21, 0.92);
    detail(-width * 0.29, 0, width * 0.05, height * 0.78, trim, 0.20);
  }
  if (style === "hatchback") {
    detail(-width * 0.35, 0, width * 0.16, height * 0.64, 0x0b1119, 0.82);
  }
  if (style === "sedan" || style === "executive") {
    detail(-width * 0.08, 0, width * 0.14, height * 0.46, 0x26323e, 0.84).setStrokeStyle(1, 0x090c11, 0.76);
  }
  if (style === "taxi") {
    detail(-width * 0.04, 0, width * 0.13, height * 0.24, 0xb99547, 0.96).setStrokeStyle(1, 0x342c1b, 0.9);
  }
  if (style === "muscle") {
    detail(width * 0.03, -height * 0.10, width * 0.74, 1.2, 0x15181e, 0.74);
    detail(width * 0.03, height * 0.10, width * 0.74, 1.2, 0x15181e, 0.74);
  }
  if (style === "sports") {
    detail(0, -height * 0.10, width * 0.90, height * 0.10, 0x151820, 0.82);
    detail(0, height * 0.10, width * 0.90, height * 0.10, 0x151820, 0.82);
    detail(-width * 0.34, 0, width * 0.15, height * 0.48, 0x090d13, 0.80);
    detail(width * 0.28, 0, width * 0.08, height * 0.42, 0x090c11, 0.82);
  }
  if (["suv", "police-suv"].includes(style)) {
    detail(-width * 0.04, -height * 0.35, width * 0.60, 1.4, 0x171c24, 0.94);
    detail(-width * 0.04, height * 0.35, width * 0.60, 1.4, 0x171c24, 0.94);
    detail(width * 0.28, 0, width * 0.13, height * 0.25, 0x10141a, 0.80);
    if (style === "suv") detail(-width * 0.41, 0, height * 0.40, height * 0.40, 0x11151b, 0.86);
  }
  if (style === "pickup") {
    detail(-width * 0.29, 0, width * 0.36, height * 0.70, 0x151a20, 0.90).setStrokeStyle(1, 0x36404a, 0.56);
    detail(-width * 0.29, 0, width * 0.22, height * 0.50, color, 0.36);
  }
  if (["van", "delivery-van"].includes(style)) {
    detail(-width * 0.18, 0, width * 0.52, height * 0.72, trim, 0.08).setStrokeStyle(1, 0x111621, 0.50);
    if (style === "delivery-van") detail(-width * 0.19, 0, 1.1, height * 0.62, 0x2b3540, 0.65);
  }
  if (style === "limousine") {
    detail(-width * 0.11, 0, 1.0, height * 0.58, 0x394450, 0.72);
    detail(-width * 0.25, 0, 1.0, height * 0.58, 0x394450, 0.72);
  }
  if (style === "hearse") {
    detail(-width * 0.24, 0, width * 0.46, height * 0.70, 0x0d1219, 0.90).setStrokeStyle(1, trim, 0.28);
    detail(-width * 0.24, 0, width * 0.23, 1.2, trim, 0.48);
    detail(-width * 0.24, 0, 1.2, height * 0.30, trim, 0.48);
  }
  if (["coupe", "junker"].includes(style)) {
    detail(-width * 0.24, height * 0.22, width * 0.18, height * 0.18, 0x553a30, 0.58).setRotation(-0.10);
  }

  if (archetype.vehicleClass === VEHICLE_CLASSES.POLICE) {
    if (archetype.policeRole !== "unmarked") {
      // Softer police contrast: readable authority without becoming the brightest object on the street.
      detail(-width * 0.08, 0, width * 0.35, height * 0.72, 0xbfc5c8, 0.82);
      detail(width * 0.20, 0, width * 0.16, height * 0.72, 0x151b24, 0.74);
      detail(-width * 0.03, -height * 0.17, width * 0.10, height * 0.18, 0x3f72bd, 0.94);
      detail(-width * 0.03, height * 0.17, width * 0.10, height * 0.18, 0xb8424a, 0.94);
      if (["police-interceptor", "police-suv"].includes(style)) {
        detail(width * 0.49, 0, width * 0.06, height * 0.86, 0x10141b, 0.98);
      }
    } else {
      detail(width * 0.14, -height * 0.18, 2.5, 1.4, 0x3f72bd, 0.90);
      detail(width * 0.14, height * 0.18, 2.5, 1.4, 0xb8424a, 0.90);
    }
  }

  const wheels = [
    scene.add.rectangle(-width * 0.29, -height * 0.53, width * 0.18, 2.7, 0x07090d, 1),
    scene.add.rectangle(width * 0.29, -height * 0.53, width * 0.18, 2.7, 0x07090d, 1),
    scene.add.rectangle(-width * 0.29, height * 0.53, width * 0.18, 2.7, 0x07090d, 1),
    scene.add.rectangle(width * 0.29, height * 0.53, width * 0.18, 2.7, 0x07090d, 1)
  ];
  const nose = scene.add.triangle(width / 2 + 1.6, 0, -2.6, -2.2, 2.6, 0, -2.6, 2.2, trim, 0.64);
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
  return { shadow, body, cabin, hood, wheels, nose, label, details: parts.slice(3) };
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
