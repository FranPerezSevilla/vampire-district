import { buildings, LAYERS, lights } from "../data/district.js";
import {
  resolveBuildingPresentationDefinition,
  resolveBuildingVisualProfile
} from "../rendering/BuildingPresentation.js";

export const PRACTICAL_LIGHT_FAMILIES = Object.freeze({
  WARM_STREET: "warm-street",
  WARM_FRONTAGE: "warm-frontage",
  COOL_CIVIC: "cool-civic",
  NIGHTLIFE_ACCENT: "nightlife-accent",
  INDUSTRIAL_DIRTY: "industrial-dirty"
});

function buildSoftFalloffLayers(stepCount = 18, {
  outerAlpha = 0.006,
  innerAlpha = 0.014,
  innerRadiusScale = 0.14
} = {}) {
  return Object.freeze(Array.from({ length: stepCount }, (_, index) => {
    const t = index / Math.max(1, stepCount - 1);
    return Object.freeze({
      radiusScale: 1 - t * (1 - innerRadiusScale),
      alpha: outerAlpha + t * (innerAlpha - outerAlpha)
    });
  }));
}

function freezePresentation(definition) {
  return Object.freeze({
    ...definition,
    layers: definition.layers || buildSoftFalloffLayers()
  });
}

export const WARM_STREET_LIGHT_PRESENTATION = freezePresentation({
  family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET,
  color: 0xf2b35e,
  coreColor: 0xffedb0,
  fixtureColor: 0x332d2b,
  minimumRadius: 38,
  maximumRadius: 58,
  verticalScale: 0.82,
  cullMargin: 72,
  layers: buildSoftFalloffLayers()
});

export const WARM_FRONTAGE_LIGHT_PRESENTATION = freezePresentation({
  family: PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE,
  color: 0xe5a259,
  coreColor: 0xffd99a,
  sourceColor: 0xf4c378,
  cullMargin: 54,
  minimumSpan: 22,
  maximumSpan: 46,
  spanRatio: 0.18,
  outwardDepth: 28,
  outwardOffset: 10,
  sourceAlpha: 0.32,
  coreAlpha: 0.50,
  sourceLength: 10,
  sourceThickness: 2,
  coreRadius: 1.2,
  layers: buildSoftFalloffLayers(14, {
    outerAlpha: 0.004,
    innerAlpha: 0.011,
    innerRadiusScale: 0.18
  })
});

export const COOL_CIVIC_LIGHT_PRESENTATION = freezePresentation({
  family: PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC,
  color: 0x879bb7,
  coreColor: 0xe1ebf7,
  sourceColor: 0xb8cbe2,
  cullMargin: 62,
  minimumSpan: 24,
  maximumSpan: 52,
  spanRatio: 0.20,
  outwardDepth: 30,
  outwardOffset: 11,
  sourceAlpha: 0.30,
  coreAlpha: 0.46,
  sourceLength: 11,
  sourceThickness: 2,
  coreRadius: 1.15,
  layers: buildSoftFalloffLayers(15, {
    outerAlpha: 0.0035,
    innerAlpha: 0.010,
    innerRadiusScale: 0.17
  })
});

export const NIGHTLIFE_LIGHT_PRESENTATION = freezePresentation({
  family: PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT,
  color: 0x9d365c,
  coreColor: 0xe892ad,
  sourceColor: 0xc85a80,
  cullMargin: 60,
  minimumSpan: 20,
  maximumSpan: 44,
  spanRatio: 0.17,
  outwardDepth: 27,
  outwardOffset: 9,
  sourceAlpha: 0.38,
  coreAlpha: 0.58,
  sourceLength: 10,
  sourceThickness: 2,
  coreRadius: 1.25,
  layers: buildSoftFalloffLayers(15, {
    outerAlpha: 0.003,
    innerAlpha: 0.0105,
    innerRadiusScale: 0.16
  })
});

