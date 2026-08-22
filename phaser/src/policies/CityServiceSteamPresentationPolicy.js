import { LAYERS } from "../data/district.js";

export const CITY_SERVICE_STEAM_FAMILIES = Object.freeze({
  SERVICE_STEAM: "service-steam-smoke"
});

export const SERVICE_STEAM_PRESENTATION = Object.freeze({
  family: CITY_SERVICE_STEAM_FAMILIES.SERVICE_STEAM,
  cullMargin: 72,
  maximumSources: 3,
  maximumPuffsPerSource: 3,
  minimumSourceSpacing: 150,
  sourceOffset: 8,
  lifetimeMs: 2800,
  plumeDistance: 34,
  driftDistance: 7,
  minimumRadius: 3.2,
  maximumRadius: 10.5,
  steamColor: 0xc8c5bd,
  steamAlpha: 0.14,
  smokeColor: 0x706965,
  smokeAlpha: 0.10
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function right(bounds) {
  return finite(bounds?.x) + Math.max(0, finite(bounds?.w));
}

function bottom(bounds) {
  return finite(bounds?.y) + Math.max(0, finite(bounds?.h));
}

function pointInsideBounds(point, bounds, margin = 0) {
  if (!bounds) return true;
  return finite(point?.x) >= finite(bounds.x) - margin
    && finite(point?.x) <= right(bounds) + margin
    && finite(point?.y) >= finite(bounds.y) - margin
    && finite(point?.y) <= bottom(bounds) + margin;
}

function edgeNormal(edge) {
  if (edge === "north") return { x: 0, y: -1 };
  if (edge === "east") return { x: 1, y: 0 };
  if (edge === "west") return { x: -1, y: 0 };
  return { x: 0, y: 1 };
}

function sourcePoint(descriptor, presentation) {
  const normal = edgeNormal(descriptor?.edge);
  const baseX = Number.isFinite(Number(descriptor?.sourceX))
    ? finite(descriptor.sourceX)
    : finite(descriptor?.x);
  const baseY = Number.isFinite(Number(descriptor?.sourceY))
    ? finite(descriptor.sourceY)
    : finite(descriptor?.y);
  const offset = Math.max(0, finite(presentation.sourceOffset, 8));
  return {
    x: baseX + normal.x * offset,
    y: baseY + normal.y * offset,
    normal
  };
}

function sourceVariant(profileId, seed) {
  if (profileId === "warehouse") return "steam";
  return ((seed >>> 7) & 1) === 1 ? "smoke" : "steam";
}

export function buildServiceSteamSourceDescriptors(sourceGrimeDescriptors, bounds = null, {
  presentation = SERVICE_STEAM_PRESENTATION
} = {}) {
  const maximumSources = Math.max(0, Math.floor(finite(presentation.maximumSources, 3)));
  const minimumSpacing = Math.max(0, finite(presentation.minimumSourceSpacing, 150));
  const cullMargin = Math.max(0, finite(presentation.cullMargin, 72));
  if (!maximumSources) return Object.freeze([]);

  const candidates = (Array.isArray(sourceGrimeDescriptors) ? sourceGrimeDescriptors : [])
    .filter(item => item?.sourceKind === "service-strip")
    .filter(item => ["industrial", "warehouse"].includes(String(item?.profileId || "")))
    .map(item => {
      const seed = hashString(`${item.sourceId || item.buildingId}:${presentation.family}`);
      const point = sourcePoint(item, presentation);
      return {
        item,
        seed,
        point,
        rank: hashString(`${seed}:rank`)
      };
    })
    .sort((left, rightValue) => left.rank - rightValue.rank
      || String(left.item.sourceId || "").localeCompare(String(rightValue.item.sourceId || "")));

  // Select one stable global source set first. Local camera bounds are only a visibility
  // filter; moving the camera must never reseed which authored service anchors own steam.
  const selectedCandidates = [];
  for (const candidate of candidates) {
    if (selectedCandidates.length >= maximumSources) break;
    if (selectedCandidates.some(selected => (
      Math.hypot(selected.point.x - candidate.point.x, selected.point.y - candidate.point.y) < minimumSpacing
    ))) {
      continue;
    }
    selectedCandidates.push(candidate);
  }

  const descriptors = selectedCandidates.map(candidate => {
    const variant = sourceVariant(candidate.item.profileId, candidate.seed);
    const maxAlpha = variant === "smoke"
      ? finite(presentation.smokeAlpha, 0.10)
      : finite(presentation.steamAlpha, 0.14);
    const color = variant === "smoke"
      ? presentation.smokeColor
      : presentation.steamColor;

    return Object.freeze({
      sourceId: `building:${candidate.item.buildingId}:service-steam-smoke`,
      buildingId: String(candidate.item.buildingId || ""),
      sourceGrimeId: String(candidate.item.sourceId || ""),
      family: presentation.family,
      profileId: String(candidate.item.profileId || ""),
      variant,
      edge: candidate.item.edge || "south",
      x: candidate.point.x,
      y: candidate.point.y,
      normalX: candidate.point.normal.x,
      normalY: candidate.point.normal.y,
      driftSign: (candidate.seed & 1) === 1 ? 1 : -1,
      phaseMs: candidate.seed % Math.max(1, Math.floor(finite(presentation.lifetimeMs, 2800))),
      color,
      maxAlpha: clamp(maxAlpha, 0, 0.18)
    });
  });

  return Object.freeze(descriptors.filter(descriptor => pointInsideBounds(descriptor, bounds, cullMargin)));
}

export function buildServiceSteamPuffFrame(sourceDescriptors, timeMs = 0, {
  presentation = SERVICE_STEAM_PRESENTATION
} = {}) {
  const lifetimeMs = Math.max(400, finite(presentation.lifetimeMs, 2800));
  const maximumPuffs = Math.max(1, Math.floor(finite(presentation.maximumPuffsPerSource, 3)));
  const plumeDistance = Math.max(0, finite(presentation.plumeDistance, 34));
  const driftDistance = Math.max(0, finite(presentation.driftDistance, 7));
  const minimumRadius = Math.max(1, finite(presentation.minimumRadius, 3.2));
  const maximumRadius = Math.max(minimumRadius, finite(presentation.maximumRadius, 10.5));
  const now = Math.max(0, finite(timeMs));
  const puffs = [];

  for (const source of sourceDescriptors || []) {
    for (let index = 0; index < maximumPuffs; index += 1) {
      const offset = source.phaseMs + lifetimeMs * index / maximumPuffs;
      const phase = ((now + offset) % lifetimeMs) / lifetimeMs;
      const envelope = Math.pow(Math.sin(Math.PI * phase), 1.35);
      const radius = minimumRadius + (maximumRadius - minimumRadius) * phase;
      const wobble = Math.sin((phase * Math.PI * 2) + index * 1.7) * 1.8;
      const drift = (source.driftSign || 1) * driftDistance * phase + wobble;
      const travel = plumeDistance * phase;
      const normalX = finite(source.normalX);
      const normalY = finite(source.normalY, -1);
      const tangentX = -normalY;
      const tangentY = normalX;
      const alpha = clamp(source.maxAlpha * envelope, 0, 0.18);
      if (alpha <= 0.002) continue;

      puffs.push(Object.freeze({
        sourceId: source.sourceId,
        variant: source.variant,
        color: source.color,
        x: source.x + normalX * travel + tangentX * drift,
        y: source.y + normalY * travel + tangentY * drift,
        radius,
        alpha,
        phase
      }));
    }
  }

  return Object.freeze(puffs);
}

export function drawServiceSteamPuffFrame(graphics, puffs) {
  if (!graphics) return;
  for (const puff of puffs || []) {
    graphics.fillStyle(puff.color, puff.alpha);
    graphics.fillCircle(puff.x, puff.y, puff.radius);
  }
}

export function installCityServiceSteamPresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCityServiceSteamPresentationPolicy) return;
  prototype.__viceCityServiceSteamPresentationPolicy = true;

  const baseCreate = prototype.create;
  const baseUpdate = prototype.update;
  const baseServiceGrime = prototype.drawCityServiceFrontageGrime;
  if (typeof baseCreate !== "function" || typeof baseUpdate !== "function" || typeof baseServiceGrime !== "function") {
    throw new Error("CityServiceSteamPresentationPolicy requires GameScene create/update and M5 service grime.");
  }

  prototype.create = function viceBloodCreateWithServiceSteam(...args) {
    const result = baseCreate.call(this, ...args);
    this.cityServiceSteamGraphics?.destroy?.();
    this.cityServiceSteamGraphics = this.add?.graphics?.() || null;
    this.cityServiceSteamGraphics?.setDepth?.(18);
    this.cityServiceSteamSourceDescriptors ||= Object.freeze([]);
    this.cityServiceSteamPuffFrame = Object.freeze([]);
    return result;
  };

  prototype.drawCityServiceFrontageGrime = function viceBloodDrawServiceGrimeWithSteam(renderBounds) {
    const grime = baseServiceGrime.call(this, renderBounds);
    if (this.currentLayer !== LAYERS.STREET) {
      this.cityServiceSteamSourceDescriptors = Object.freeze([]);
      return grime;
    }
    const bounds = renderBounds || this.urbanRenderBounds || this.calculateUrbanRenderBounds?.();
    this.cityServiceSteamSourceDescriptors = buildServiceSteamSourceDescriptors(
      this.cityServiceFrontageGrimeDescriptors || grime,
      bounds
    );
    return grime;
  };

  prototype.updateCityServiceSteamPresentation = function viceBloodUpdateCityServiceSteamPresentation(timeMs = 0) {
    const graphics = this.cityServiceSteamGraphics;
    graphics?.clear?.();
    if (!graphics || this.currentLayer !== LAYERS.STREET) {
      this.cityServiceSteamPuffFrame = Object.freeze([]);
      return this.cityServiceSteamPuffFrame;
    }
    const frame = buildServiceSteamPuffFrame(this.cityServiceSteamSourceDescriptors || [], timeMs);
    drawServiceSteamPuffFrame(graphics, frame);
    this.cityServiceSteamPuffFrame = frame;
    return frame;
  };

  prototype.update = function viceBloodUpdateWithServiceSteam(time, deltaMs) {
    const result = baseUpdate.call(this, time, deltaMs);
    this.updateCityServiceSteamPresentation(time);
    return result;
  };
}
