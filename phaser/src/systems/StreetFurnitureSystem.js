import { WORLD } from "../data/balance.js";
import {
  buildings,
  crosswalks,
  districtZoneAt,
  pointInCitySurface,
  pointOnPedestrianSurface,
  roads
} from "../data/district.js";
import { StreetFurnitureSystem as StreetFurnitureSystemCore } from "./StreetFurnitureSystemCore.js";

const SPECIAL_FRONTAGE = /hospital|clinic|medical|industrial|foundry|factory|warehouse|depot|works|plant/i;
const BUILDING_SEARCH_RADIUS = 520;
const WALL_OFFSET = 15;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function pointInRect(x, y, area, margin = 0) {
  return x >= area.x - margin
    && x <= area.x + area.w + margin
    && y >= area.y - margin
    && y <= area.y + area.h + margin;
}

function areaBounds(area) {
  if (Array.isArray(area?.points) && area.points.length) {
    const xs = area.points.map(point => Number(point.x) || 0);
    const ys = area.points.map(point => Number(point.y) || 0);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return {
    x: Number(area?.x) || 0,
    y: Number(area?.y) || 0,
    w: Math.max(0, Number(area?.w) || 0),
    h: Math.max(0, Number(area?.h) || 0)
  };
}

function distanceToRect(x, y, area) {
  const bounds = areaBounds(area);
  const dx = Math.max(bounds.x - x, 0, x - (bounds.x + bounds.w));
  const dy = Math.max(bounds.y - y, 0, y - (bounds.y + bounds.h));
  return Math.hypot(dx, dy);
}

function surfaceContains(collection, x, y) {
  return collection.some(area => pointInCitySurface(x, y, area));
}

function semanticText(prop, building) {
  const district = districtZoneAt(prop.x, prop.y);
  return [
    prop.id,
    prop.name,
    building?.id,
    building?.name,
    building?.sign,
    building?.kind,
    building?.siteId,
    district?.id,
    district?.name
  ].filter(Boolean).join(" ");
}

function buildingCandidates(building) {
  const fractions = [0.22, 0.5, 0.78];
  const candidates = [];
  for (const fraction of fractions) {
    candidates.push(
      { x: building.x + building.w * fraction, y: building.y - WALL_OFFSET, building },
      { x: building.x + building.w * fraction, y: building.y + building.h + WALL_OFFSET, building },
      { x: building.x - WALL_OFFSET, y: building.y + building.h * fraction, building },
      { x: building.x + building.w + WALL_OFFSET, y: building.y + building.h * fraction, building }
    );
  }
  return candidates;
}

function roadDistance(x, y) {
  let best = Infinity;
  for (const road of roads) best = Math.min(best, distanceToRect(x, y, road));
  return best;
}

function placementScore(prop, candidate, occupied = []) {
  const { x, y, building } = candidate;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return -Infinity;
  if (buildings.some(item => pointInRect(x, y, item, 5))) return -Infinity;
  if (surfaceContains(roads, x, y) || surfaceContains(crosswalks, x, y)) return -Infinity;
  if (occupied.some(point => Math.hypot(point.x - x, point.y - y) < 34)) return -Infinity;

  const special = SPECIAL_FRONTAGE.test(semanticText(prop, building));
  const nearbyBuildings = buildings.filter(item => distanceToRect(x, y, item) <= 74);
  const distance = Math.hypot(x - prop.x, y - prop.y);
  const nearRoad = roadDistance(x, y);
  const pedestrian = pointOnPedestrianSurface(x, y);

  let score = 0;
  score -= distance * 0.08;
  score += nearbyBuildings.length >= 2 ? 190 : nearbyBuildings.length === 1 ? 82 : -120;
  score += special ? 145 : 0;
  score += pedestrian ? (special ? 18 : -34) : 30;
  if (nearRoad < 22) score += special ? 26 : -78;
  else if (nearRoad < 52) score += special ? 14 : -32;
  else score += 24;

  // Prefer service-side corners and narrow gaps over broad building frontage.
  const edgeX = Math.min(Math.abs(x - building.x), Math.abs(x - (building.x + building.w)));
  const edgeY = Math.min(Math.abs(y - building.y), Math.abs(y - (building.y + building.h)));
  if (Math.min(edgeX, edgeY) <= WALL_OFFSET + 2) score += 24;
  return score;
}

function contextualDumpsterPlacement(prop, occupied = []) {
  const localBuildings = buildings
    .filter(building => distanceToRect(prop.x, prop.y, building) <= BUILDING_SEARCH_RADIUS)
    .sort((left, right) => (
      distanceToRect(prop.x, prop.y, left) - distanceToRect(prop.x, prop.y, right)
      || String(left.id || "").localeCompare(String(right.id || ""))
    ));

  const candidates = localBuildings.flatMap(building => buildingCandidates(building));
  if (!surfaceContains(roads, prop.x, prop.y)
    && !surfaceContains(crosswalks, prop.x, prop.y)
    && !buildings.some(building => pointInRect(prop.x, prop.y, building, 5))) {
    const nearest = localBuildings[0];
    if (nearest) candidates.push({ x: prop.x, y: prop.y, building: nearest });
  }

  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = placementScore(prop, candidate, occupied);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  const point = best || { x: prop.x, y: prop.y };
  return {
    x: clamp(point.x, 18, WORLD.width - 18),
    y: clamp(point.y, 18, WORLD.height - 18)
  };
}

function bodyFlag(bodyId, field) {
  return `body.${String(bodyId || "")}.${String(field || "")}`;
}

export class StreetFurnitureSystem extends StreetFurnitureSystemCore {
  constructor(scene, campaign) {
    super(scene, campaign);
    const occupied = [];
    for (const prop of this.dumpsters) {
      const placement = contextualDumpsterPlacement(prop, occupied);
      prop.x = placement.x;
      prop.y = placement.y;
      prop.visual.container?.setPosition?.(prop.x, prop.y);
      occupied.push({ x: prop.x, y: prop.y });
    }
    this.restoreReleasedBodies();
    this.publish();
  }

  releaseHiddenBody(prop, vehicle = null) {
    const body = super.releaseHiddenBody(prop, vehicle);
    if (!body) return null;

    body.exposedAfterContainment = true;
    body.exposedByStreetPropId = prop.id;
    const flags = this.campaign.state.world.flags;
    flags[bodyFlag(body.id, "exposedByStreetProp")] = prop.id;
    flags[bodyFlag(body.id, "x")] = body.x;
    flags[bodyFlag(body.id, "y")] = body.y;
    this.campaign.events?.emit?.("world:body-exposed", {
      bodyId: body.id,
      streetPropId: prop.id,
      x: body.x,
      y: body.y
    });
    return body;
  }

  updateReleasedBodyPosition(body) {
    const state = this.releasedBodyState(body?.id);
    if (!state || !body) return false;
    const flags = this.campaign.state.world.flags;
    flags[bodyFlag(body.id, "x")] = Number(body.x) || 0;
    flags[bodyFlag(body.id, "y")] = Number(body.y) || 0;
    this.campaign.events?.emit?.("world:body-exposure-position", {
      bodyId: body.id,
      streetPropId: state.streetPropId,
      x: body.x,
      y: body.y
    });
    return true;
  }

  clearReleasedBody(body) {
    if (!body?.id) return false;
    const flags = this.campaign.state.world.flags;
    const keys = [
      bodyFlag(body.id, "exposedByStreetProp"),
      bodyFlag(body.id, "x"),
      bodyFlag(body.id, "y")
    ];
    const changed = keys.some(key => Object.hasOwn(flags, key));
    for (const key of keys) delete flags[key];
    body.exposedAfterContainment = false;
    body.exposedByStreetPropId = null;
    if (changed) {
      this.campaign.events?.emit?.("world:body-recontained", {
        bodyId: body.id,
        streetPropId: body.hiddenSpotId || null
      });
    }
    return changed;
  }

  releasedBodyState(bodyId) {
    const flags = this.campaign.state.world.flags;
    const propId = flags[bodyFlag(bodyId, "exposedByStreetProp")];
    if (!propId) return null;
    return {
      bodyId: String(bodyId || ""),
      streetPropId: String(propId),
      x: Number(flags[bodyFlag(bodyId, "x")]),
      y: Number(flags[bodyFlag(bodyId, "y")])
    };
  }

  restoreReleasedBodies() {
    for (const body of this.scene.npcSystem?.npcs || []) {
      const state = this.releasedBodyState(body.id);
      if (!state) continue;
      const prop = this.dumpster(state.streetPropId);
      if (!prop?.broken) continue;
      if (!body.dead) this.scene.npcSystem?.markDead?.(body, "killed");
      const beingDragged = this.scene.evidenceSystem?.draggingBody === body;
      body.inactive = false;
      body.hiddenBody = false;
      body.dragged = beingDragged;
      body.exposedAfterContainment = true;
      body.exposedByStreetPropId = state.streetPropId;
      body.hiddenSpotId = null;
      body.hiddenSpotName = null;
      if (!beingDragged) {
        body.x = Number.isFinite(state.x) ? state.x : prop.x;
        body.y = Number.isFinite(state.y) ? state.y : prop.y;
        body.layer = prop.layer;
      }
      body.container?.setPosition?.(body.x, body.y).setVisible?.(
        body.layer === this.scene.currentLayer
      );
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
  }
}
