import { LAYERS, lights } from "../data/district.js";

export const PRACTICAL_LIGHT_FAMILIES = Object.freeze({
  WARM_STREET: "warm-street"
});

export const WARM_STREET_LIGHT_PRESENTATION = Object.freeze({
  family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET,
  color: 0xf2b35e,
  coreColor: 0xffedb0,
  fixtureColor: 0x332d2b,
  minimumRadius: 38,
  maximumRadius: 58,
  verticalScale: 0.82,
  cullMargin: 72,
  layers: Object.freeze([
    Object.freeze({ radiusScale: 1, alpha: 0.034 }),
    Object.freeze({ radiusScale: 0.68, alpha: 0.052 }),
    Object.freeze({ radiusScale: 0.40, alpha: 0.074 }),
    Object.freeze({ radiusScale: 0.18, alpha: 0.10 })
  ])
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

function drawSoftWarmPool(graphics, descriptor) {
  const style = WARM_STREET_LIGHT_PRESENTATION;
  const centreX = descriptor.x + descriptor.offsetX;
  const centreY = descriptor.y + descriptor.offsetY;

  for (const layer of style.layers) {
    graphics.fillStyle(style.color, layer.alpha * descriptor.intensity);
    graphics.fillEllipse(
      centreX,
      centreY,
      descriptor.width * layer.radiusScale,
      descriptor.height * layer.radiusScale
    );
  }

  // Pure-overhead source marker: tiny fixture cap, not a perspective lamp sprite.
  graphics.fillStyle(style.fixtureColor, 0.96).fillCircle(descriptor.x, descriptor.y, 3.2);
  graphics.fillStyle(style.coreColor, 0.92).fillCircle(descriptor.x, descriptor.y, 1.65);
}

export function installCityPracticalLightPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityPracticalLightPresentationPolicy) return;
  prototype.__viceCityPracticalLightPresentationPolicy = true;

  const drawCrosswalkNetwork = prototype.drawCrosswalkNetwork;
  if (typeof drawCrosswalkNetwork !== "function") {
    throw new Error("CityPracticalLightPresentationPolicy requires CitySurfacePresentationPolicy to be installed first.");
  }

  prototype.drawWarmStreetPracticalLights = function viceBloodDrawWarmStreetPracticalLights(renderBounds) {
    if (this.currentLayer !== LAYERS.STREET || !this.map) return [];
    const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
    if (!bounds) return [];

    const descriptors = buildWarmStreetLightDescriptors(lights, bounds, {
      brokenLightIds: this.brokenLights
    });
    for (const descriptor of descriptors) drawSoftWarmPool(this.map, descriptor);
    this.cityPracticalLightDescriptors = descriptors;
    return descriptors;
  };

  // CitySurfacePresentationPolicy composes roads/sidewalks/crosswalks before
  // buildings. Inject the practical-light pass immediately after crosswalks so
  // building mass naturally occludes ground light instead of receiving a fake
  // fullscreen glow. The semantic `lights` collection remains unchanged.
  prototype.drawCrosswalkNetwork = function viceBloodDrawCrosswalkNetworkWithPracticalLights(...args) {
    const result = drawCrosswalkNetwork.apply(this, args);
    this.drawWarmStreetPracticalLights(this.urbanRenderBounds);
    return result;
  };
}
