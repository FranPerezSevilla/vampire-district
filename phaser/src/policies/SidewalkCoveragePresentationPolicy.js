import { COLORS, WORLD } from "../data/balance.js";
import { buildings, crosswalks, LAYERS, roadSegments, roads, sidewalks } from "../data/district.js";
import { buildCurbOverlaySegments } from "../rendering/CurbOverlayGeometry.js";
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

function segmentIntersectsBounds(segment, bounds, margin = 1) {
  const x = Math.min(finite(segment?.x1), finite(segment?.x2));
  const y = Math.min(finite(segment?.y1), finite(segment?.y2));
  const w = Math.abs(finite(segment?.x2) - finite(segment?.x1));
  const h = Math.abs(finite(segment?.y2) - finite(segment?.y1));
  return x <= right(bounds) + margin
    && x + w >= finite(bounds.x) - margin
    && y <= bottom(bounds) + margin
    && y + h >= finite(bounds.y) - margin;
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
 * Temporarily supplies completed pedestrian surfaces only to the two rendering
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
 * Restores only curb portions that a late-rendered building can overpaint. The
 * canonical completed boundary is passed in explicitly so this late pass never
 * rebuilds geometry from the gameplay-only sidewalk collection.
 */
function installFinalCurbOverlay(prototype) {
  prototype.drawFinalBuildingCurbOverlay = function viceBloodDrawFinalBuildingCurbOverlay(
    renderBounds,
    visibleBuildings,
    boundary = this.citySurfaceGeometryCache?.boundary
  ) {
    if (!boundary) return;
    const visibleCrosswalks = this.chunkItems("crosswalks", renderBounds, crosswalks, { margin: 4 });
    const segments = buildCurbOverlaySegments(boundary, {
      occluders: visibleBuildings,
      crosswalks: visibleCrosswalks,
      occluderPadding: 2,
      crosswalkPadding: 1.5,
      minimumSegmentLength: 0.25
    });
    if (!segments.length) return;

    this.map.lineStyle(2, COLORS.sidewalkCurb, 0.82);
    for (const segment of segments) {
      if (!segmentIntersectsBounds(segment, renderBounds, 2)) continue;
      this.map.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
    }
  };
}

/**
 * Keeps completed sidewalk geometry strictly inside the street presentation path.
 * Collisions, pedestrian spawning, navigation and normal chunk queries continue to
 * consume the authored topology. The completed union is used only while preparing
 * surface geometry and while filling/drawing the sidewalk network itself.
 */
export function installSidewalkCoveragePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceSidewalkCoveragePresentationPolicy) return;
  if (typeof prototype.drawDistrictStreet !== "function") return;
  prototype.__viceSidewalkCoveragePresentationPolicy = true;
  installFinalCurbOverlay(prototype);

  prototype.drawDistrictStreet = function viceBloodDrawCompletedSidewalkDistrict() {
    const completed = completedSidewalksFor(this);
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();

    withPresentationSidewalks(this, completed, () => this.prepareCitySurfaceGeometry(bounds));
    const completedBoundary = this.citySurfaceGeometryCache?.boundary;

    this.map.fillStyle(COLORS.streetBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.drawOpenGroundWindow(bounds);
    for (const road of this.chunkItems("roads", bounds, roads, { margin: 12 })) this.drawRoadWindow(road);
    this.drawCurbsideStreetDetails(bounds);

    withPresentationSidewalks(this, completed, () => this.drawSidewalkNetwork());

    this.drawCrosswalkNetwork();
    this.drawSewerManholes();

    const visibleBuildings = this.chunkItems("buildings", bounds, buildings, { margin: 80 });
    for (const building of visibleBuildings) this.drawBuilding(building);
    this.drawFinalBuildingCurbOverlay(bounds, visibleBuildings, completedBoundary);

    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  };
}
