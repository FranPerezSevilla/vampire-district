import {
  BUILDING_SIDEWALK_CLEARANCE_POLICY_ID,
  fitBuildingToSidewalks,
  isNeonBuilding
} from "../data/BuildingSidewalkClearance.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function queryBounds(building, margin = 16) {
  const padding = Math.max(0, finite(margin, 16));
  return {
    x: finite(building?.x) - padding,
    y: finite(building?.y) - padding,
    w: Math.max(1, finite(building?.w) + padding * 2),
    h: Math.max(1, finite(building?.h) + padding * 2)
  };
}

export function installBuildingSidewalkClearancePolicy(scene, options = {}) {
  const stream = scene?.cityStreamSystem;
  if (!stream?.query) throw new TypeError("Building sidewalk clearance policy requires ChunkStreamSystem.");
  if (stream.__nbdBuildingSidewalkClearancePolicy) return stream.__nbdBuildingSidewalkClearancePolicy;

  const originalQuery = stream.query;
  const cache = new WeakMap();
  let adjustedQueries = 0;

  function clearanceAwareQuery(category, bounds, queryOptions = {}) {
    const values = originalQuery.call(this, category, bounds, queryOptions);
    if (category !== "buildings" || !Array.isArray(values) || values.length === 0) return values;

    return values.map(building => {
      if (!building || typeof building !== "object" || !isNeonBuilding(building)) return building;
      const cached = cache.get(building);
      if (cached) return cached;

      const sidewalkOptions = {
        includePrefetched: queryOptions?.includePrefetched !== false,
        margin: Math.max(8, finite(options.searchMargin, 16))
      };
      const surfaces = originalQuery.call(this, "sidewalks", queryBounds(building, sidewalkOptions.margin), sidewalkOptions);
      const adjusted = fitBuildingToSidewalks(building, surfaces, options);
      cache.set(building, adjusted);
      if (adjusted !== building) adjustedQueries++;
      return adjusted;
    });
  }

  stream.query = clearanceAwareQuery;
  const policy = {
    id: BUILDING_SIDEWALK_CLEARANCE_POLICY_ID,
    originalQuery,
    clearanceAwareQuery,
    snapshot() {
      return {
        id: BUILDING_SIDEWALK_CLEARANCE_POLICY_ID,
        adjustedQueries
      };
    },
    destroy() {
      if (stream.query === clearanceAwareQuery) stream.query = originalQuery;
      if (stream.__nbdBuildingSidewalkClearancePolicy === policy) delete stream.__nbdBuildingSidewalkClearancePolicy;
    }
  };
  stream.__nbdBuildingSidewalkClearancePolicy = policy;
  return policy;
}
