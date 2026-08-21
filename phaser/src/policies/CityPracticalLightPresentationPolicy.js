import { buildings, LAYERS, lights } from "../data/district.js";
import {
  resolveBuildingPresentationDefinition,
  resolveBuildingVisualProfile
} from "../rendering/BuildingPresentation.js";

export const PRACTICAL_LIGHT_FAMILIES = Object.freeze({
  WARM_STREET: "warm-street",
  WARM_FRONTAGE: "warm-frontage"
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

export const WARM_STREET_LIGHT_PRESENTATION = Object.freeze({
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

export const WARM_FRONTAGE_LIGHT_PRESENTATION = Object.freeze({
  family: PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE,
  color: 0xe5a259,
  coreColor: 0xffd99a,
  sourceColor: 0xf4c378,
  cullMargin: 54,
  minimumSpan: 22,
  maximumSpan: 46,
  outwardDepth: 28,
  layers: buildSoftFalloffLayers(14, {
    outerAlpha: 0.004,
    innerAlpha: 0.011,
    innerRadiusScale: 0.18
  })
});

const WARM_FRONTAGE_PROFILES = Object.freeze({
  default: 22,
  residential: 30,
  commercial: 38
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

function frontageGeometry(building, definition, visualProfile, seed) {
  const style = WARM_FRONTAGE_LIGHT_PRESENTATION;
  const edge = definition.frontageEdge || "south";
  const x = finite(building.x);
  const y = finite(building.y);
  const w = Math.max(1, finite(building.w));
  const h = Math.max(1, finite(building.h));
  const along = 0.30 + (seed % 41) / 100;
  const outward = 9 + ((seed >>> 8) % 5);
  const horizontal = edge === "north" || edge === "south";
  const longAxis = horizontal ? w : h;
  const span = clamp(longAxis * 0.18, style.minimumSpan, style.maximumSpan);
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

export function buildWarmFrontageLightDescriptors(sourceBuildings, bounds = null, {
  family = WARM_FRONTAGE_LIGHT_PRESENTATION.family,
  cullMargin = WARM_FRONTAGE_LIGHT_PRESENTATION.cullMargin
} = {}) {
  const safeMargin = Math.max(0, finite(cullMargin, WARM_FRONTAGE_LIGHT_PRESENTATION.cullMargin));
  const descriptors = [];

  for (const [index, building] of (Array.isArray(sourceBuildings) ? sourceBuildings : []).entries()) {
    if (!building || !rectInsideExpandedBounds(building, bounds, safeMargin)) continue;
    const buildingId = String(building.id || `building:${index}`);
    const definition = resolveBuildingPresentationDefinition(building);
    const visualProfile = resolveBuildingVisualProfile(building, definition.archetypeId, {
      profileId: definition.profileId
    });
    const chance = WARM_FRONTAGE_PROFILES[visualProfile.id];
    if (!chance || definition.frontage === "none") continue;

    const seed = hashString(`${buildingId}:warm-frontage`);
    if (seed % 100 >= chance) continue;
    const geometry = frontageGeometry(building, definition, visualProfile, seed);
    descriptors.push(Object.freeze({
      sourceId: `building:${buildingId}:frontage-light`,
      buildingId,
      family,
      profileId: visualProfile.id,
      frontage: definition.frontage,
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

function drawWarmFrontageSpill(graphics, descriptor) {
  const style = WARM_FRONTAGE_LIGHT_PRESENTATION;
  drawSoftEllipsePool(graphics, descriptor, style);

  graphics.fillStyle(style.sourceColor, 0.32);
  if (descriptor.edge === "north" || descriptor.edge === "south") {
    graphics.fillRect(descriptor.sourceX - 5, descriptor.sourceY - 1, 10, 2);
  } else {
    graphics.fillRect(descriptor.sourceX - 1, descriptor.sourceY - 5, 2, 10);
  }
  graphics.fillStyle(style.coreColor, 0.50).fillCircle(descriptor.sourceX, descriptor.sourceY, 1.2);
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
    const frontageDescriptors = buildWarmFrontageLightDescriptors(buildings, bounds);

    for (const descriptor of streetDescriptors) drawSoftWarmStreetPool(this.map, descriptor);
    for (const descriptor of frontageDescriptors) drawWarmFrontageSpill(this.map, descriptor);

    const descriptors = Object.freeze([...streetDescriptors, ...frontageDescriptors]);
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