export const INDUSTRIAL_DIRTY_LIGHT_PRESENTATION = freezePresentation({
  family: PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY,
  color: 0x9d9258,
  coreColor: 0xd8cf92,
  sourceColor: 0xb6a766,
  cullMargin: 52,
  minimumSpan: 17,
  maximumSpan: 38,
  spanRatio: 0.14,
  outwardDepth: 23,
  outwardOffset: 8,
  sourceAlpha: 0.25,
  coreAlpha: 0.40,
  sourceLength: 8,
  sourceThickness: 2,
  coreRadius: 1.0,
  layers: buildSoftFalloffLayers(13, {
    outerAlpha: 0.0025,
    innerAlpha: 0.0085,
    innerRadiusScale: 0.20
  })
});

export const PRACTICAL_LIGHT_PRESENTATIONS = Object.freeze({
  [PRACTICAL_LIGHT_FAMILIES.WARM_STREET]: WARM_STREET_LIGHT_PRESENTATION,
  [PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE]: WARM_FRONTAGE_LIGHT_PRESENTATION,
  [PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC]: COOL_CIVIC_LIGHT_PRESENTATION,
  [PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT]: NIGHTLIFE_LIGHT_PRESENTATION,
  [PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY]: INDUSTRIAL_DIRTY_LIGHT_PRESENTATION
});

const WARM_FRONTAGE_PROFILES = Object.freeze({
  default: 22,
  residential: 30,
  commercial: 38
});

const COOL_CIVIC_PROFILES = Object.freeze({
  police: 100,
  medical: 100
});

const COOL_CIVIC_BUILDINGS = Object.freeze({
  cityHall: 100
});

const NIGHTLIFE_PROFILES = Object.freeze({
  club: 100
});

const INDUSTRIAL_PROFILES = Object.freeze({
  industrial: 62,
  warehouse: 38
});

const GENERIC_WARM_EXCLUDED_BUILDINGS = new Set(Object.keys(COOL_CIVIC_BUILDINGS));
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

function pointInsideExpandedBounds(point, bounds, margin) {
  if (!bounds) return true;
  const x = finite(point?.x);
  const y = finite(point?.y);
  return x >= finite(bounds.x) - margin
    && x <= finite(bounds.x) + finite(bounds.w) + margin
    && y >= finite(bounds.y) - margin
    && y <= finite(bounds.y) + finite(bounds.h) + margin;
}

function rectInsideExpandedBounds(rect, bounds, margin) {
  if (!bounds) return true;
  const left = finite(rect?.x);
  const top = finite(rect?.y);
  const right = left + Math.max(0, finite(rect?.w));
  const bottom = top + Math.max(0, finite(rect?.h));
  return left <= finite(bounds.x) + finite(bounds.w) + margin
    && right >= finite(bounds.x) - margin
    && top <= finite(bounds.y) + finite(bounds.h) + margin
    && bottom >= finite(bounds.y) - margin;
}

function normalizedBrokenIds(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set();
}

export function buildWarmStreetLightDescriptors(sourceLights, bounds = null, {
  brokenLightIds = null,
  family = WARM_STREET_LIGHT_PRESENTATION.family,
  minimumRadius = WARM_STREET_LIGHT_PRESENTATION.minimumRadius,
  maximumRadius = WARM_STREET_LIGHT_PRESENTATION.maximumRadius,
  verticalScale = WARM_STREET_LIGHT_PRESENTATION.verticalScale,
  cullMargin = WARM_STREET_LIGHT_PRESENTATION.cullMargin
} = {}) {
  const broken = normalizedBrokenIds(brokenLightIds);
  const minRadius = Math.max(8, finite(minimumRadius, WARM_STREET_LIGHT_PRESENTATION.minimumRadius));
  const maxRadius = Math.max(minRadius, finite(maximumRadius, WARM_STREET_LIGHT_PRESENTATION.maximumRadius));
  const safeVerticalScale = clamp(verticalScale, 0.5, 1);
  const safeMargin = Math.max(0, finite(cullMargin, WARM_STREET_LIGHT_PRESENTATION.cullMargin));

  return (Array.isArray(sourceLights) ? sourceLights : [])
    .filter(source => source && !broken.has(String(source.id || "")))
    .filter(source => pointInsideExpandedBounds(source, bounds, safeMargin))
    .map((source, index) => {
      const sourceId = String(source.id || `light:${index}`);
      const sourceRadius = Math.max(minRadius, finite(source.radius, maxRadius));
      const radius = clamp(sourceRadius * 0.88, minRadius, maxRadius);
      const seed = hashString(sourceId);
      const horizontalScale = 0.96 + (seed % 9) / 100;
      const localVerticalScale = safeVerticalScale * (0.96 + ((seed >>> 8) % 7) / 100);
      const offsetX = ((seed >>> 16) % 5) - 2;
      const offsetY = ((seed >>> 20) % 5) - 2;
      return Object.freeze({
        sourceId,
        family,
        x: finite(source.x),
        y: finite(source.y),
        radius,
        width: radius * 2 * horizontalScale,
        height: radius * 2 * localVerticalScale,
        offsetX,
        offsetY,
        intensity: 1,
        sourceRadius,
        sourceLayer: finite(source.layer, LAYERS.STREET)
      });
    });
}

