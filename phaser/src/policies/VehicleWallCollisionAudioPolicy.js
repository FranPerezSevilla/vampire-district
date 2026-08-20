import { WORLD } from "../data/balance.js";
import { buildings } from "../data/district.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { vehicleCollisionAudioEvent } from "../vehicles/VehicleCollisionAudioModel.js";
import { stepVehicleKinematics, vehicleFootprintPoints, vehicleHealthPercent } from "../vehicles/VehicleModel.js";
import { VehicleSystem } from "../vehicles/VehicleSystem.js";

const WALL_IMPACT_MIN_SPEED = 24;
const WALL_IMPACT_COOLDOWN = 0.48;
const WALL_FOOTPRINT_PADDING = 1;

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
}

function boundsForPoints(points) {
  const xs = points.map(point => Number(point.x) || 0);
  const ys = points.map(point => Number(point.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY)
  };
}

export function vehicleWouldHitWall(system, vehicle, next) {
  if (!system?.scene || !vehicle || !next) return false;
  const candidate = { ...vehicle, x: next.x, y: next.y, angle: next.angle };
  const points = vehicleFootprintPoints(candidate, vehicle.archetype, WALL_FOOTPRINT_PADDING);
  const footprintBounds = boundsForPoints(points);
  const nearbyBuildings = system.scene.cityStreamSystem?.query?.("buildings", footprintBounds) || buildings;

  return points.some(point => (
    point.x < 5
    || point.y < 5
    || point.x > WORLD.width - 5
    || point.y > WORLD.height - 5
    || nearbyBuildings.some(building => pointInRect(point, building))
  ));
}

export function wallCollisionAudioEvent(impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  if (impact < WALL_IMPACT_MIN_SPEED) return null;
  return vehicleCollisionAudioEvent(impact) || "vehicleCollisionLight";
}

export function installVehicleWallCollisionAudioPolicy() {
  const prototype = VehicleSystem.prototype;
  if (prototype.__viceBloodWallCollisionAudioPolicy) return;
  prototype.__viceBloodWallCollisionAudioPolicy = true;

  const originalUpdateDriving = prototype.updateDriving;
  prototype.updateDriving = function viceBloodWallCollisionAudio(dt, frame) {
    const vehicle = this.currentVehicle?.();
    if (!vehicle || vehicle.disabled) return originalUpdateDriving.call(this, dt, frame);

    const seconds = Math.max(0, Number(dt) || 0);
    const cooldownBefore = Math.max(0, Number(this.crashCooldown) || 0);
    const next = stepVehicleKinematics(vehicle, frame, seconds, vehicle.archetype);
    const wallContact = vehicleWouldHitWall(this, vehicle, next);
    const impactSpeed = Math.abs(Number(next.speed) || 0);
    const vehicleId = vehicle.id;

    const result = originalUpdateDriving.call(this, dt, frame);
    if (!wallContact) {
      if (this.__viceBloodWallContactLatched === vehicleId) this.__viceBloodWallContactLatched = null;
      return result;
    }

    // The base driving path already owns hard-stop crashes. If it refreshed the
    // cooldown, it also emitted the correct collision sample and we must not duplicate it.
    const expectedCooldown = Math.max(0, cooldownBefore - seconds);
    const originalFeedback = Math.max(0, Number(this.crashCooldown) || 0) > expectedCooldown + 0.08;
    if (originalFeedback) {
      this.__viceBloodWallContactLatched = vehicleId;
      return result;
    }

    const audioEvent = wallCollisionAudioEvent(impactSpeed);
    if (!audioEvent || expectedCooldown > 0 || this.__viceBloodWallContactLatched === vehicleId) return result;

    // Sliding/deflection recovery used to make wall hits visually react but silently
    // bypass handleVehicleWorldCollision(). Give that real contact the same crash family.
    RawAudio.play(audioEvent, { cooldown: 0.28 });
    this.crashCooldown = WALL_IMPACT_COOLDOWN;
    this.__viceBloodWallContactLatched = vehicleId;
    this.scene.policeSystem?.addHeat?.(
      vehicle.x,
      vehicle.y,
      Math.min(24, Math.max(4, impactSpeed * 0.12)),
      `${vehicle.name} crashes into a wall`,
      { source: "vehicle_crash" }
    );
    this.scene.events?.emit?.("vehicle:collision", {
      vehicleId,
      targetId: null,
      targetKind: "world",
      policeTarget: false,
      impactSpeed,
      audioEvent
    });
    this.scene.lastActionText = `${vehicle.name} collision · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%.`;
    return result;
  };
}
