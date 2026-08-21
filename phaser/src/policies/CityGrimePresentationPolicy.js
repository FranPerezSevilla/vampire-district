import { buildings, crosswalks, LAYERS, roads } from "../data/district.js";
import {
  resolveBuildingPresentationDefinition,
  resolveBuildingVisualProfile
} from "../rendering/BuildingPresentation.js";

export const CITY_GRIME_FAMILIES = Object.freeze({
  SERVICE_FRONTAGE: "service-frontage-grime"
});

export const SERVICE_FRONTAGE_GRIME_PRESENTATION = Object.freeze({
  family: CITY_GRIME_FAMILIES.SERVICE_FRONTAGE,
  color: 0x101116,
  cullMargin: 56,
  maximumDescriptors: 12,
  maximumFragmentsPerDescriptor: 3,
  minimumDescriptorSpacing: 54,
  maximumOutwardDistance: 30,
  profileChance: Object.freeze({
    industrial: 78,
    warehouse: 62,
    commercial: 22
  })
});

const CARDINAL_EDGES = Object.freeze(["north", "east", "south", "west"]);

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

function right(rect) {
  return finite(rect?.x) + Math.max(0, finite(rect?.w));
}

function bottom(rect) {
  return finite(rect?.y) + Math.max(0, finite(rect?.h));
}

function rectIntersectsBounds(rect, bounds, margin = 0) {
  if (!bounds) return true;
  return finite(rect?.x) <= right(bounds) + margin
    && right(rect) >= finite(bounds.x) - margin
    && finite(rect?.y) <= bottom(bounds) + margin
    && bottom(rect) >= finite(bounds.y) - margin;
}