function resolvedPresentation(building) {
  const definition = resolveBuildingPresentationDefinition(building);
  const visualProfile = resolveBuildingVisualProfile(building, definition.archetypeId, {
    profileId: definition.profileId
  });
  return { definition, visualProfile };
}

function allowedChance(buildingId, profileId, profileChances, explicitBuildingChances) {
  if (explicitBuildingChances && Object.prototype.hasOwnProperty.call(explicitBuildingChances, buildingId)) {
    return Math.max(0, finite(explicitBuildingChances[buildingId]));
  }
  return Math.max(0, finite(profileChances?.[profileId]));
}

function fallbackServiceEdge(building, seed) {
  const w = Math.max(1, finite(building?.w));
  const h = Math.max(1, finite(building?.h));
  if (w > h * 1.20) return (seed & 1) === 0 ? "north" : "south";
  if (h > w * 1.20) return (seed & 1) === 0 ? "east" : "west";
  return CARDINAL_EDGES[seed % CARDINAL_EDGES.length];
}

function frontageGeometry(building, definition, visualProfile, seed, style, {
  allowServiceStrip = false
} = {}) {
  const authoredEdge = CARDINAL_EDGES.includes(definition.frontageEdge)
    ? definition.frontageEdge
    : null;
  const serviceAllowed = allowServiceStrip && Boolean(visualProfile.serviceStrip);
  const edge = authoredEdge || (serviceAllowed ? fallbackServiceEdge(building, seed) : "south");
  const x = finite(building.x);
  const y = finite(building.y);
  const w = Math.max(1, finite(building.w));
  const h = Math.max(1, finite(building.h));
  const along = 0.30 + (seed % 41) / 100;
  const outward = style.outwardOffset * (0.90 + ((seed >>> 8) % 21) / 100);
  const horizontal = edge === "north" || edge === "south";
  const longAxis = horizontal ? w : h;
  const span = clamp(longAxis * style.spanRatio, style.minimumSpan, style.maximumSpan);
  const depth = style.outwardDepth * (0.92 + ((seed >>> 13) % 13) / 100);

  if (edge === "north") {
    const sourceX = x + w * along;
    const sourceY = y + 1;
    return { edge, sourceX, sourceY, x: sourceX, y: y - outward, width: span, height: depth };
  }
  if (edge === "east") {
    const sourceX = x + w - 1;
    const sourceY = y + h * along;
    return { edge, sourceX, sourceY, x: x + w + outward, y: sourceY, width: depth, height: span };
  }
  if (edge === "west") {
    const sourceX = x + 1;
    const sourceY = y + h * along;
    return { edge, sourceX, sourceY, x: x - outward, y: sourceY, width: depth, height: span };
  }
  const sourceX = x + w * along;
  const sourceY = y + h - 1;
  return { edge: "south", sourceX, sourceY, x: sourceX, y: y + h + outward, width: span, height: depth };
}

