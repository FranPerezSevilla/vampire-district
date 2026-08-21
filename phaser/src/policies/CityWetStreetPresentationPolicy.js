import { buildings, LAYERS, lights, roads } from "../data/district.js";
import {
  PRACTICAL_LIGHT_FAMILIES,
  PRACTICAL_LIGHT_PRESENTATIONS,
  buildContextualBuildingLightDescriptors,
  buildWarmStreetLightDescriptors
} from "./CityPracticalLightPresentationPolicy.js";
import {
  VEHICLE_LIGHT_FAMILIES
} from "./CityVehicleLightPresentationPolicy.js";

export const WET_REFLECTION_FAMILIES = Object.freeze({
  ...PRACTICAL_LIGHT_FAMILIES,
  ...VEHICLE_LIGHT_FAMILIES
});

const REFLECTION_STYLE_BY_FAMILY = Object.freeze({
  [PRACTICAL_LIGHT_FAMILIES.WARM_STREET]: Object.freeze({ color: 0xe8ad5d, alpha: 0.052, length: 30, width: 7, fragments: 5, maxDistance: 74 }),
  [PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE]: Object.freeze({ color: 0xd28e4d, alpha: 0.040, length: 24, width: 7, fragments: 4, maxDistance: 86 }),
  [PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC]: Object.freeze({ color: 0x8199b6, alpha: 0.043, length: 26, width: 7, fragments: 4, maxDistance: 88 }),
  [PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT]: Object.freeze({ color: 0xa63b63, alpha: 0.060, length: 25, width: 7, fragments: 5, maxDistance: 90 }),
  [PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY]: Object.freeze({ color: 0x928850, alpha: 0.034, length: 21, width: 6, fragments: 3, maxDistance: 76 }),
  [VEHICLE_LIGHT_FAMILIES.HEADLIGHT]: Object.freeze({ color: 0xf2d6a4, alpha: 0.050, length: 34, width: 6, fragments: 4, maxDistance: 52, dynamic: true }),
  [VEHICLE_LIGHT_FAMILIES.TAIL]: Object.freeze({ color: 0xb43845, alpha: 0.054, length: 18, width: 6, fragments: 3, maxDistance: 48, dynamic: true, reverseAxis: true }),
  [VEHICLE_LIGHT_FAMILIES.POLICE_RED]: Object.freeze({ color: 0xe83c59, alpha: 0.075, length: 17, width: 8, fragments: 3, maxDistance: 46, dynamic: true }),
  [VEHICLE_LIGHT_FAMILIES.POLICE_BLUE]: Object.freeze({ color: 0x5688ee, alpha: 0.075, length: 17, width: 8, fragments: 3, maxDistance: 46, dynamic: true })
});

