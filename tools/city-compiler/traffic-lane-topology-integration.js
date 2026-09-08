import {
  buildCompilerTrafficLaneTopology,
  validateCompilerTrafficLaneTopology
} from "./traffic-lane-topology.js";
import {
  buildCompilerTrafficJunctionConnectors,
  validateCompilerTrafficJunctionConnectors
} from "./traffic-junction-connectors.js";

export const TRAFFIC_LANE_PACK_SCHEMA_VERSION = 6;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function combinedValidation(topologyValidation, connectorValidation) {
  return {
    valid: topologyValidation.valid && connectorValidation.valid,
    errors: [...topologyValidation.errors, ...connectorValidation.errors],
    metrics: {
      ...topologyValidation.metrics,
      junctionConnectors: connectorValidation.metrics.connectors,
      safeJunctionConnectors: connectorValidation.metrics.safeConnectors,
      rejectedJunctionConnectors: connectorValidation.metrics.rejectedConnectors,
      directJunctionHandoffs: connectorValidation.metrics.directHandoffs,
      outsideRoadJunctionConnectors: connectorValidation.metrics.outsideRoadConnectors,
      junctionConnectorTangentFailures: connectorValidation.metrics.tangentFailures
    },
    topology: topologyValidation,
    connectors: connectorValidation
  };
}

export function attachCompilerTrafficLaneTopology(fileSet) {
  if (!fileSet?.trafficLanes || !fileSet?.network) {
    throw new TypeError("Compiler traffic lane integration requires a district streaming file set.");
  }
  if (!Array.isArray(fileSet?.roadSurfaces)) {
    throw new TypeError("Compiler traffic lane integration requires compiler-owned road surfaces.");
  }

  const localTopologyBase = buildCompilerTrafficLaneTopology(fileSet.network);
  const topologyValidation = validateCompilerTrafficLaneTopology(localTopologyBase);
  if (!topologyValidation.valid) {
    const error = new Error(`Compiler local traffic topology is invalid: ${topologyValidation.errors.join(" | ")}`);
    error.validation = topologyValidation;
    throw error;
  }

  const junctionConnectors = buildCompilerTrafficJunctionConnectors(
    localTopologyBase,
    fileSet.roadSurfaces
  );
  const connectorValidation = validateCompilerTrafficJunctionConnectors(
    junctionConnectors,
    localTopologyBase
  );
  if (!connectorValidation.valid) {
    const error = new Error(`Compiler traffic junction connectors are invalid: ${connectorValidation.errors.join(" | ")}`);
    error.validation = connectorValidation;
    throw error;
  }

  const validation = combinedValidation(topologyValidation, connectorValidation);
  const localTopology = {
    ...localTopologyBase,
    junctionConnectors,
    stats: {
      ...localTopologyBase.stats,
      junctionConnectorCount: junctionConnectors.stats.connectorCount,
      safeJunctionConnectorCount: junctionConnectors.stats.safeConnectorCount,
      directJunctionHandoffCount: junctionConnectors.stats.directHandoffCount
    }
  };

  // Preserve the legacy district-pair lane graph unchanged during the staged migration.
  // Current runtime systems still consume `edges`; compiler-owned `localTopology` is
  // additive/read-only until later PR #73 milestones explicitly activate route agents.
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