function buildBuildingLightDescriptors(sourceBuildings, bounds, {
  family,
  style,
  profileChances,
  explicitBuildingChances = null,
  excludeBuildingIds = null,
  allowServiceStrip = false,
  requireServiceStrip = false,
  seedLabel = family,
  sourceSuffix = `${family}-light`
}) {
  const safeMargin = Math.max(0, finite(style.cullMargin));
  const excluded = excludeBuildingIds instanceof Set ? excludeBuildingIds : new Set(excludeBuildingIds || []);
  const descriptors = [];

  for (const [index, building] of (Array.isArray(sourceBuildings) ? sourceBuildings : []).entries()) {
    if (!building || !rectInsideExpandedBounds(building, bounds, safeMargin)) continue;
    const buildingId = String(building.id || `building:${index}`);
    if (excluded.has(buildingId)) continue;

    const { definition, visualProfile } = resolvedPresentation(building);
    const chance = allowedChance(buildingId, visualProfile.id, profileChances, explicitBuildingChances);
    if (!chance) continue;

    const hasAuthoredFrontage = definition.frontage !== "none";
    const hasServiceStrip = Boolean(visualProfile.serviceStrip);
    if (requireServiceStrip && !hasServiceStrip) continue;
    if (!hasAuthoredFrontage && !(allowServiceStrip && hasServiceStrip)) continue;

    const seed = hashString(`${buildingId}:${seedLabel}`);
    if (seed % 100 >= chance) continue;
    const geometry = frontageGeometry(building, definition, visualProfile, seed, style, { allowServiceStrip });
    descriptors.push(Object.freeze({
      sourceId: `building:${buildingId}:${sourceSuffix}`,
      buildingId,
      family,
      profileId: visualProfile.id,
      frontage: definition.frontage,
      sourceKind: hasAuthoredFrontage ? "frontage" : "service-strip",
      serviceStrip: visualProfile.serviceStrip || null,
      edge: geometry.edge,
      sourceX: geometry.sourceX,
      sourceY: geometry.sourceY,
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      intensity: 1
    }));
  }

  return descriptors;
}

export function buildWarmFrontageLightDescriptors(sourceBuildings, bounds = null, {
  family = WARM_FRONTAGE_LIGHT_PRESENTATION.family,
  cullMargin = WARM_FRONTAGE_LIGHT_PRESENTATION.cullMargin
} = {}) {
  const style = cullMargin === WARM_FRONTAGE_LIGHT_PRESENTATION.cullMargin
    ? WARM_FRONTAGE_LIGHT_PRESENTATION
    : { ...WARM_FRONTAGE_LIGHT_PRESENTATION, cullMargin };
  return buildBuildingLightDescriptors(sourceBuildings, bounds, {
    family,
    style,
    profileChances: WARM_FRONTAGE_PROFILES,
    excludeBuildingIds: GENERIC_WARM_EXCLUDED_BUILDINGS,
    seedLabel: "warm-frontage",
    sourceSuffix: "frontage-light"
  });
}

export function buildCoolCivicLightDescriptors(sourceBuildings, bounds = null) {
  return buildBuildingLightDescriptors(sourceBuildings, bounds, {
    family: PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC,
    style: COOL_CIVIC_LIGHT_PRESENTATION,
    profileChances: COOL_CIVIC_PROFILES,
    explicitBuildingChances: COOL_CIVIC_BUILDINGS,
    seedLabel: "cool-civic",
    sourceSuffix: "cool-civic-light"
  });
}

export function buildNightlifeLightDescriptors(sourceBuildings, bounds = null) {
  return buildBuildingLightDescriptors(sourceBuildings, bounds, {
    family: PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT,
    style: NIGHTLIFE_LIGHT_PRESENTATION,
    profileChances: NIGHTLIFE_PROFILES,
    seedLabel: "nightlife-accent",
    sourceSuffix: "nightlife-light"
  });
}

export function buildIndustrialDirtyLightDescriptors(sourceBuildings, bounds = null) {
  return buildBuildingLightDescriptors(sourceBuildings, bounds, {
    family: PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY,
    style: INDUSTRIAL_DIRTY_LIGHT_PRESENTATION,
    profileChances: INDUSTRIAL_PROFILES,
    allowServiceStrip: true,
    requireServiceStrip: true,
    seedLabel: "industrial-dirty",
    sourceSuffix: "industrial-light"
  });
}

export function buildContextualBuildingLightDescriptors(sourceBuildings, bounds = null) {
  return Object.freeze([
    ...buildWarmFrontageLightDescriptors(sourceBuildings, bounds),
    ...buildCoolCivicLightDescriptors(sourceBuildings, bounds),
    ...buildNightlifeLightDescriptors(sourceBuildings, bounds),
    ...buildIndustrialDirtyLightDescriptors(sourceBuildings, bounds)
  ]);
}

