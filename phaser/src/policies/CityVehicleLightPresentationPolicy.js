import { LAYERS } from "../data/district.js";

export const VEHICLE_LIGHT_FAMILIES = Object.freeze({
  HEADLIGHT: "vehicle-headlight",
  TAIL: "vehicle-tail",
  POLICE_RED: "police-red",
  POLICE_BLUE: "police-blue"
});

export const VEHICLE_LIGHT_PRESENTATION = Object.freeze({
  cullMargin: 120,
  headlightColor: 0xffe3ad,
  tailColor: 0xa9323e,
  policeRed: 0xff3656,
  policeBlue: 0x4f86ff,
  headlightAlpha: 0.030,
  tailAlpha: 0.050,
  policeAlpha: 0.055
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function visibleSource(source) {
  if (!source) return false;
  if (source.tokenId === null) return false;
  if (source.unitId === null) return false;
  if (source.exploded || source.disabled) return false;
  if (source.container?.visible === false || source.container?.active === false) return false;
  return true;
}

function pointInsideBounds(source, bounds, margin) {
  if (!bounds) return true;
  const x = finite(source?.x, finite(source?.container?.x));
  const y = finite(source?.y, finite(source?.container?.y));
  return x >= finite(bounds.x) - margin
    && x <= finite(bounds.x) + finite(bounds.width, finite(bounds.w)) + margin
    && y >= finite(bounds.y) - margin
    && y <= finite(bounds.y) + finite(bounds.height, finite(bounds.h)) + margin;
}

function vehiclePose(source) {
  const archetype = source?.archetype || {};
  const angle = finite(source?.angle, finite(source?.container?.rotation));
  const x = finite(source?.x, finite(source?.container?.x));
  const y = finite(source?.y, finite(source?.container?.y));
  const length = Math.max(18, finite(archetype.width, 30));
  const width = Math.max(10, finite(archetype.height, 16));
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const sideX = -dirY;
  const sideY = dirX;
  return { x, y, angle, length, width, dirX, dirY, sideX, sideY };
}

function descriptor(sourceId, family, x, y, pose, extras = {}) {
  return Object.freeze({
    sourceId,
    family,
    x,
    y,
    dirX: pose.dirX,
    dirY: pose.dirY,
    sideX: pose.sideX,
    sideY: pose.sideY,
    vehicleLength: pose.length,
    vehicleWidth: pose.width,
    ...extras
  });
}

function vehicleBaseDescriptors(source, sourceId, { headlights = true, tails = true, braking = false } = {}) {
  const pose = vehiclePose(source);
  const frontDistance = pose.length * 0.52 + 5;
  const rearDistance = pose.length * 0.52 + 3;
  const results = [];
  if (headlights) {
    results.push(descriptor(
      `${sourceId}:headlight`,
      VEHICLE_LIGHT_FAMILIES.HEADLIGHT,
      pose.x + pose.dirX * frontDistance,
      pose.y + pose.dirY * frontDistance,
      pose,
      { intensity: 1 }
    ));
  }
  if (tails) {
    results.push(descriptor(
      `${sourceId}:tail`,
      VEHICLE_LIGHT_FAMILIES.TAIL,
      pose.x - pose.dirX * rearDistance,
      pose.y - pose.dirY * rearDistance,
      pose,
      { intensity: braking ? 1.35 : 0.72, braking: Boolean(braking) }
    ));
  }
  return results;
}

export function buildTrafficVehicleLightDescriptors(slots, bounds = null) {
  const margin = VEHICLE_LIGHT_PRESENTATION.cullMargin;
  const results = [];
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot?.tokenId || !visibleSource(slot) || !pointInsideBounds(slot, bounds, margin)) continue;
    const braking = finite(slot.desiredSpeedFactor, 1) + 0.08 < finite(slot.speedFactor, 1);
    results.push(...vehicleBaseDescriptors(slot, `traffic:${slot.tokenId}`, { braking }));
  }
  return results;
}

export function buildPlayerVehicleLightDescriptors(vehicle, bounds = null) {
  if (!vehicle || !visibleSource(vehicle) || !pointInsideBounds(vehicle, bounds, VEHICLE_LIGHT_PRESENTATION.cullMargin)) return [];
  const moving = Math.abs(finite(vehicle.speed)) > 0.5 || vehicle.parked === false;
  if (!moving) return [];
  return vehicleBaseDescriptors(vehicle, `vehicle:${vehicle.id || "current"}`, {
    braking: Boolean(vehicle.handbrake)
  });
}

export function buildPoliceVehicleLightDescriptors(slots, bounds = null, nowMs = 0) {
  const results = [];
  const pulseStep = Math.floor(Math.max(0, finite(nowMs)) / 180);
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot?.unitId || !visibleSource(slot) || !pointInsideBounds(slot, bounds, VEHICLE_LIGHT_PRESENTATION.cullMargin)) continue;
    const sourceId = `police:${slot.unitId}`;
    const pose = vehiclePose(slot);
    results.push(...vehicleBaseDescriptors(slot, sourceId));

    const offset = Math.max(3.5, pose.width * 0.18);
    const redHot = (pulseStep + finite(slot.slotIndex)) % 2 === 0;
    results.push(descriptor(
      `${sourceId}:red`,
      VEHICLE_LIGHT_FAMILIES.POLICE_RED,
      pose.x + pose.sideX * offset,
      pose.y + pose.sideY * offset,
      pose,
      { intensity: redHot ? 1 : 0.22 }
    ));
    results.push(descriptor(
      `${sourceId}:blue`,
      VEHICLE_LIGHT_FAMILIES.POLICE_BLUE,
      pose.x - pose.sideX * offset,
      pose.y - pose.sideY * offset,
      pose,
      { intensity: redHot ? 0.22 : 1 }
    ));
  }
  return results;
}

