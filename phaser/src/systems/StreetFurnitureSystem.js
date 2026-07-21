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

export class StreetFurnitureSystem extends StreetFurnitureSystemCore {
  constructor(scene, campaign) {
    super(scene, campaign);
    for (const prop of this.dumpsters) {
      const placement = nearestPedestrianPlacement(prop);
      prop.x = placement.x;
      prop.y = placement.y;
      prop.visual.container?.setPosition?.(prop.x, prop.y);
    }
    this.publish();
  }
}