export const WET_REFLECTION_PRESENTATION = Object.freeze({
  receiverInset: 9,
  cullMargin: 90,
  minimumFragmentAlpha: 0.008,
  maximumFragmentAlpha: 0.085,
  styles: REFLECTION_STYLE_BY_FAMILY
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roadBounds(road) {
  if (road?.geometry === "polygon" && Array.isArray(road.points) && road.points.length >= 3) {
    const xs = road.points.map(point => finite(point.x));
    const ys = road.points.map(point => finite(point.y));
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }
  return {
    x: finite(road?.x),
    y: finite(road?.y),
    w: Math.max(0, finite(road?.w)),
    h: Math.max(0, finite(road?.h))
  };
}

function polygonCentroid(points) {
  if (!Array.isArray(points) || !points.length) return { x: 0, y: 0 };
  const total = points.reduce((acc, point) => ({ x: acc.x + finite(point.x), y: acc.y + finite(point.y) }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function receiverCentroid(road) {
  if (road?.geometry === "polygon" && Array.isArray(road.points) && road.points.length >= 3) {
    return polygonCentroid(road.points);
  }
  const bounds = roadBounds(road);
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

export function pointInsideRoadSurface(point, road) {
  if (!point || !road) return false;
  const x = finite(point.x);
  const y = finite(point.y);
  if (road.geometry !== "polygon" || !Array.isArray(road.points) || road.points.length < 3) {
    const bounds = roadBounds(road);
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }

  let inside = false;
  const points = road.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = finite(points[i].x);
    const yi = finite(points[i].y);
    const xj = finite(points[j].x);
    const yj = finite(points[j].y);
    const intersects = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / Math.max(1e-9, yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(point, a, b) {
  const ax = finite(a.x);
  const ay = finite(a.y);
  const bx = finite(b.x);
  const by = finite(b.y);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return { x: ax, y: ay };
  const t = clamp(((finite(point.x) - ax) * dx + (finite(point.y) - ay) * dy) / lengthSquared, 0, 1);
  return { x: ax + dx * t, y: ay + dy * t };
}

function closestPointOnRoad(point, road) {
  if (pointInsideRoadSurface(point, road)) return { x: finite(point.x), y: finite(point.y) };
  if (road?.geometry === "polygon" && Array.isArray(road.points) && road.points.length >= 3) {
    let best = null;
    for (let index = 0; index < road.points.length; index++) {
      const candidate = closestPointOnSegment(point, road.points[index], road.points[(index + 1) % road.points.length]);
      const distance = Math.hypot(candidate.x - finite(point.x), candidate.y - finite(point.y));
      if (!best || distance < best.distance) best = { ...candidate, distance };
    }
    return best ? { x: best.x, y: best.y } : receiverCentroid(road);
  }
  const bounds = roadBounds(road);
  return {
    x: clamp(finite(point.x), bounds.x, bounds.x + bounds.w),
    y: clamp(finite(point.y), bounds.y, bounds.y + bounds.h)
  };
}

function normalize(x, y, fallback = { x: 0, y: 1 }) {
  const length = Math.hypot(x, y);
  if (length <= 1e-6) return { x: fallback.x, y: fallback.y };
  return { x: x / length, y: y / length };
}

function moveInsideRoad(point, road, inset = WET_REFLECTION_PRESENTATION.receiverInset) {
  const center = receiverCentroid(road);
  if (pointInsideRoadSurface(point, road)) {
    const towardCenter = normalize(center.x - point.x, center.y - point.y);
    const candidate = { x: point.x + towardCenter.x * Math.min(4, inset), y: point.y + towardCenter.y * Math.min(4, inset) };
    return pointInsideRoadSurface(candidate, road) ? candidate : point;
  }
  const closest = closestPointOnRoad(point, road);
  const direction = normalize(center.x - closest.x, center.y - closest.y);
  for (const amount of [inset, inset * 0.65, inset * 0.35, 1]) {
    const candidate = { x: closest.x + direction.x * amount, y: closest.y + direction.y * amount };
    if (pointInsideRoadSurface(candidate, road)) return candidate;
  }
  return pointInsideRoadSurface(center, road) ? center : closest;
}

function boundsIntersect(a, b, margin = 0) {
  if (!a || !b) return true;
  const aw = finite(a.w, finite(a.width));
  const ah = finite(a.h, finite(a.height));
  const bw = finite(b.w, finite(b.width));
  const bh = finite(b.h, finite(b.height));
  return finite(a.x) <= finite(b.x) + bw + margin
    && finite(a.x) + aw >= finite(b.x) - margin
    && finite(a.y) <= finite(b.y) + bh + margin
    && finite(a.y) + ah >= finite(b.y) - margin;
}

export function findNearestRoadReceiver(source, sourceRoads = roads, {
  maximumDistance = 90,
  renderBounds = null,
  cullMargin = WET_REFLECTION_PRESENTATION.cullMargin
} = {}) {
  if (!source) return null;
  const point = { x: finite(source.x), y: finite(source.y) };
  const candidates = [];

  for (const road of Array.isArray(sourceRoads) ? sourceRoads : []) {
    if (!road) continue;
    const bounds = roadBounds(road);
    if (renderBounds && !boundsIntersect(bounds, renderBounds, cullMargin)) continue;
    const closest = closestPointOnRoad(point, road);
    const distance = Math.hypot(closest.x - point.x, closest.y - point.y);
    if (distance > maximumDistance) continue;
    candidates.push({
      road,
      roadId: String(road.id || "road"),
      distance,
      closest,
      receivingPoint: moveInsideRoad(point, road),
      bounds
    });
  }

  candidates.sort((left, right) => left.distance - right.distance || left.roadId.localeCompare(right.roadId));
  const winner = candidates[0];
  return winner ? Object.freeze({
    roadId: winner.roadId,
    distance: winner.distance,
    receivingPoint: Object.freeze({ ...winner.receivingPoint }),
    bounds: Object.freeze({ ...winner.bounds }),
    road: winner.road
  }) : null;
}

function reflectionAxis(source, receiver, style) {
  if (style.dynamic && Number.isFinite(Number(source.dirX)) && Number.isFinite(Number(source.dirY))) {
    const direction = normalize(finite(source.dirX), finite(source.dirY));
    return style.reverseAxis ? { x: -direction.x, y: -direction.y } : direction;
  }
  const towardRoad = normalize(
    receiver.receivingPoint.x - finite(source.x),
    receiver.receivingPoint.y - finite(source.y),
    receiver.bounds.w >= receiver.bounds.h ? { x: 0, y: 1 } : { x: 1, y: 0 }
  );
  return towardRoad;
}

function ensureInside(point, receiver) {
  if (pointInsideRoadSurface(point, receiver.road)) return point;
  const target = receiver.receivingPoint;
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const candidate = {
      x: point.x + (target.x - point.x) * t,
      y: point.y + (target.y - point.y) * t
    };
    if (pointInsideRoadSurface(candidate, receiver.road)) return candidate;
  }
  return target;
}

function buildFragments(source, receiver, style) {
  const seed = hashString(`${source.sourceId || source.family}:${receiver.roadId}:wet`);
  const axis = reflectionAxis(source, receiver, style);
  const perpendicular = { x: -axis.y, y: axis.x };
  const intensity = clamp(finite(source.intensity, 1), 0.05, 1.5);
  const fragments = [];

  for (let index = 0; index < style.fragments; index++) {
    const localSeed = hashString(`${seed}:${index}`);
    const t = (index + 0.65) / (style.fragments + 0.35);
    const along = t * style.length * (0.78 + (localSeed % 29) / 100);
    const lateral = (((localSeed >>> 7) % 17) - 8) / 8 * style.width * 0.72;
    const centre = ensureInside({
      x: receiver.receivingPoint.x + axis.x * along + perpendicular.x * lateral,
      y: receiver.receivingPoint.y + axis.y * along + perpendicular.y * lateral
    }, receiver);
    const fragmentLength = Math.max(3, style.length / style.fragments * (0.72 + ((localSeed >>> 13) % 43) / 100));
    const fragmentWidth = Math.max(1.4, style.width * (0.36 + ((localSeed >>> 18) % 39) / 100));
    const alpha = clamp(
      style.alpha * intensity * (0.55 + ((localSeed >>> 23) % 36) / 100),
      WET_REFLECTION_PRESENTATION.minimumFragmentAlpha,
      WET_REFLECTION_PRESENTATION.maximumFragmentAlpha
    );
    fragments.push(Object.freeze({
      x: centre.x,
      y: centre.y,
      axisX: axis.x,
      axisY: axis.y,
      length: fragmentLength,
      width: fragmentWidth,
      alpha
    }));
  }
  return Object.freeze(fragments);
}

export function buildWetRoadReflectionDescriptors(sourceDescriptors, sourceRoads = roads, {
  renderBounds = null
} = {}) {
  const output = [];
  for (const source of Array.isArray(sourceDescriptors) ? sourceDescriptors : []) {
    const style = REFLECTION_STYLE_BY_FAMILY[source?.family];
    if (!style) continue;
    if (renderBounds && !boundsIntersect({ x: finite(source.x), y: finite(source.y), w: 1, h: 1 }, renderBounds, WET_REFLECTION_PRESENTATION.cullMargin)) continue;
    const receiver = findNearestRoadReceiver(source, sourceRoads, {
      maximumDistance: style.maxDistance,
      renderBounds
    });
    if (!receiver) continue;
    output.push(Object.freeze({
      sourceId: String(source.sourceId || source.family || "light"),
      sourceFamily: source.family,
      receiverRoadId: receiver.roadId,
      receiverDistance: receiver.distance,
      color: style.color,
      dynamic: Boolean(style.dynamic),
      fragments: buildFragments(source, receiver, style)
    }));
  }
  return Object.freeze(output);
}

export function buildStaticWetRoadReflectionDescriptors(renderBounds = null, {
  sourceLights = lights,
  sourceBuildings = buildings,
  sourceRoads = roads,
  brokenLightIds = null
} = {}) {
  const sources = [
    ...buildWarmStreetLightDescriptors(sourceLights, renderBounds, { brokenLightIds }),
    ...buildContextualBuildingLightDescriptors(sourceBuildings, renderBounds)
  ];
  return buildWetRoadReflectionDescriptors(sources, sourceRoads, { renderBounds });
}

function rotatedRectPoints(fragment) {
  const axis = normalize(fragment.axisX, fragment.axisY);
  const perpendicular = { x: -axis.y, y: axis.x };
  const halfLength = fragment.length / 2;
  const halfWidth = fragment.width / 2;
  return [
    { x: fragment.x - axis.x * halfLength - perpendicular.x * halfWidth, y: fragment.y - axis.y * halfLength - perpendicular.y * halfWidth },
    { x: fragment.x + axis.x * halfLength - perpendicular.x * halfWidth, y: fragment.y + axis.y * halfLength - perpendicular.y * halfWidth },
    { x: fragment.x + axis.x * halfLength + perpendicular.x * halfWidth, y: fragment.y + axis.y * halfLength + perpendicular.y * halfWidth },
    { x: fragment.x - axis.x * halfLength + perpendicular.x * halfWidth, y: fragment.y - axis.y * halfLength + perpendicular.y * halfWidth }
  ];
}

export function drawWetRoadReflectionDescriptors(graphics, descriptors) {
  if (!graphics) return;
  for (const descriptor of descriptors || []) {
    for (const fragment of descriptor.fragments || []) {
      graphics.fillStyle(descriptor.color, fragment.alpha);
      graphics.fillPoints(rotatedRectPoints(fragment), true);
      graphics.fillStyle(descriptor.color, fragment.alpha * 0.55);
      graphics.fillCircle(fragment.x, fragment.y, Math.max(0.8, fragment.width * 0.42));
    }
  }
}

export function installCityWetStreetPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityWetStreetPresentationPolicy) return;
  prototype.__viceCityWetStreetPresentationPolicy = true;

  const basePracticalLights = prototype.drawCityPracticalLights;
  const baseVehicleLights = prototype.updateVehicleLightPresentation;
  if (typeof basePracticalLights !== "function") throw new Error("CityWetStreetPresentationPolicy requires CityPracticalLightPresentationPolicy.");
  if (typeof baseVehicleLights !== "function") throw new Error("CityWetStreetPresentationPolicy requires CityVehicleLightPresentationPolicy.");

  prototype.drawCityPracticalLights = function viceBloodDrawPracticalLightsWithWetStreet(renderBounds) {
    if (this.currentLayer === LAYERS.STREET && this.map) {
      const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
      const wet = buildStaticWetRoadReflectionDescriptors(bounds, { brokenLightIds: this.brokenLights });
      this.cityWetStaticReflectionDescriptors = wet;
      drawWetRoadReflectionDescriptors(this.map, wet);
    } else {
      this.cityWetStaticReflectionDescriptors = Object.freeze([]);
    }
    return basePracticalLights.call(this, renderBounds);
  };

  prototype.updateVehicleLightPresentation = function viceBloodUpdateVehicleLightsWithWetStreet(time = 0) {
    const result = baseVehicleLights.call(this, time);
    if (!this.vehicleWetReflectionGraphics) this.vehicleWetReflectionGraphics = this.add.graphics().setDepth(45.1);
    this.vehicleWetReflectionGraphics.clear();
    if (this.currentLayer !== LAYERS.STREET) {
      this.cityWetDynamicReflectionDescriptors = Object.freeze([]);
      return result;
    }
    const view = this.cameras?.main?.worldView;
    const bounds = view ? { x: view.x, y: view.y, width: view.width, height: view.height } : null;
    const wet = buildWetRoadReflectionDescriptors(result, roads, { renderBounds: bounds });
    this.cityWetDynamicReflectionDescriptors = wet;
    drawWetRoadReflectionDescriptors(this.vehicleWetReflectionGraphics, wet);
    return result;
  };
}
