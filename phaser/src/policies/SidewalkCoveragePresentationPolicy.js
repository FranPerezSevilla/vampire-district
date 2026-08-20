import { WORLD } from "../data/balance.js";
import { buildings, roadSegments, roads, sidewalks } from "../data/district.js";
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

function intersects(area, bounds, margin = 0) {
  if (!area || !bounds) return false;
  return finite(area.x) <= right(bounds) + margin
    && right(area) >= finite(bounds.x) - margin
    && finite(area.y) <= bottom(bounds) + margin
    && bottom(area) >= finite(bounds.y) - margin;
}

function completedSidewalksFor(scene) {
  if (scene.citySurfaceCompletedSidewalks) return scene.citySurfaceCompletedSidewalks;
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments,
    roads,
    sidewalks,
    buildings,
    world: WORLD,
    sidewalkWidth: 22,
    minimumFragmentLength: 8
  });
  const authoredCount = sidewalks.length;
  const infillCount = completed.length - authoredCount;
  scene.citySurfaceCompletedSidewalks = Object.freeze(completed.map(surface => Object.freeze({ ...surface })));
  scene.citySurfaceSidewalkCoverage = Object.freeze({ authoredCount, infillCount, totalCount: completed.length });
  return scene.citySurfaceCompletedSidewalks;
}

/**
 * Installs after CitySurfacePresentationPolicy and supplies its renderer with a
 * completed visual sidewalk surface set. Gameplay, navigation and generated city
 * ownership remain unchanged; only the surface collection used during street drawing
 * is replaced for the duration of drawSidewalkNetwork.
 */
export function installSidewalkCoveragePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceSidewalkCoveragePresentationPolicy) return;
  const originalDrawSidewalkNetwork = prototype.drawSidewalkNetwork;
  if (typeof originalDrawSidewalkNetwork !== "function") return;
  prototype.__viceSidewalkCoveragePresentationPolicy = true;

  prototype.drawSidewalkNetwork = function viceBloodDrawCompletedSidewalkNetwork(...args) {
    const completed = completedSidewalksFor(this);
    const hadOwnChunkItems = Object.prototype.hasOwnProperty.call(this, "chunkItems");
    const originalChunkItems = this.chunkItems;

    this.chunkItems = function viceBloodCompletedSidewalkQuery(category, bounds, fallback, options = {}) {
      if (category === "sidewalks") {
        const margin = Math.max(0, finite(options.margin));
        return completed.filter(surface => intersects(surface, bounds, margin));
      }
      return originalChunkItems.call(this, category, bounds, fallback, options);
    };

    try {
      return originalDrawSidewalkNetwork.apply(this, args);
    } finally {
      if (hadOwnChunkItems) this.chunkItems = originalChunkItems;
      else delete this.chunkItems;
    }
  };
}