export function buildVehicleLightDescriptors({
  trafficSlots = [],
  currentVehicle = null,
  policeSlots = []
} = {}, bounds = null, nowMs = 0) {
  return Object.freeze([
    ...buildTrafficVehicleLightDescriptors(trafficSlots, bounds),
    ...buildPlayerVehicleLightDescriptors(currentVehicle, bounds),
    ...buildPoliceVehicleLightDescriptors(policeSlots, bounds, nowMs)
  ]);
}

function drawHeadlight(graphics, item) {
  const style = VEHICLE_LIGHT_PRESENTATION;
  const baseRadius = Math.max(4, item.vehicleWidth * 0.32);
  const reach = Math.max(14, item.vehicleLength * 0.72);
  const steps = [
    { distance: 0, radius: baseRadius * 0.75, alpha: style.headlightAlpha * 1.35 },
    { distance: reach * 0.28, radius: baseRadius * 1.05, alpha: style.headlightAlpha },
    { distance: reach * 0.60, radius: baseRadius * 1.38, alpha: style.headlightAlpha * 0.70 },
    { distance: reach, radius: baseRadius * 1.70, alpha: style.headlightAlpha * 0.36 }
  ];
  for (const step of steps) {
    graphics.fillStyle(style.headlightColor, step.alpha * item.intensity);
    graphics.fillCircle(item.x + item.dirX * step.distance, item.y + item.dirY * step.distance, step.radius);
  }
}

function drawTail(graphics, item) {
  const style = VEHICLE_LIGHT_PRESENTATION;
  const radius = Math.max(3, item.vehicleWidth * 0.26);
  graphics.fillStyle(style.tailColor, style.tailAlpha * item.intensity).fillCircle(item.x, item.y, radius * 1.35);
  graphics.fillStyle(0xe55a64, style.tailAlpha * 1.2 * item.intensity).fillCircle(item.x, item.y, radius * 0.52);
}

function drawPolicePulse(graphics, item, color) {
  const style = VEHICLE_LIGHT_PRESENTATION;
  const radius = Math.max(5, item.vehicleWidth * 0.42);
  graphics.fillStyle(color, style.policeAlpha * item.intensity).fillCircle(item.x, item.y, radius * 1.55);
  graphics.fillStyle(color, style.policeAlpha * 1.35 * item.intensity).fillCircle(item.x, item.y, radius * 0.62);
}

export function drawVehicleLightDescriptors(graphics, descriptors) {
  if (!graphics) return;
  for (const item of descriptors || []) {
    if (item.family === VEHICLE_LIGHT_FAMILIES.HEADLIGHT) drawHeadlight(graphics, item);
    else if (item.family === VEHICLE_LIGHT_FAMILIES.TAIL) drawTail(graphics, item);
    else if (item.family === VEHICLE_LIGHT_FAMILIES.POLICE_RED) drawPolicePulse(graphics, item, VEHICLE_LIGHT_PRESENTATION.policeRed);
    else if (item.family === VEHICLE_LIGHT_FAMILIES.POLICE_BLUE) drawPolicePulse(graphics, item, VEHICLE_LIGHT_PRESENTATION.policeBlue);
  }
}

export function installCityVehicleLightPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityVehicleLightPresentationPolicy) return;
  prototype.__viceCityVehicleLightPresentationPolicy = true;

  const baseUpdate = prototype.update;
  if (typeof baseUpdate !== "function") throw new Error("CityVehicleLightPresentationPolicy requires GameScene.update().");

  prototype.updateVehicleLightPresentation = function viceBloodUpdateVehicleLightPresentation(time = 0) {
    if (!this.vehicleLightGraphics) {
      this.vehicleLightGraphics = this.add.graphics().setDepth(45.2);
    }
    this.vehicleLightGraphics.clear();
    if (this.currentLayer !== LAYERS.STREET) {
      this.cityVehicleLightDescriptors = Object.freeze([]);
      return this.cityVehicleLightDescriptors;
    }

    const view = this.cameras?.main?.worldView;
    const bounds = view ? { x: view.x, y: view.y, width: view.width, height: view.height } : null;
    const descriptors = buildVehicleLightDescriptors({
      trafficSlots: this.trafficMaterializationSystem?.pool || [],
      currentVehicle: this.vehicleSystem?.currentVehicle?.() || null,
      policeSlots: this.motorizedPoliceSystem?.slots || []
    }, bounds, time);
    drawVehicleLightDescriptors(this.vehicleLightGraphics, descriptors);
    this.cityVehicleLightDescriptors = descriptors;
    return descriptors;
  };

  prototype.update = function viceBloodUpdateWithVehicleLights(time, deltaMs) {
    const result = baseUpdate.call(this, time, deltaMs);
    this.updateVehicleLightPresentation(time);
    return result;
  };
}
