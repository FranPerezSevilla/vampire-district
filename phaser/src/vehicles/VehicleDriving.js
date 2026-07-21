import { CAMERA, WORLD } from "../data/balance.js";
import { buildings } from "../data/district.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import {
  interpolateVehicleState,
  rotateTowardAngle,
  stepVehicleKinematics,
  vehicleCameraZoom,
  vehicleFootprintPoints,
  vehicleHealthPercent,
  vehicleImpactDamage,
  vehicleSlideCandidates
} from "./VehicleModel.js";
import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";

const VEHICLE_COLLISION_RADIUS_PADDING = 3;
const PERSIST_INTERVAL_SECONDS = 1.8;
const CONTACT_SEARCH_STEPS = 8;

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function applyKinematicState(vehicle, next) {
  vehicle.x = next.x;
  vehicle.y = next.y;
  vehicle.angle = next.angle;
  vehicle.travelAngle = next.travelAngle ?? next.angle;
  vehicle.driftAngle = next.driftAngle || 0;
  vehicle.velocityX = next.velocityX || 0;
  vehicle.velocityY = next.velocityY || 0;
  vehicle.speed = next.speed;
  vehicle.parked = next.parked;
  vehicle.handbrake = Boolean(next.handbrake);
  return vehicle;
}

function furthestSafeContact(system, vehicle, next) {
  let low = 0;
  let high = 1;
  let best = null;
  for (let index = 0; index < CONTACT_SEARCH_STEPS; index++) {
    const progress = (low + high) / 2;
    const candidate = interpolateVehicleState(vehicle, next, progress);
    if (system.canOccupy(vehicle, candidate.x, candidate.y, candidate.angle)) {
      best = candidate;
      low = progress;
    } else {
      high = progress;
    }
  }
  if (!best) return null;
  const travel = Phaser.Math.Distance.Between(vehicle.x, vehicle.y, best.x, best.y);
  return travel > 0.08 ? best : null;
}

function slideAlongWorld(system, vehicle, next) {
  const contact = furthestSafeContact(system, vehicle, next);
  const origin = contact || vehicle;
  const candidates = vehicleSlideCandidates(origin, next, 0.96)
    .filter(candidate => system.canOccupy(vehicle, candidate.x, candidate.y, candidate.angle))
    .sort((left, right) => {
      const leftTravel = Phaser.Math.Distance.Between(vehicle.x, vehicle.y, left.x, left.y);
      const rightTravel = Phaser.Math.Distance.Between(vehicle.x, vehicle.y, right.x, right.y);
      return rightTravel - leftTravel;
    });

  if (candidates.length) {
    applyKinematicState(vehicle, candidates[0]);
    return true;
  }

  if (!contact) return false;

  const rotationOnly = {
    ...contact,
    angle: next.angle,
    travelAngle: rotateTowardAngle(contact.travelAngle ?? contact.angle, next.angle, 0.16),
    speed: (Number(next.speed) || 0) * 0.58
  };
  if (system.canOccupy(vehicle, rotationOnly.x, rotationOnly.y, rotationOnly.angle)) {
    applyKinematicState(vehicle, rotationOnly);
    return true;
  }

  contact.speed = (Number(next.speed) || 0) * 0.42;
  contact.velocityX = Math.cos(contact.travelAngle ?? contact.angle) * contact.speed;
  contact.velocityY = Math.sin(contact.travelAngle ?? contact.angle) * contact.speed;
  applyKinematicState(vehicle, contact);
  return true;
}

export function filterVehicleInputFrame(system, frame) {
  if (!system.isDriving()) return frame;
  return {
    ...frame,
    quietHeld: false,
    sprintHeld: false,
    primaryHeld: false,
    primaryPressed: false,
    drainHeld: false,
    drainPressed: false,
    interactPressed: false,
    traversePressed: Boolean(frame.vehicleActionPressed),
    handbrakeHeld: Boolean(frame.handbrakeHeld),
    weaponStep: 0,
    dashPressed: false,
    whisperPressed: false,
    bloodSensePressed: false,
    vehicleActive: true
  };
}

