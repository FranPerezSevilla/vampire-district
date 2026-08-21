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

function clippedRect(area, bounds) {
  if (!area || !bounds) return null;
  const x = Math.max(finite(area.x), finite(bounds.x));
  const y = Math.max(finite(area.y), finite(bounds.y));
  const maxX = Math.min(right(area), right(bounds));
  const maxY = Math.min(bottom(area), bottom(bounds));
  return maxX > x && maxY > y ? { x, y, w: maxX - x, h: maxY - y } : null;
}

function completedSidewalksFor(scene) {
  if (scene.citySurfaceCompletedSidewalks) return scene.citySurfaceCompletedSidewalks;
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments,
    sidewalks,
    world: WORLD,
    sidewalkWidth: 22
  });
  const authoredCount = sidewalks.length;
  const authoritativeCount = completed.filter(surface => surface.authoritativeRoadEdge === true).length;
  scene.citySurfaceCompletedSidewalks = Object.freeze(completed.map(surface => Object.freeze({ ...surface })));
  scene.citySurfaceSidewalkCoverage = Object.freeze({
    authoredCount,
    authoritativeCount,
    totalCount: completed.length
  });
  return scene.citySurfaceCompletedSidewalks;
}

/**
 * Supplies completed sidewalks only while street presentation geometry is being
 * prepared or drawn. Navigation, collision, population and AI keep consuming the
 * authored topology.
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
 * Guarantees the road-owned 22 px band survives building presentation. This draw
 * is deliberately narrow: it never guesses that yards, forecourts or setbacks are
 * sidewalk. Buildings may overlap the band in legacy topology; the road edge wins.
 */
function drawAuthoritativeRoadEdgePavement(scene, completed, bounds) {
  const visible = completed.filter(surface => surface.authoritativeRoadEdge === true && intersects(surface, bounds, 2));
  scene.map.fillStyle(COLORS.sidewalk, 1);
  for (const surface of visible) {
    const fragment = clippedRect(surface, bounds);
    if (fragment) scene.map.fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
  }
  return visible.length;
}

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

    this.citySurfaceAuthoritativePavementDrawCount = drawAuthoritativeRoadEdgePavement(this, completed, bounds);
    withPresentationSidewalks(this, completed, () => this.drawSidewalkNetwork());

    this.drawCrosswalkNetwork();
    this.drawSewerManholes();

    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  };
}
