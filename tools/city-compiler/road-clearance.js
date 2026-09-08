import { pointInRect, rectOverlapArea } from "./geometry.js";

const EPSILON = 0.001;

/** Keep a rectangular footprint around its original centre, outside road space. */
export function fitRoadClearance(footprint, roads, { setback = 26, minimumSize = 32 } = {}) {
  const center = { x: footprint.x + footprint.w / 2, y: footprint.y + footprint.h / 2 };
  let fitted = footprint;
  for (const road of roads) {
    const space = { x: road.x - setback, y: road.y - setback, w: road.w + setback * 2, h: road.h + setback * 2 };
    if (rectOverlapArea(fitted, space) <= EPSILON) continue;
    const right = fitted.x + fitted.w, bottom = fitted.y + fitted.h;
    const candidates = [
      { ...fitted, w: space.x - fitted.x },
      { ...fitted, x: space.x + space.w, w: right - space.x - space.w },
      { ...fitted, h: space.y - fitted.y },
      { ...fitted, y: space.y + space.h, h: bottom - space.y - space.h }
    ].filter(rect => rect.w >= minimumSize && rect.h >= minimumSize && pointInRect(center, rect))
      .sort((a, b) => b.w * b.h - a.w * a.h);
    if (!candidates.length) throw new Error(`Road clearance cannot preserve ${footprint.id} beside ${road.id}.`);
    fitted = candidates[0];
  }
  return fitted;
}

export function fitCityRoadClearance(city, roads, { sidewalkWidth = 22, clearance = 4 } = {}) {
  const buildings = city.buildings.map(building => fitRoadClearance(building, roads, { setback: sidewalkWidth + clearance }));
  const oldById = new Map(city.buildings.map(building => [building.id, building]));
  const byId = new Map(buildings.map(building => [building.id, building]));
  const roofChanges = [];
  const roofAreas = Object.fromEntries(Object.entries(city.roofAreas).map(([layer, roofs]) => [layer, roofs.map(roof => {
    const old = oldById.get(roof.buildingId), next = byId.get(roof.buildingId);
    if (!old || old === next) return roof;
    const fitted = { ...roof,
      x: next.x + roof.x - old.x, y: next.y + roof.y - old.y,
      w: roof.w + next.w - old.w, h: roof.h + next.h - old.h };
    if (fitted.w <= 0 || fitted.h <= 0) throw new Error(`Road clearance removed roof ${roof.id}.`);
    roofChanges.push({ layer: Number(layer), old: roof, next: fitted });
    return fitted;
  })]));
  const roofPoint = point => {
    const change = roofChanges.find(item => item.layer === point.layer && pointInRect(point, item.old, 2));
    if (!change) return point;
    return { ...point,
      x: change.next.x + (point.x - change.old.x) * change.next.w / change.old.w,
      y: change.next.y + (point.y - change.old.y) * change.next.h / change.old.h };
  };
  return {
    buildings,
    landmarkSites: city.landmarkSites.map(site => fitRoadClearance(site, roads, { setback: 0 })),
    roofAreas,
    roofDrops: city.roofDrops.map(drop => ({ ...drop, roof: roofPoint(drop.roof) })),
    fireEscapes: city.fireEscapes.map(escape => ({ ...escape, roof: roofPoint(escape.roof) })),
    rooftopRoutes: city.rooftopRoutes.map(route => {
      const a = roofPoint({ x: route.ax, y: route.ay, layer: route.aLayer });
      const b = roofPoint({ x: route.bx, y: route.by, layer: route.bLayer });
      return { ...route, ax: a.x, ay: a.y, bx: b.x, by: b.y };
    })
  };
}
