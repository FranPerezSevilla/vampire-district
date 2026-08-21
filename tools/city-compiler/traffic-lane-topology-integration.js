import {
  buildCompilerTrafficLaneTopology,
  validateCompilerTrafficLaneTopology
} from "./traffic-lane-topology.js";

export const TRAFFIC_LANE_PACK_SCHEMA_VERSION = 6;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function attachCompilerTrafficLaneTopology(fileSet) {
  if (!fileSet?.trafficLanes || !fileSet?.network) {
    throw new TypeError("Compiler traffic lane integration requires a district streaming file set.");
  }

  const localTopology = buildCompilerTrafficLaneTopology(fileSet.network);
  const validation = validateCompilerTrafficLaneTopology(localTopology);
  if (!validation.valid) {
    const error = new Error(`Compiler local traffic topology is invalid: ${validation.errors.join(" | ")}`);
    error.validation = validation;
    throw error;
  }

  // Preserve the legacy district-pair lane graph unchanged during the staged migration.
  // Current runtime systems still consume `edges`; `localTopology` is additive/read-only
  // until later PR #73 milestones explicitly activate it.
  const legacyEdges = cloneJson(fileSet.trafficLanes.edges || {});
  const legacyJunctions = cloneJson(fileSet.trafficLanes.junctions || []);
  const trafficLanes = {
    ...fileSet.trafficLanes,
    schemaVersion: TRAFFIC_LANE_PACK_SCHEMA_VERSION,
    version: TRAFFIC_LANE_PACK_SCHEMA_VERSION,
    localTopology,
    edges: legacyEdges,
    junctions: legacyJunctions
  };

  return {
    fileSet: {
      ...fileSet,
      trafficLanes
    },
    validation
  };
}
