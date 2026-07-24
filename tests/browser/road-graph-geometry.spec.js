import { expect, test } from "@playwright/test";

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_CITY_STREAM
  ));
  await page.evaluate(() => window.NBD_CITY_STREAM.waitUntilReady());
}

test.describe.configure({ timeout: 90_000 });

test("graph-first road geometry has unique junction authority and post-layout furniture", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const geometry = await import("/tools/city-compiler/geometry.js");
    const junctionPieces = [...district.roadJunctions, ...district.roadTransitions];
    const ownership = new Map();
    for (const piece of junctionPieces) {
      for (const nodeId of piece.graphNodeIds || [piece.graphNodeId]) {
        ownership.set(nodeId, (ownership.get(nodeId) || 0) + 1);
      }
    }

    const roadOverlaps = [];
    for (let left = 0; left < district.roads.length; left++) {
      for (let right = left + 1; right < district.roads.length; right++) {
        const overlap = geometry.surfaceOverlapArea(district.roads[left], district.roads[right]);
        if (overlap > 0.01) roadOverlaps.push([district.roads[left].id, district.roads[right].id, overlap]);
      }
    }

    function pointOn(point, surfaces, margin = 0) {
      return surfaces.some(surface => geometry.pointInSurface(point, surface, margin));
    }

    function continuations(crosswalk) {
      return crosswalk.orientation === "horizontal"
        ? [
            { x: crosswalk.x - 1, y: crosswalk.y + crosswalk.h / 2 },
            { x: crosswalk.x + crosswalk.w + 1, y: crosswalk.y + crosswalk.h / 2 }
          ]
        : [
            { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y - 1 },
            { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y + crosswalk.h + 1 }
          ];
    }

    const invalidCrosswalks = district.crosswalks.filter(crosswalk => (
      junctionPieces.some(piece => geometry.surfaceOverlapArea(crosswalk, piece) > 0.01)
      || !continuations(crosswalk).every(point => pointOn(point, district.sidewalks, 1.5))
    )).map(item => item.id);

    const roadEdgeBands = district.sidewalks.filter(sidewalk => sidewalk.bandKind === "road-edge");
    const invalidRoadEdgeBands = roadEdgeBands.filter(band => (
      (band.orientation === "horizontal" ? band.w : band.h) < 36
      || district.roads.some(road => geometry.surfaceOverlapArea(band, road) > 0.01)
      || district.buildings.some(building => geometry.surfaceOverlapArea(band, building) > 0.01)
    )).map(item => item.id);

    const invalidJunctionSidewalks = district.junctionSidewalks.filter(sidewalk => (
      district.roads.some(road => geometry.surfaceOverlapArea(sidewalk, road) > 0.01)
      || district.buildings.some(building => geometry.surfaceOverlapArea(sidewalk, building) > 0.01)
    )).map(item => item.id);

    const invalidLights = district.lights.filter(light => {
      const point = { x: light.x, y: light.y };
      return light.placementPhase !== "post-layout"
        || !district.sidewalks.some(sidewalk => geometry.pointInSurface(point, sidewalk))
        || district.roads.some(road => geometry.pointInSurface(point, road))
        || district.crosswalks.some(crosswalk => geometry.pointInSurface(point, crosswalk))
        || district.propExclusionZones.some(zone => geometry.pointInSurface(point, zone))
        || district.buildings.some(building => geometry.pointInRect(point, building, 8));
    }).map(item => item.id);

    const invalidDumpsters = district.dumpsters.filter(dumpster => {
      const point = { x: dumpster.x, y: dumpster.y };
      return dumpster.placementPhase !== "post-layout"
        || !["service-kerb", "service-yard"].includes(dumpster.anchorKind)
        || district.roads.some(road => geometry.pointInSurface(point, road, 6))
        || district.crosswalks.some(crosswalk => geometry.pointInSurface(point, crosswalk, 24))
        || district.propExclusionZones.some(zone => geometry.pointInSurface(point, zone))
        || district.buildings.some(building => geometry.pointInRect(point, building, 18));
    }).map(item => item.id);

    return {
      geometryVersion: district.ROAD_GEOMETRY_VERSION,
      stats: district.CITY_TOPOLOGY_STATS,
      graphNodes: district.roadGraphNodes.length,
      graphEdges: district.roadGraphEdges.length,
      roadSegments: district.roadSegments.length,
      junctionPieces: district.roadJunctions.length,
      transitions: district.roadTransitions.length,
      sidewalks: district.sidewalks.length,
      roadEdgeBands: roadEdgeBands.length,
      roadEdgeBandSources: district.CITY_TOPOLOGY_STATS.roadEdgeBandSourceCount,
      absorbedShortApproaches: district.CITY_TOPOLOGY_STATS.absorbedShortApproachCount,
      junctionSidewalks: district.junctionSidewalks.length,
      crosswalks: district.crosswalks.length,
      propExclusionZones: district.propExclusionZones.length,
      lights: district.lights.length,
      dumpsters: district.dumpsters.length,
      nodesWithoutUniqueAuthority: district.roadGraphNodes
        .filter(node => ownership.get(node.id) !== 1)
        .map(node => node.id),
      roadOverlaps,
      invalidRoadEdgeBands,
      invalidJunctionSidewalks,
      invalidCrosswalks,
      invalidLights,
      invalidDumpsters,
      retiredFoundryRoads: district.roadGraphEdges
        .filter(edge => (edge.sourceRoadIds || []).some(sourceId => [
          "foundryService",
          "foundry:road:north-drop",
          "foundry:road:east-link"
        ].includes(sourceId)))
        .map(edge => edge.id),
      generatedRouteLengths: district.pedestrianRoutes.map(route => route.points.length)
    };
  });

  expect(result.geometryVersion).toBe(4);
  expect(result.graphNodes).toBe(107);
  expect(result.graphEdges).toBe(148);
  expect(result.roadSegments).toBe(144);
  expect(result.junctionPieces).toBe(103);
  expect(result.sidewalks).toBe(776);
  expect(result.roadEdgeBands).toBe(309);
  expect(result.roadEdgeBandSources).toBe(288);
  expect(result.absorbedShortApproaches).toBe(1);
  expect(result.junctionSidewalks).toBe(467);
  expect(result.crosswalks).toBe(137);
  expect(result.propExclusionZones).toBe(536);
  expect(result.lights).toBe(128);
  expect(result.dumpsters).toBe(28);
  expect(result.nodesWithoutUniqueAuthority).toEqual([]);
  expect(result.roadOverlaps).toEqual([]);
  expect(result.invalidRoadEdgeBands).toEqual([]);
  expect(result.invalidJunctionSidewalks).toEqual([]);
  expect(result.invalidCrosswalks).toEqual([]);
  expect(result.invalidLights).toEqual([]);
  expect(result.invalidDumpsters).toEqual([]);
  expect(result.retiredFoundryRoads).toEqual([]);
  expect(result.generatedRouteLengths.every(length => length >= 4)).toBe(true);
  expect(result.stats.roadGeometryVersion).toBe(4);
  expect(pageErrors).toEqual([]);
});
