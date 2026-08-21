import { COLORS, WORLD } from "../data/balance.js";
import { buildings, LAYERS, roadSegments, roads, sidewalks } from "../data/district.js";
import { buildCompletedSidewalkSurfaces } from "../rendering/SidewalkSurfaceCompletion.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function right(rect) {
  return finite(rect?.x) + finite(rect?.w);
}

function bottom(rect) {
  return finite(rect?.y) + finite(rect?.h);
}

function surfaceBounds(area) {
  if (area?.geometry === "polygon" && Array.isArray(area.points) && area.points.length) {
    const xs = area.points.map(point => finite(point.x));
    const ys = area.points.map(point => finite(point.y));
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }
  return {
    x: finite(area?.x),
    y: finite(area?.y),
    w: finite(area?.w),
    h: finite(area?.h)
  };
}

function intersects(area, bounds, margin = 0) {
  if (!area || !bounds) return false;
  const candidate = surfaceBounds(area);
  return finite(candidate.x) <= right(bounds) + margin
    && right(candidate) >= finite(bounds.x) - margin
    && finite(candidate.y) <= bottom(bounds) + margin
    && bottom(candidate) >= finite(bounds.y) - margin;
}

function completedSidewalksFor(scene) {
  if (scene.citySurfaceCompletedSidewalks) return scene.citySurfaceCompletedSidewalks;
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments,
    roads,
    sidewalks,
    world: WORLD,
    sidewalkWidth: 22
  });
  const authoredCount = sidewalks.length;
  const infillCount = completed.length - authoredCount;
  scene.citySurfaceCompletedSidewalks = Object.freeze(completed.map(surface => Object.freeze({ ...surface })));
  scene.citySurfaceSidewalkCoverage = Object.freeze({ authoredCount, infillCount, totalCount: completed.length });
  return scene.citySurfaceCompletedSidewalks;
}

/**
 * Temporarily supplies completed pedestrian surfaces only to the rendering
 * operations that need them. The gameplay-facing chunk query is restored before
 * crosswalks, population, AI or any other system can observe presentation infill.
 */
function withPresentationSidewalks(scene, completed, callback) {
  const originalChunkItems = scene.chunkItems;
  if (typeof originalChunkItems !== "function") return callback();
  const hadOwnChunkItems = Object.prototype.hasOwnProperty.call(scene, "chunkItems");

  scene.chunkItems = function viceBloodPresentationSidewalkQuery(category, bounds, fallback, options = {}) {
    if (category === "sidewalks") {
      const margin = Math.max(0, finite(options.margin));
      return completed.filter(surface => intersects(surface, bounds, margin));
    }
    return originalChunkItems.call(this, category, bounds, fallback, options);
  };

  try {
    return callback();
  } finally {
    if (hadOwnChunkItems) scene.chunkItems = originalChunkItems;
    else delete scene.chunkItems;
  }
}

/**
 * Keeps completed sidewalk geometry strictly inside the street presentation path.
 * Collisions, pedestrian spawning, navigation and normal chunk queries continue to
 * consume the authored topology.
 *
 * Buildings are intentionally painted before the completed sidewalk network. A
 * building footprint may overlap the road-side pedestrian band in authored city
 * data, but presentation treats that band as authoritative: the pavement and curb
 * remain visible instead of being erased by the later building pass.
 */
export function installSidewalkCoveragePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceSidewalkCoveragePresentationPolicy) return;
  if (typeof prototype.drawDistrictStreet !== "function") return;
  prototype.__viceSidewalkCoveragePresentationPolicy = true;

  prototype.drawDistrictStreet = function viceBloodDrawCompletedSidewalkDistrict() {
    const completed = completedSidewalksFor(this);
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();

    withPresentationSidewalks(this, completed, () => this.prepareCitySurfaceGeometry(bounds));

    this.map.fillStyle(COLORS.streetBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.drawOpenGroundWindow(bounds);
    for (const road of this.chunkItems("roads", bounds, roads, { margin: 12 })) this.drawRoadWindow(road);
    this.drawCurbsideStreetDetails(bounds);

    const visibleBuildings = this.chunkItems("buildings", bounds, buildings, { margin: 80 });
    for (const building of visibleBuildings) this.drawBuilding(building);

    withPresentationSidewalks(this, completed, () => this.drawSidewalkNetwork());

    this.drawCrosswalkNetwork();
    this.drawSewerManholes();

    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  };
}
