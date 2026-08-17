import { WORLD } from "../data/balance.js";
import { buildings, LAYERS, roofAreas, sewerTunnels } from "../data/district.js";

const EPSILON = 1e-7;

function normalized(direction = {}) {
  const x = Number(direction.x) || 0;
  const y = Number(direction.y) || 0;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function staticWorldPointClear(layer, x, y) {
  if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
  if (layer === LAYERS.STREET) return !buildings.some(building => pointInRect(x, y, building));
  if (layer === LAYERS.SEWER) return sewerTunnels.some(tunnel => pointInRect(x, y, tunnel));
  if (layer === LAYERS.ROOF_LOW || layer === LAYERS.ROOF_HIGH) {
    return (roofAreas[layer] || []).some(roof => pointInRect(x, y, roof));
  }
  return true;
}

export function rayAabbDistance(origin, direction, halfWidth, halfHeight, range = Infinity) {
  const aim = normalized(direction);
  let minimum = 0;
  let maximum = Math.max(0, Number(range) || 0);
  const axes = [
    [Number(origin.x) || 0, aim.x, Math.max(0, Number(halfWidth) || 0)],
    [Number(origin.y) || 0, aim.y, Math.max(0, Number(halfHeight) || 0)]
  ];

  for (const [position, velocity, halfSize] of axes) {
    if (Math.abs(velocity) < EPSILON) {
      if (position < -halfSize || position > halfSize) return null;
      continue;
    }
    let near = (-halfSize - position) / velocity;
    let far = (halfSize - position) / velocity;
    if (near > far) [near, far] = [far, near];
    minimum = Math.max(minimum, near);
    maximum = Math.min(maximum, far);
    if (minimum > maximum) return null;
  }
  return minimum >= 0 && minimum <= range ? minimum : null;
}

export function rayOrientedRectDistance(origin, direction, vehicle, range) {
  const width = Number(vehicle?.archetype?.width) || Number(vehicle?.width) || 0;
  const height = Number(vehicle?.archetype?.height) || Number(vehicle?.height) || 0;
  if (!width || !height) return null;
  const angle = Number(vehicle.angle) || 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dx = (Number(origin.x) || 0) - (Number(vehicle.x) || 0);
  const dy = (Number(origin.y) || 0) - (Number(vehicle.y) || 0);
  const aim = normalized(direction);
  return rayAabbDistance(
    { x: dx * cosine + dy * sine, y: -dx * sine + dy * cosine },
    { x: aim.x * cosine + aim.y * sine, y: -aim.x * sine + aim.y * cosine },
    width / 2,
    height / 2,
    range
  );
}

export function findVehicleHitscanImpact({ origin, direction, range, layer, vehicles = [], currentVehicleId = null }) {
  const aim = normalized(direction);
  let best = null;
  for (const vehicle of vehicles) {
    if (!vehicle || vehicle.id === currentVehicleId || vehicle.layer !== layer) continue;
    const distance = rayOrientedRectDistance(origin, aim, vehicle, range);
    if (distance == null || distance < 7 || (best && best.distance <= distance)) continue;
    best = {
      kind: "vehicle",
      distance,
      x: origin.x + aim.x * distance,
      y: origin.y + aim.y * distance,
      vehicle
    };
  }
  return best;
}

export function findStaticHitscanImpact({
  origin,
  direction,
  range,
  layer,
  step = 3,
  pointClear = staticWorldPointClear
}) {
  const aim = normalized(direction);
  const maximum = Math.max(0, Number(range) || 0);
  const increment = Math.max(1, Number(step) || 3);
  let previous = 0;
  for (let distance = increment; distance <= maximum + EPSILON; distance += increment) {
    const checked = Math.min(maximum, distance);
    const x = origin.x + aim.x * checked;
    const y = origin.y + aim.y * checked;
    if (pointClear(layer, x, y)) {
      previous = checked;
      if (checked >= maximum) break;
      continue;
    }

    let low = previous;
    let high = checked;
    for (let iteration = 0; iteration < 8; iteration++) {
      const middle = (low + high) / 2;
      const mx = origin.x + aim.x * middle;
      const my = origin.y + aim.y * middle;
      if (pointClear(layer, mx, my)) low = middle;
      else high = middle;
    }
    return {
      kind: "world",
      distance: high,
      x: origin.x + aim.x * high,
      y: origin.y + aim.y * high
    };
  }
  return null;
}

export function resolveHitscanWorldImpact(options) {
  const staticImpact = findStaticHitscanImpact(options);
  const vehicleImpact = findVehicleHitscanImpact(options);
  if (!staticImpact) return vehicleImpact;
  if (!vehicleImpact) return staticImpact;
  return vehicleImpact.distance <= staticImpact.distance ? vehicleImpact : staticImpact;
}