function drawSoftEllipsePool(graphics, descriptor, style) {
  for (const layer of style.layers) {
    graphics.fillStyle(style.color, layer.alpha * descriptor.intensity);
    graphics.fillEllipse(
      descriptor.x,
      descriptor.y,
      descriptor.width * layer.radiusScale,
      descriptor.height * layer.radiusScale
    );
  }
}

function drawSoftWarmStreetPool(graphics, descriptor) {
  const style = WARM_STREET_LIGHT_PRESENTATION;
  drawSoftEllipsePool(graphics, {
    ...descriptor,
    x: descriptor.x + descriptor.offsetX,
    y: descriptor.y + descriptor.offsetY
  }, style);

  // Pure-overhead source marker: tiny fixture cap, not a perspective lamp sprite.
  graphics.fillStyle(style.fixtureColor, 0.96).fillCircle(descriptor.x, descriptor.y, 3.0);
  graphics.fillStyle(style.coreColor, 0.88).fillCircle(descriptor.x, descriptor.y, 1.45);
}

function drawBuildingLightSpill(graphics, descriptor, style) {
  drawSoftEllipsePool(graphics, descriptor, style);

  const sourceLength = Math.max(2, finite(style.sourceLength, 10));
  const sourceThickness = Math.max(1, finite(style.sourceThickness, 2));
  graphics.fillStyle(style.sourceColor, finite(style.sourceAlpha, 0.3));
  if (descriptor.edge === "north" || descriptor.edge === "south") {
    graphics.fillRect(
      descriptor.sourceX - sourceLength / 2,
      descriptor.sourceY - sourceThickness / 2,
      sourceLength,
      sourceThickness
    );
  } else {
    graphics.fillRect(
      descriptor.sourceX - sourceThickness / 2,
      descriptor.sourceY - sourceLength / 2,
      sourceThickness,
      sourceLength
    );
  }
  graphics.fillStyle(style.coreColor, finite(style.coreAlpha, 0.5))
    .fillCircle(descriptor.sourceX, descriptor.sourceY, Math.max(0.5, finite(style.coreRadius, 1.2)));
}

function drawContextualDescriptor(graphics, descriptor) {
  const style = PRACTICAL_LIGHT_PRESENTATIONS[descriptor.family];
  if (!style) return;
  drawBuildingLightSpill(graphics, descriptor, style);
}

export function installCityPracticalLightPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityPracticalLightPresentationPolicy) return;
  prototype.__viceCityPracticalLightPresentationPolicy = true;

  const drawCrosswalkNetwork = prototype.drawCrosswalkNetwork;
  if (typeof drawCrosswalkNetwork !== "function") {
    throw new Error("CityPracticalLightPresentationPolicy requires CitySurfacePresentationPolicy to be installed first.");
  }

  prototype.drawCityPracticalLights = function viceBloodDrawCityPracticalLights(renderBounds) {
    if (this.currentLayer !== LAYERS.STREET || !this.map) return [];
    const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
    if (!bounds) return [];

    const streetDescriptors = buildWarmStreetLightDescriptors(lights, bounds, {
      brokenLightIds: this.brokenLights
    });
    const buildingDescriptors = buildContextualBuildingLightDescriptors(buildings, bounds);

    for (const descriptor of streetDescriptors) drawSoftWarmStreetPool(this.map, descriptor);
    for (const descriptor of buildingDescriptors) drawContextualDescriptor(this.map, descriptor);

    const descriptors = Object.freeze([...streetDescriptors, ...buildingDescriptors]);
    this.cityPracticalLightDescriptors = descriptors;
    return descriptors;
  };

  // Crosswalk rendering is a stable presentation-only composition seam shared
  // by the street policies. Injecting here keeps light generation out of city
  // topology/gameplay state and guarantees the pass runs only on street redraws;
  // later M4 work may refine receiving-surface response without changing anchors.
  prototype.drawCrosswalkNetwork = function viceBloodDrawCrosswalkNetworkWithPracticalLights(...args) {
    const result = drawCrosswalkNetwork.apply(this, args);
    this.drawCityPracticalLights(this.urbanRenderBounds);
    return result;
  };
}