export function pointInsideSurface(point, surface) {
  if (!point || !surface) return false;
  const x = finite(point.x);
  const y = finite(point.y);
  if (surface.geometry !== "polygon" || !Array.isArray(surface.points) || surface.points.length < 3) {
    return x >= finite(surface.x)
      && x <= right(surface)
      && y >= finite(surface.y)
      && y <= bottom(surface);
  }

  let inside = false;
  const points = surface.points;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const xi = finite(points[index].x);
    const yi = finite(points[index].y);
    const xj = finite(points[previous].x);
    const yj = finite(points[previous].y);
    const intersects = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / Math.max(1e-9, yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInsideAny(point, surfaces) {
  return (Array.isArray(surfaces) ? surfaces : []).some(surface => pointInsideSurface(point, surface));
}

function pointInsideBuilding(point, building, margin = 1.5) {
  return finite(point.x) >= finite(building.x) - margin
    && finite(point.x) <= right(building) + margin
    && finite(point.y) >= finite(building.y) - margin
    && finite(point.y) <= bottom(building) + margin;
}

function resolvedPresentation(building) {
  const definition = resolveBuildingPresentationDefinition(building);
  const visualProfile = resolveBuildingVisualProfile(building, definition.archetypeId, {
    profileId: definition.profileId
  });
  return { definition, visualProfile };
}

function fallbackServiceEdge(building, seed) {
  const w = Math.max(1, finite(building?.w));
  const h = Math.max(1, finite(building?.h));
  if (w > h * 1.2) return (seed & 1) === 0 ? "north" : "south";
  if (h > w * 1.2) return (seed & 1) === 0 ? "east" : "west";
  return CARDINAL_EDGES[seed % CARDINAL_EDGES.length];
}

function edgeAxes(edge) {
  if (edge === "north") return { tangentX: 1, tangentY: 0, normalX: 0, normalY: -1 };
  if (edge === "east") return { tangentX: 0, tangentY: 1, normalX: 1, normalY: 0 };
  if (edge === "west") return { tangentX: 0, tangentY: 1, normalX: -1, normalY: 0 };
  return { tangentX: 1, tangentY: 0, normalX: 0, normalY: 1 };
}

function edgePoint(building, edge, along) {
  const x = finite(building.x);
  const y = finite(building.y);
  const w = Math.max(1, finite(building.w));
  const h = Math.max(1, finite(building.h));
  if (edge === "north") return { x: x + w * along, y };
  if (edge === "east") return { x: x + w, y: y + h * along };
  if (edge === "west") return { x, y: y + h * along };
  return { x: x + w * along, y: y + h };
}

function legalReceivingPoint(point, building, sourceRoads, sourceCrosswalks) {
  return !pointInsideBuilding(point, building)
    && !pointInsideAny(point, sourceRoads)
    && !pointInsideAny(point, sourceCrosswalks);
}

function findGrimeAnchor(building, edge, seed, sourceRoads, sourceCrosswalks) {
  const axes = edgeAxes(edge);
  const longAxis = edge === "north" || edge === "south"
    ? Math.max(1, finite(building.w))
    : Math.max(1, finite(building.h));
  const baseAlong = 0.24 + (seed % 53) / 100;
  const outwardCandidates = [10, 14, 18, 23, 29];
  const alongOffsets = [0, -0.08, 0.08, -0.16, 0.16];

  for (const outward of outwardCandidates) {
    for (const alongOffset of alongOffsets) {
      const along = clamp(baseAlong + alongOffset, 0.16, 0.84);
      const source = edgePoint(building, edge, along);
      const point = {
        x: source.x + axes.normalX * outward,
        y: source.y + axes.normalY * outward
      };
      if (!legalReceivingPoint(point, building, sourceRoads, sourceCrosswalks)) continue;
      return {
        ...point,
        sourceX: source.x,
        sourceY: source.y,
        outward,
        longAxis,
        ...axes
      };
    }
  }
  return null;
}

function irregularFragment(centerX, centerY, tangentX, tangentY, length, width, seed, alpha) {
  const normalX = -tangentY;
  const normalY = tangentX;
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const jitterA = ((seed >>> 3) % 5 - 2) * 0.22;
  const jitterB = ((seed >>> 8) % 5 - 2) * 0.18;
  const point = (along, across) => Object.freeze({
    x: centerX + tangentX * along + normalX * across,
    y: centerY + tangentY * along + normalY * across
  });
  return Object.freeze({
    x: centerX,
    y: centerY,
    alpha,
    points: Object.freeze([
      point(-halfLength, -halfWidth * (0.58 + jitterA)),
      point(-halfLength * 0.18, -halfWidth * (0.96 + jitterB)),
      point(halfLength, -halfWidth * 0.52),
      point(halfLength * 0.82, halfWidth * (0.72 + jitterA)),
      point(-halfLength * 0.10, halfWidth),
      point(-halfLength * 0.88, halfWidth * (0.48 + jitterB))
    ])
  });
}

function buildFragments(anchor, building, seed, sourceRoads, sourceCrosswalks, maximumFragments) {
  const fragments = [];
  const fragmentCount = Math.min(maximumFragments, 2 + ((seed >>> 11) & 1));
  for (let index = 0; index < fragmentCount; index++) {
    const localSeed = hashString(`${seed}:fragment:${index}`);
    const tangentOffset = (((localSeed >>> 6) % 17) - 8) * 0.72;
    const outwardOffset = 1.5 + ((localSeed >>> 12) % 7) * 0.55;
    const center = {
      x: anchor.x + anchor.tangentX * tangentOffset + anchor.normalX * outwardOffset,
      y: anchor.y + anchor.tangentY * tangentOffset + anchor.normalY * outwardOffset
    };
    if (!legalReceivingPoint(center, building, sourceRoads, sourceCrosswalks)) continue;
    const length = 6.5 + (localSeed % 8);
    const width = 2.8 + ((localSeed >>> 16) % 5) * 0.75;
    const alpha = 0.075 + ((localSeed >>> 22) % 7) / 100;
    fragments.push(irregularFragment(
      center.x,
      center.y,
      anchor.tangentX,
      anchor.tangentY,
      length,
      width,
      localSeed,
      alpha
    ));
  }
  return Object.freeze(fragments);
}

export function buildServiceFrontageGrimeDescriptors(sourceBuildings, bounds = null, {
  sourceRoads = roads,
  sourceCrosswalks = crosswalks,
  presentation = SERVICE_FRONTAGE_GRIME_PRESENTATION
} = {}) {
  const descriptors = [];
  const selectedAnchors = [];
  const chanceByProfile = presentation.profileChance || {};
  const maximumDescriptors = Math.max(0, Math.floor(finite(presentation.maximumDescriptors, 12)));
  const maximumFragments = Math.max(1, Math.floor(finite(presentation.maximumFragmentsPerDescriptor, 3)));
  const minimumSpacing = Math.max(0, finite(presentation.minimumDescriptorSpacing, 54));
  const cullMargin = Math.max(0, finite(presentation.cullMargin, 56));

  const sortedBuildings = (Array.isArray(sourceBuildings) ? [...sourceBuildings] : [])
    .filter(Boolean)
    .sort((left, rightValue) => String(left.id || "").localeCompare(String(rightValue.id || "")));

  for (const [index, building] of sortedBuildings.entries()) {
    if (descriptors.length >= maximumDescriptors) break;
    if (!rectIntersectsBounds(building, bounds, cullMargin)) continue;

    const buildingId = String(building.id || `building:${index}`);
    const { definition, visualProfile } = resolvedPresentation(building);
    const chance = Math.max(0, finite(chanceByProfile[visualProfile.id]));
    if (!chance) continue;

    const seed = hashString(`${buildingId}:${presentation.family}`);
    if (seed % 100 >= chance) continue;

    const authoredEdge = CARDINAL_EDGES.includes(definition.frontageEdge) && definition.frontage !== "none"
      ? definition.frontageEdge
      : null;
    const serviceEdge = visualProfile.serviceStrip ? fallbackServiceEdge(building, seed) : null;
    const edge = serviceEdge || authoredEdge;
    if (!edge) continue;

    const anchor = findGrimeAnchor(building, edge, seed, sourceRoads, sourceCrosswalks);
    if (!anchor || anchor.outward > presentation.maximumOutwardDistance) continue;
    if (selectedAnchors.some(point => Math.hypot(point.x - anchor.x, point.y - anchor.y) < minimumSpacing)) continue;

    const fragments = buildFragments(anchor, building, seed, sourceRoads, sourceCrosswalks, maximumFragments);
    if (!fragments.length) continue;

    descriptors.push(Object.freeze({
      sourceId: `building:${buildingId}:service-frontage-grime`,
      buildingId,
      family: presentation.family,
      profileId: visualProfile.id,
      serviceStrip: visualProfile.serviceStrip || null,
      sourceKind: visualProfile.serviceStrip ? "service-strip" : "frontage",
      edge,
      sourceX: anchor.sourceX,
      sourceY: anchor.sourceY,
      x: anchor.x,
      y: anchor.y,
      color: presentation.color,
      fragments
    }));
    selectedAnchors.push({ x: anchor.x, y: anchor.y });
  }

  return Object.freeze(descriptors);
}

export function drawServiceFrontageGrimeDescriptors(graphics, descriptors) {
  if (!graphics) return;
  for (const descriptor of descriptors || []) {
    for (const fragment of descriptor.fragments || []) {
      graphics.fillStyle(descriptor.color, fragment.alpha);
      graphics.fillPoints(fragment.points, true);
    }
  }
}

export function installCityGrimePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityGrimePresentationPolicy) return;
  prototype.__viceCityGrimePresentationPolicy = true;

  const basePracticalLights = prototype.drawCityPracticalLights;
  if (typeof basePracticalLights !== "function") {
    throw new Error("CityGrimePresentationPolicy requires the practical/wet presentation stack to be installed first.");
  }

  prototype.drawCityServiceFrontageGrime = function viceBloodDrawCityServiceFrontageGrime(renderBounds) {
    if (this.currentLayer !== LAYERS.STREET || !this.map) {
      this.cityServiceFrontageGrimeDescriptors = Object.freeze([]);
      return this.cityServiceFrontageGrimeDescriptors;
    }
    const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
    if (!bounds) return Object.freeze([]);
    const descriptors = buildServiceFrontageGrimeDescriptors(buildings, bounds);
    drawServiceFrontageGrimeDescriptors(this.map, descriptors);
    this.cityServiceFrontageGrimeDescriptors = descriptors;
    return descriptors;
  };

  // Install after M4. The crosswalk seam calls the current drawCityPracticalLights
  // dynamically, so this outer wrapper draws grime first, then M4 wet response,
  // then M3 practical-light sources. It does not alter any city/gameplay geometry.
  prototype.drawCityPracticalLights = function viceBloodDrawPracticalLightsWithServiceGrime(renderBounds) {
    this.drawCityServiceFrontageGrime(renderBounds);
    return basePracticalLights.call(this, renderBounds);
  };
}
