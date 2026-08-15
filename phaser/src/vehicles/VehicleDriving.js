import { CAMERA, WORLD } from "../data/balance.js";
import { buildings } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import {
  interpolateVehicleState,
  normalizeAngle,
  rotateTowardAngle,
  stepVehicleKinematics,
  vehicleCameraLookAhead,
  vehicleCameraZoom,
  vehicleFootprintPoints,
  vehicleHealthPercent,
  vehicleImpactDamage,
  vehicleSlideCandidates
} from "./VehicleModel.js";
import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";

const VEHICLE_COLLISION_RADIUS_PADDING = 1;
const PERSIST_INTERVAL_SECONDS = 1.8;
const CONTACT_SEARCH_STEPS = 10;
const AGGRESSIVE_SKID_THRESHOLD = 0.28;
const AGGRESSIVE_SKID_PULSE_SECONDS = 0.22;

export function aggressiveDrivingSkidIntensity(vehicle, frame = {}) {
  const speed = Math.abs(Number(vehicle?.speed) || 0);
  if (speed < 28) return 0;

  const drift = Math.abs(Number(vehicle?.driftAngle) || 0);
  const steer = Math.abs(Number(frame?.move?.x) || 0);
  const handbrake = Boolean(vehicle?.handbrake || frame?.handbrakeHeld);
  const driftScore = Math.min(1, drift / 0.20);
  const handbrakeScore = handbrake && steer >= 0.28
    ? Math.min(1, Math.max(0, speed - 20) / 50)
    : 0;
  return Math.max(driftScore, handbrakeScore);
}

