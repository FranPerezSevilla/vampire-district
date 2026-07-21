import { crosswalks, pointOnPedestrianSurface, sidewalks } from "../data/district.js";
import { StreetFurnitureSystem as StreetFurnitureSystemCore } from "./StreetFurnitureSystemCore.js";

const PEDESTRIAN_SURFACES = Object.freeze([...sidewalks, ...crosswalks]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function nearestPedestrianPlacement(prop) {
  if (pointOnPedestrianSurface(prop.x, prop.y)) return { x: prop.x, y: prop.y };
  let best = { x: prop.x, y: prop.y };
  let bestDistance = Infinity;
  for (const area of PEDESTRIAN_SURFACES) {
    const x = clamp(prop.x, area.x + 2, area.x + area.w - 2);
    const y = clamp(prop.y, area.y + 2, area.y + area.h - 2);
    const distance = Math.hypot(x - prop.x, y - prop.y);
    if (distance < bestDistance) {
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

function bodyFlag(bodyId, field) {
  return `body.${String(bodyId || "")}.${String(field || "")}`;
}

export class StreetFurnitureSystem extends StreetFurnitureSystemCore {
  constructor(scene, campaign) {
    super(scene, campaign);
    for (const prop of this.dumpsters) {
      const placement = nearestPedestrianPlacement(prop);
      prop.x = placement.x;
      prop.y = placement.y;
      prop.visual.container?.setPosition?.(prop.x, prop.y);
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
      body.inactive = false;
      body.hiddenBody = false;
      body.dragged = false;
      body.exposedAfterContainment = true;
      body.exposedByStreetPropId = state.streetPropId;
      body.hiddenSpotId = null;
      body.hiddenSpotName = null;
      body.x = Number.isFinite(state.x) ? state.x : prop.x;
      body.y = Number.isFinite(state.y) ? state.y : prop.y;
      body.layer = prop.layer;
      body.container?.setPosition?.(body.x, body.y).setVisible?.(
        body.layer === this.scene.currentLayer
      );
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
  }
}