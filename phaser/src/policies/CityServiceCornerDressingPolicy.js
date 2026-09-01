import { buildings, crosswalks, LAYERS, roads } from "../data/district.js";
import {
  buildServiceFrontageGrimeDescriptors,
  pointInsideSurface
} from "./CityGrimePresentationPolicy.js";

export const CITY_SERVICE_CORNER_FAMILIES = Object.freeze({
  LITTER: "service-corner-litter"
});

export const SERVICE_CORNER_DRESSING_PRESENTATION = Object.freeze({
  family: CITY_SERVICE_CORNER_FAMILIES.LITTER,
  color: 0x4c4740,
  secondaryColor: 0x2d2b2c,
  cullMargin: 56,
  maximumDescriptors: 6,
  maximumFragmentsPerDescriptor: 3,
  minimumDescriptorSpacing: 86,
  maximumOutwardDistance: 34,
  profileChance: Object.freeze({
    industrial: 100,
    warehouse: 88
  })
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

function pointInsideAny(point, surfaces) {
  return (Array.isArray(surfaces) ? surfaces : []).some(surface => pointInsideSurface(point, surface));
}

function pointInsideBuilding(point, building, margin = 1.5) {
  return finite(point.x) >= finite(building.x) - margin
    && finite(point.x) <= right(building) + margin
    && finite(point.y) >= finite(building.y) - margin
    && finite(point.y) <= bottom(building) + margin;
}

function legalPoint(point, building, sourceRoads, sourceCrosswalks) {
  return !pointInsideBuilding(point, building)
    && !pointInsideAny(point, sourceRoads)
    && !pointInsideAny(point, sourceCrosswalks);
}

function cornerCandidates(building, edge, seed) {
  const x = finite(building.x);
  const y = finite(building.y);
  const w = Math.max(1, finite(building.w));
  const h = Math.max(1, finite(building.h));
  const flip = (seed & 1) === 1;
  const offsets = [14, 20, 27, 34];
  const candidates = [];

  for (const outward of offsets) {
    if (edge === "north" || edge === "south") {
      const yValue = edge === "north" ? y - outward : y + h + outward;
      const firstX = x + (flip ? w - 18 : 18);
      const secondX = x + (flip ? 18 : w - 18);
      candidates.push(
        { x: firstX, y: yValue, outward, corner: flip ? "ne" : "nw" },
        { x: secondX, y: yValue, outward, corner: flip ? "nw" : "ne" }
      );
    } else {
      const xValue = edge === "west" ? x - outward : x + w + outward;
      const firstY = y + (flip ? h - 18 : 18);
      const secondY = y + (flip ? 18 : h - 18);
      candidates.push(
        { x: xValue, y: firstY, outward, corner: flip ? "sw" : "nw" },
        { x: xValue, y: secondY, outward, corner: flip ? "nw" : "sw" }
      );
    }
  }
  return candidates;
}

function buildPaperFragment(anchor, seed, index, presentation) {
  const localSeed = hashString(`${seed}:paper:${index}`);
  const angle = ((localSeed >>> 5) % 628) / 100;
  const radius = 4 + ((localSeed >>> 12) % 11);
  const centerX = anchor.x + Math.cos(angle) * radius;
  const centerY = anchor.y + Math.sin(angle) * radius;
  const width = 3.2 + (localSeed % 4) * 0.75;
  const height = 2.6 + ((localSeed >>> 17) % 4) * 0.65;
  const tilt = (((localSeed >>> 22) % 7) - 3) * 0.35;
  const halfW = width / 2;
  const halfH = height / 2;
  const color = index % 3 === 2 ? presentation.secondaryColor : presentation.color;
  const alpha = 0.24 + ((localSeed >>> 26) % 9) / 100;
  return Object.freeze({
    x: centerX,
    y: centerY,
    color,
    alpha,
    points: Object.freeze([
      Object.freeze({ x: centerX - halfW, y: centerY - halfH + tilt }),
      Object.freeze({ x: centerX + halfW * 0.86, y: centerY - halfH }),
      Object.freeze({ x: centerX + halfW, y: centerY + halfH * 0.62 }),
      Object.freeze({ x: centerX - halfW * 0.72, y: centerY + halfH })
    ])
  });
}

export function buildServiceCornerDressingDescriptors(sourceBuildings, sourceGrimeDescriptors = null, bounds = null, {
  sourceRoads = roads,
  sourceCrosswalks = crosswalks,
  presentation = SERVICE_CORNER_DRESSING_PRESENTATION
} = {}) {
  const buildingMap = new Map((Array.isArray(sourceBuildings) ? sourceBuildings : [])
    .filter(Boolean)
    .map((building, index) => [String(building.id || `building:${index}`), building]));
  const grimeDescriptors = Array.isArray(sourceGrimeDescriptors)
    ? sourceGrimeDescriptors
    : buildServiceFrontageGrimeDescriptors(sourceBuildings, bounds, { sourceRoads, sourceCrosswalks });
  const selected = [];
  const descriptors = [];
  const maximumDescriptors = Math.max(0, Math.floor(finite(presentation.maximumDescriptors, 6)));
  const maximumFragments = Math.max(1, Math.floor(finite(presentation.maximumFragmentsPerDescriptor, 3)));
  const minimumSpacing = Math.max(0, finite(presentation.minimumDescriptorSpacing, 86));
  const cullMargin = Math.max(0, finite(presentation.cullMargin, 56));
  const chanceByProfile = presentation.profileChance || {};

  const sortedGrime = [...grimeDescriptors]
    .filter(Boolean)
    .sort((left, rightValue) => String(left.sourceId || "").localeCompare(String(rightValue.sourceId || "")));

  for (const grime of sortedGrime) {
    if (descriptors.length >= maximumDescriptors) break;
    if (grime.sourceKind !== "service-strip") continue;
    const chance = Math.max(0, finite(chanceByProfile[grime.profileId]));
    if (!chance) continue;
    const building = buildingMap.get(String(grime.buildingId || ""));
    if (!building || !rectIntersectsBounds(building, bounds, cullMargin)) continue;

    const seed = hashString(`${grime.sourceId}:${presentation.family}`);
    if (seed % 100 >= chance) continue;
    const anchor = cornerCandidates(building, grime.edge, seed)
      .find(candidate => (
        candidate.outward <= presentation.maximumOutwardDistance
          && legalPoint(candidate, building, sourceRoads, sourceCrosswalks)
          && !selected.some(point => Math.hypot(point.x - candidate.x, point.y - candidate.y) < minimumSpacing)
      ));
    if (!anchor) continue;

    const fragments = [];
    const desiredFragments = Math.min(maximumFragments, 2 + ((seed >>> 9) & 1));
    for (let index = 0; index < desiredFragments; index++) {
      const fragment = buildPaperFragment(anchor, seed, index, presentation);
      if (!legalPoint(fragment, building, sourceRoads, sourceCrosswalks)) continue;
      fragments.push(fragment);
    }
    if (!fragments.length) continue;

    descriptors.push(Object.freeze({
      sourceId: `building:${grime.buildingId}:service-corner-litter`,
      buildingId: String(grime.buildingId),
      family: presentation.family,
      profileId: grime.profileId,
      sourceKind: "service-corner",
      edge: grime.edge,
      corner: anchor.corner,
      x: anchor.x,
      y: anchor.y,
      fragments: Object.freeze(fragments)
    }));
    selected.push({ x: anchor.x, y: anchor.y });
  }

  return Object.freeze(descriptors);
}

export function drawServiceCornerDressingDescriptors(graphics, descriptors) {
  if (!graphics) return;
  for (const descriptor of descriptors || []) {
    for (const fragment of descriptor.fragments || []) {
      graphics.fillStyle(fragment.color, fragment.alpha);
      graphics.fillPoints(fragment.points, true);
    }
  }
}

export function installCityServiceCornerDressingPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityServiceCornerDressingPolicy) return;
  prototype.__viceCityServiceCornerDressingPolicy = true;

  const baseGrime = prototype.drawCityServiceFrontageGrime;
  if (typeof baseGrime !== "function") {
    throw new Error("CityServiceCornerDressingPolicy requires CityGrimePresentationPolicy.");
  }

  prototype.drawCityServiceFrontageGrime = function viceBloodDrawServiceGrimeWithCornerDressing(renderBounds) {
    const grime = baseGrime.call(this, renderBounds);
    if (this.currentLayer !== LAYERS.STREET || !this.map) {
      this.cityServiceCornerDressingDescriptors = Object.freeze([]);
      return grime;
    }
    const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
    const descriptors = buildServiceCornerDressingDescriptors(
      buildings,
      this.cityServiceFrontageGrimeDescriptors || grime,
      bounds
    );
    drawServiceCornerDressingDescriptors(this.map, descriptors);
    this.cityServiceCornerDressingDescriptors = descriptors;
    return grime;
  };
}
