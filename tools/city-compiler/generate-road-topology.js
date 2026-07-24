import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import * as current from "../../phaser/src/data/generated/city-topology-v2.js";
import { cityRoadGraph, CITY_ROAD_GRAPH_VERSION } from "./city-road-graph-v1.js";
import {
  buildPedestrianRoutesFromSidewalks,
  compileAxisAlignedRoadGraph,
  placePostLayoutDumpsters,
  roadGraphIntegrity
} from "./road-graph.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = path.join(root, "phaser/src/data/generated/city-topology-v2.js");
const compiled = compileAxisAlignedRoadGraph(cityRoadGraph, {
  world: current.CITY_WORLD,
  buildings: current.buildings,
  sidewalkWidth: 22,
  crosswalkThickness: 14,
  crosswalkInset: 8,
  lightSpacingMajor: 360,
  lightSpacingLocal: 300,
  lightSpacingAlley: 260,
  lightMinimumSpacing: 150
});
compiled.world = current.CITY_WORLD;
const integrity = roadGraphIntegrity(cityRoadGraph, compiled);
if (!integrity.valid) {
  for (const error of integrity.errors) console.error(`[${error.code}] ${JSON.stringify(error)}`);
  process.exitCode = 1;
  throw new Error(`Road graph compilation failed with ${integrity.errors.length} integrity errors.`);
}

const dumpsters = placePostLayoutDumpsters(current.dumpsters, {
  roads: compiled.roads,
  sidewalks: compiled.sidewalks,
  crosswalks: compiled.crosswalks,
  propExclusionZones: compiled.propExclusionZones,
  buildings: current.buildings,
  lights: compiled.lights,
  world: current.CITY_WORLD
});
const dumpstersById = new Map(dumpsters.map(dumpster => [dumpster.id, dumpster]));
const bodyHideSpots = current.bodyHideSpots.map(spot => {
  const dumpster = dumpstersById.get(spot.streetPropId || spot.id);
  return dumpster ? { ...spot, x: dumpster.x, y: dumpster.y } : spot;
});

const pedestrianRoutes = buildPedestrianRoutesFromSidewalks(
  cityRoadGraph.pedestrianRouteAnchors,
  compiled.sidewalks
);
const preservedNavigationPoints = current.streetNavigationPoints.filter(point => point.kind !== "pedestrian");
const pedestrianNavigationPoints = pedestrianRoutes.flatMap(route => route.points.map((point, index) => ({
  id: `nav:${route.id}:${index + 1}`,
  x: point.x,
  y: point.y,
  kind: "pedestrian",
  routeId: route.id,
  sidewalkId: route.sidewalkId
})));
const streetNavigationPoints = [...preservedNavigationPoints, ...pedestrianNavigationPoints];

const cityAnchors = {
  ...current.CITY_ANCHORS,
  foundryStreet: {
    ...(current.CITY_ANCHORS.foundryStreet || {}),
    x: 2010,
    y: 2212
  }
};

const topologyStats = {
  ...current.CITY_TOPOLOGY_STATS,
  roadGeometryVersion: CITY_ROAD_GRAPH_VERSION,
  roadGraphNodeCount: compiled.stats.graphNodeCount,
  roadGraphEdgeCount: compiled.stats.graphEdgeCount,
  roadPieceCount: compiled.stats.roadPieceCount,
  roadSegmentCount: compiled.stats.roadSegmentCount,
  roadJunctionCount: compiled.stats.junctionCount,
  roadTransitionCount: compiled.stats.transitionCount,
  sidewalkCount: compiled.stats.sidewalkCount,
  roadEdgeBandCount: compiled.stats.roadEdgeBandCount,
  roadEdgeBandSourceCount: compiled.stats.roadEdgeBandSourceCount,
  absorbedShortApproachCount: compiled.stats.absorbedShortApproachCount,
  junctionSidewalkCount: compiled.stats.junctionSidewalkCount,
  crosswalkCount: compiled.stats.crosswalkCount,
  propExclusionZoneCount: compiled.stats.propExclusionZoneCount,
  lightCount: compiled.stats.lightCount,
  dumpsterCount: dumpsters.length
};

const collections = [
  ["CITY_TOPOLOGY_VERSION", current.CITY_TOPOLOGY_VERSION],
  ["ROAD_GEOMETRY_VERSION", CITY_ROAD_GRAPH_VERSION],
  ["CITY_TOPOLOGY_SEED", "city-topology-v2-site-first"],
  ["CITY_WORLD", current.CITY_WORLD],
  ["CITY_TOPOLOGY_STATS", topologyStats],
  ["CITY_ANCHORS", cityAnchors],
  ["landmarkSites", current.landmarkSites],
  ["roadGraphNodes", compiled.graph.nodes],
  ["roadGraphEdges", compiled.graph.edges],
  ["roadCorridors", cityRoadGraph.corridors],
  ["roads", compiled.roads],
  ["roadSegments", compiled.roadSegments],
  ["roadJunctions", compiled.roadJunctions],
  ["roadTransitions", compiled.roadTransitions],
  ["sidewalks", compiled.sidewalks],
  ["junctionSidewalks", compiled.junctionSidewalks],
  ["crosswalks", compiled.crosswalks],
  ["propExclusionZones", compiled.propExclusionZones],
  ["buildings", current.buildings],
  ["roofAreas", current.roofAreas],
  ["rooftopRoutes", current.rooftopRoutes],
  ["roofDrops", current.roofDrops],
  ["fireEscapes", current.fireEscapes],
  ["sewerTunnels", current.sewerTunnels],
  ["sewerAccesses", current.sewerAccesses],
  ["lights", compiled.lights],
  ["dumpsters", dumpsters],
  ["bodyHideSpots", bodyHideSpots],
  ["shadowZones", current.shadowZones],
  ["pedestrianRoutes", pedestrianRoutes],
  ["streetNavigationPoints", streetNavigationPoints],
  ["districtZones", current.districtZones],
  ["policeStation", current.policeStation],
  ["policePatrolRoutes", current.policePatrolRoutes],
  ["districtEntryPoints", current.districtEntryPoints],
  ["policeLocalZones", current.policeLocalZones]
];

const source = [
  '"use strict";',
  "",
  "function deepFreeze(value) {",
  '  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;',
  "  for (const child of Object.values(value)) deepFreeze(child);",
  "  return Object.freeze(value);",
  "}",
  "",
  ...collections.map(([name, value]) => `export const ${name} = deepFreeze(${JSON.stringify(value)});`),
  ""
].join("\n");

await writeFile(outputPath, source, "utf8");
console.log(`Road graph v${CITY_ROAD_GRAPH_VERSION} · nodes ${compiled.stats.graphNodeCount} · edges ${compiled.stats.graphEdgeCount}`);
console.log(`Road geometry · ${compiled.stats.roadSegmentCount} segments · ${compiled.stats.junctionCount} node pieces · ${compiled.stats.transitionCount} transitions`);
console.log(`Pedestrian geometry · ${compiled.stats.roadEdgeBandCount} continuous edge bands from ${compiled.stats.roadEdgeBandSourceCount} sources · ${compiled.stats.junctionSidewalkCount} junction-owned sidewalks · ${compiled.stats.crosswalkCount} crosswalks`);
console.log(`Prop exclusions · ${compiled.stats.propExclusionZoneCount}`);
console.log(`Post-layout furniture · ${compiled.stats.lightCount} lights · ${dumpsters.length} dumpsters`);
console.log(`Pedestrian routes · ${pedestrianRoutes.length}`);
console.log(`Generated ${path.relative(root, outputPath)}`);