export function canVehicleOccupy(system, vehicle, x, y, angle) {
  const candidate = { ...vehicle, x, y, angle };
  const points = vehicleFootprintPoints(candidate, vehicle.archetype, VEHICLE_COLLISION_RADIUS_PADDING);
  for (const point of points) {
    if (point.x < 5 || point.y < 5 || point.x > WORLD.width - 5 || point.y > WORLD.height - 5) return false;
    if (buildings.some(building => pointInRect(point, building))) return false;
  }
  const ownRadius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.46;
  for (const other of system.vehicles) {
    if (other === vehicle) continue;
    const otherRadius = Math.max(other.archetype.width, other.archetype.height) * 0.46;
    if (Phaser.Math.Distance.Between(x, y, other.x, other.y) < ownRadius + otherRadius) return false;
  }
  return true;
}

export function handleVehicleWorldCollision(system, vehicle, impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  const direction = Math.sign(vehicle.speed || impactSpeed || 1);
  vehicle.speed = direction * Math.min(10, impact * 0.07);
  vehicle.travelAngle = rotateTowardAngle(vehicle.travelAngle ?? vehicle.angle, vehicle.angle, 0.22);
  vehicle.driftAngle = 0;
  vehicle.velocityX = Math.cos(vehicle.travelAngle) * vehicle.speed;
  vehicle.velocityY = Math.sin(vehicle.travelAngle) * vehicle.speed;

  const damage = vehicleImpactDamage(impact, { threshold: 32, scale: 0.13 });
  if (damage > 0) system.damageVehicle(vehicle.id, damage, { reason: "collision", persist: false });
  if (impact >= 40 && system.crashCooldown <= 0) {
    system.crashCooldown = 0.48;
    RawAudio.play("bodyDrop", { cooldown: 0.4 });
    system.scene.exposureSystem?.add?.(Math.min(7, Math.max(2, Math.ceil(impact / 42))), `${vehicle.name} crashes into the streetscape. The impact carries through the district.`);
    system.scene.policeSystem?.addHeat?.(vehicle.x, vehicle.y, Math.min(20, impact * 0.10), "vehicle crash");
    system.scene.lastActionText = `${vehicle.name} collision · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%.`;
  }
}

export function updateVehicleDriving(system, dt, frame) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  system.crashCooldown = Math.max(0, system.crashCooldown - dt);
  for (const [npcId, remaining] of system.pedestrianCooldowns) {
    const next = remaining - dt;
    if (next <= 0) system.pedestrianCooldowns.delete(npcId);
    else system.pedestrianCooldowns.set(npcId, next);
  }

  system.handbrakeActive = Boolean(frame?.handbrakeHeld && !vehicle.disabled);
  const next = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
  const furniture = system.scene.streetFurnitureSystem?.resolveVehicleMove?.(vehicle, next) || { blocked: false, impacts: [] };
  if (vehicle.disabled) {
    vehicle.handbrake = false;
    system.updateHud();
    system.publish();
    return false;
  }

  if (furniture.blocked) {
    handleVehicleWorldCollision(system, vehicle, next.speed);
  } else if (canVehicleOccupy(system, vehicle, next.x, next.y, next.angle)) {
    applyKinematicState(vehicle, next);
  } else if (!slideAlongWorld(system, vehicle, next)) {
    handleVehicleWorldCollision(system, vehicle, next.speed);
  }

  vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
  vehicle.visual.label.setRotation(-vehicle.angle);
  system.scene.player.setPosition(vehicle.x, vehicle.y);
  collideVehicleWithPedestrians(system, vehicle);
  system.persistTimer += dt;
  if (system.persistTimer >= PERSIST_INTERVAL_SECONDS) {
    system.persistTimer %= PERSIST_INTERVAL_SECONDS;
    system.persistVehicle(vehicle, { emit: false });
  }
  system.updateHud();
  system.publish();
  return true;
}

export function updateVehicleCamera(system) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  const renderScale = typeof window !== "undefined" ? window.NBD_RESOLUTION_PRESET?.renderScale || 1 : 1;
  const baseZoom = CAMERA.streetZoom * renderScale;
  const targetZoom = vehicleCameraZoom(baseZoom, vehicle.speed, vehicle.archetype);
  const camera = system.scene.cameras.main;
  camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.09));
  return true;
}