export function panicCiviliansFromAggressiveDriving(system, vehicle, intensity = 0) {
  if (!system?.scene || !vehicle) return 0;
  const strength = Math.max(0, Math.min(1, Number(intensity) || 0));
  const radius = 95 + strength * 70;
  const candidates = system.scene.npcSystem?.queryRadius?.(
    vehicle.x,
    vehicle.y,
    radius,
    system.scene.currentLayer,
    npc => [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
  ) || [];

  let newlyPanicked = 0;
  for (const npc of candidates) {
    if (!npc || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted || npc.drainVictim) continue;
    if (npc.alarmed || npc.chasingPlayer || npc.enemyAttack) continue;
    if (Number.isFinite(npc.stunnedTimer) && npc.stunnedTimer > 0) continue;

    const wasPanicking = (npc.panicTimer || 0) > 0;
    npc.panicTimer = Math.max(npc.panicTimer || 0, 1.35 + strength * 1.25);
    npc.panicSourceX = vehicle.x;
    npc.panicSourceY = vehicle.y;
    npc.soundReactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    system.scene.aiStateSystem?.resolveNpc?.(npc);
    if (!wasPanicking) newlyPanicked++;
  }

  if (newlyPanicked) RawAudio.play("civilianScream", { cooldown: 0.75 });
  system.scene.events?.emit?.("vehicle:aggressive-driving", {
    vehicleId: vehicle.id,
    x: vehicle.x,
    y: vehicle.y,
    intensity: strength,
    radius,
    panickedCivilians: newlyPanicked
  });
  return newlyPanicked;
}

function emitAggressiveDrivingNoise(system, vehicle, frame) {
  const intensity = aggressiveDrivingSkidIntensity(vehicle, frame);
  if (intensity < AGGRESSIVE_SKID_THRESHOLD || (system.skidNoiseCooldown || 0) > 0) return 0;
  system.skidNoiseCooldown = AGGRESSIVE_SKID_PULSE_SECONDS;
  RawAudio.play("vehicleSkidLoop", { cooldown: 0.16 });
  return panicCiviliansFromAggressiveDriving(system, vehicle, intensity);
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function boundsForPoints(points) {
  const xs = points.map(point => Number(point.x) || 0);
  const ys = points.map(point => Number(point.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
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
  vehicle.gear = Math.max(1, Math.round(Number(next.gear) || 1));
  vehicle.gearShiftTimer = Math.max(0, Number(next.gearShiftTimer) || 0);
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
  return travel > 0.025 ? best : null;
}

function escapeNudges(system, vehicle, next) {
  const forward = { x: Math.cos(vehicle.angle), y: Math.sin(vehicle.angle) };
  const side = { x: -forward.y, y: forward.x };
  const direction = Math.sign(next.speed || vehicle.speed || 1);
  const candidates = [];
  for (const sideSign of [-1, 1]) {
    for (const sideDistance of [1.5, 3, 5, 7, 10]) {
      for (const rearDistance of [0, 1.5, 3.5, 6]) {
        const angle = normalizeAngle(next.angle + sideSign * 0.05);
        candidates.push({
          ...next,
          x: vehicle.x + side.x * sideSign * sideDistance - forward.x * direction * rearDistance,
          y: vehicle.y + side.y * sideSign * sideDistance - forward.y * direction * rearDistance,
          angle,
          travelAngle: rotateTowardAngle(vehicle.travelAngle ?? vehicle.angle, angle, 0.08),
          speed: (Number(next.speed) || 0) * 0.84
        });
      }
    }
  }
  return candidates.find(candidate => system.canOccupy(vehicle, candidate.x, candidate.y, candidate.angle)) || null;
}

function slideAlongWorld(system, vehicle, next) {
  const contact = furthestSafeContact(system, vehicle, next);
  const origin = contact || vehicle;
  const candidates = vehicleSlideCandidates(origin, next, 0.985)
    .filter(candidate => system.canOccupy(vehicle, candidate.x, candidate.y, candidate.angle))
    .sort((left, right) => {
      const leftTravel = Phaser.Math.Distance.Between(vehicle.x, vehicle.y, left.x, left.y);
      const rightTravel = Phaser.Math.Distance.Between(vehicle.x, vehicle.y, right.x, right.y);
      return rightTravel - leftTravel;
    });

  if (candidates.length) {
    const chosen = candidates[0];
    chosen.travelAngle = rotateTowardAngle(chosen.travelAngle ?? chosen.angle, chosen.angle, 0.06);
    chosen.velocityX = Math.cos(chosen.travelAngle) * chosen.speed;
    chosen.velocityY = Math.sin(chosen.travelAngle) * chosen.speed;
    applyKinematicState(vehicle, chosen);
    return true;
  }

  const escape = escapeNudges(system, vehicle, next);
  if (escape) {
    escape.velocityX = Math.cos(escape.travelAngle) * escape.speed;
    escape.velocityY = Math.sin(escape.travelAngle) * escape.speed;
    applyKinematicState(vehicle, escape);
    return true;
  }

  if (!contact) return false;

  const rotationOnly = {
    ...contact,
    angle: next.angle,
    travelAngle: rotateTowardAngle(contact.travelAngle ?? contact.angle, next.angle, 0.10),
    speed: (Number(next.speed) || 0) * 0.76
  };
  if (system.canOccupy(vehicle, rotationOnly.x, rotationOnly.y, rotationOnly.angle)) {
    rotationOnly.velocityX = Math.cos(rotationOnly.travelAngle) * rotationOnly.speed;
    rotationOnly.velocityY = Math.sin(rotationOnly.travelAngle) * rotationOnly.speed;
    applyKinematicState(vehicle, rotationOnly);
    return true;
  }

  contact.speed = (Number(next.speed) || 0) * 0.64;
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
    beastPressed: false,
    vehicleActive: true
  };
}

export function canVehicleOccupy(system, vehicle, x, y, angle) {
  const candidate = { ...vehicle, x, y, angle };
  const points = vehicleFootprintPoints(candidate, vehicle.archetype, VEHICLE_COLLISION_RADIUS_PADDING);
  const footprintBounds = boundsForPoints(points);
  const nearbyBuildings = system.scene.cityStreamSystem?.query?.("buildings", footprintBounds) || buildings;
  for (const point of points) {
    if (point.x < 5 || point.y < 5 || point.x > WORLD.width - 5 || point.y > WORLD.height - 5) return false;
    if (nearbyBuildings.some(building => pointInRect(point, building))) return false;
  }
  const ownRadius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.43;
  for (const other of system.vehicles) {
    if (other === vehicle) continue;
    const otherRadius = Math.max(other.archetype.width, other.archetype.height) * 0.43;
    if (Phaser.Math.Distance.Between(x, y, other.x, other.y) < ownRadius + otherRadius) return false;
  }
  return true;
}

export function handleVehicleWorldCollision(system, vehicle, impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  const direction = Math.sign(vehicle.speed || impactSpeed || 1);
  vehicle.speed = direction * Math.min(5, impact * 0.025);
  vehicle.travelAngle = rotateTowardAngle(vehicle.travelAngle ?? vehicle.angle, vehicle.angle, 0.12);
  vehicle.driftAngle = 0;
  vehicle.velocityX = Math.cos(vehicle.travelAngle) * vehicle.speed;
  vehicle.velocityY = Math.sin(vehicle.travelAngle) * vehicle.speed;

  const damage = vehicleImpactDamage(impact, { threshold: 36, scale: 0.11 });
  if (damage > 0) system.damageVehicle(vehicle.id, damage, { reason: "collision", persist: false });
  if (impact >= 44 && system.crashCooldown <= 0) {
    system.crashCooldown = 0.48;
    RawAudio.play("bodyDrop", { cooldown: 0.4 });
    system.scene.policeSystem?.addHeat?.(vehicle.x, vehicle.y, Math.min(24, Math.max(4, impact * 0.12)), `${vehicle.name} crashes into the streetscape`, { source: "vehicle_crash" });
    system.scene.lastActionText = `${vehicle.name} collision · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%.`;
  }
}

export function updateVehicleDriving(system, dt, frame) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  system.crashCooldown = Math.max(0, system.crashCooldown - dt);
  system.skidNoiseCooldown = Math.max(0, (system.skidNoiseCooldown || 0) - dt);
  for (const [npcId, remaining] of system.pedestrianCooldowns) {
    const next = remaining - dt;
    if (next <= 0) system.pedestrianCooldowns.delete(npcId);
    else system.pedestrianCooldowns.set(npcId, next);
  }

  system.handbrakeActive = Boolean(frame?.handbrakeHeld && !vehicle.disabled);
  const previousGear = Math.max(1, Math.round(Number(vehicle.gear) || 1));
  const next = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
  const furniture = system.scene.streetFurnitureSystem?.resolveVehicleMove?.(vehicle, next) || { blocked: false, impacts: [] };
  if (vehicle.disabled) {
    vehicle.handbrake = false;
    system.updateHud();
    system.publish();
    return false;
  }

  if (furniture.blocked) {
    if (!slideAlongWorld(system, vehicle, next)) handleVehicleWorldCollision(system, vehicle, next.speed);
  } else if (canVehicleOccupy(system, vehicle, next.x, next.y, next.angle)) {
    applyKinematicState(vehicle, next);
  } else if (!slideAlongWorld(system, vehicle, next)) {
    handleVehicleWorldCollision(system, vehicle, next.speed);
  }

  if (vehicle.gear > previousGear) {
    system.scene.events?.emit?.("vehicle:gear-shift", {
      vehicleId: vehicle.id,
      fromGear: previousGear,
      toGear: vehicle.gear,
      speed: vehicle.speed
    });
  }

  vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
  vehicle.visual.label.setRotation(-vehicle.angle);
  system.scene.player.setPosition(vehicle.x, vehicle.y);
  collideVehicleWithPedestrians(system, vehicle);
  emitAggressiveDrivingNoise(system, vehicle, frame);
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
  camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.10));

  const lookAhead = vehicleCameraLookAhead(vehicle, system.scene.currentInputFrame, vehicle.archetype);
  const recentering = lookAhead.strength < 0.08;
  const response = recentering ? 0.28 : 0.10;
  system.cameraLookAheadX = Phaser.Math.Linear(Number(system.cameraLookAheadX) || 0, lookAhead.x, response);
  system.cameraLookAheadY = Phaser.Math.Linear(Number(system.cameraLookAheadY) || 0, lookAhead.y, response);
  camera.setFollowOffset(-system.cameraLookAheadX, -system.cameraLookAheadY);
  return true;
}
