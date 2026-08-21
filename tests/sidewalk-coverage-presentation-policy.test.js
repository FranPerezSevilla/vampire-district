import assert from "node:assert/strict";
import test from "node:test";

import { WORLD } from "../phaser/src/data/balance.js";
import { LAYERS, sidewalks } from "../phaser/src/data/district.js";
import { installSidewalkCoveragePresentationPolicy } from "../phaser/src/policies/SidewalkCoveragePresentationPolicy.js";

function mapStub(onFillRect = () => {}) {
  return {
    fillStyle() { return this; },
    fillRect(x, y, w, h) { onFillRect(x, y, w, h); return this; },
    lineStyle() { return this; },
    lineBetween() { return this; }
  };
}

class PresentationScene {
  drawDistrictStreet() {}
}

installSidewalkCoveragePresentationPolicy(PresentationScene);

test("authoritative road and junction pavement is painted after buildings and participates in sidewalk geometry", () => {
  const bounds = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const roadPavement = {
    id: "presentation-road-edge-test",
    x: 40,
    y: 78,
    w: 120,
    h: 22,
    geometry: "rect",
    presentationOnly: true,
    authoritativeRoadEdge: true
  };
  const junctionPavement = {
    id: "presentation-junction-test",
    x: 200,
    y: 78,
    w: 22,
    h: 22,
    geometry: "rect",
    presentationOnly: true,
    authoritativeJunctionSidewalk: true
  };
  const completed = [...sidewalks, roadPavement, junctionPavement];
  const observed = {};
  const renderOrder = [];
  const scene = new PresentationScene();

  const authoredChunkItems = function authoredChunkItems(category, queryBounds, fallback) {
    if (category === "sidewalks") return fallback;
    if (category === "buildings") return [{ id: "overlapping-building" }];
    return [];
  };

  scene.chunkItems = authoredChunkItems;
  scene.citySurfaceCompletedSidewalks = completed;
  scene.urbanRenderBounds = bounds;
  scene.currentLayer = LAYERS.STREET;
  scene.map = mapStub((x, y, w, h) => {
    if (x === roadPavement.x && y === roadPavement.y && w === roadPavement.w && h === roadPavement.h) {
      renderOrder.push("road-pavement");
    }
    if (x === junctionPavement.x && y === junctionPavement.y && w === junctionPavement.w && h === junctionPavement.h) {
      renderOrder.push("junction-pavement");
    }
  });

  scene.prepareCitySurfaceGeometry = function prepareCitySurfaceGeometry(queryBounds) {
    observed.geometryCount = this.chunkItems("sidewalks", queryBounds, sidewalks, { margin: 56 }).length;
    this.citySurfaceGeometryCache = { boundary: { curbSegments: [], corners: [] } };
    return this.citySurfaceGeometryCache;
  };
  scene.drawSidewalkNetwork = function drawSidewalkNetwork() {
    renderOrder.push("sidewalk-network");
    observed.sidewalkDrawCount = this.chunkItems("sidewalks", bounds, sidewalks, { margin: 8 }).length;
  };
  scene.drawCrosswalkNetwork = function drawCrosswalkNetwork() {
    observed.crosswalkPhaseCount = this.chunkItems("sidewalks", bounds, sidewalks, { margin: 8 }).length;
  };
  scene.drawOpenGroundWindow = () => {};
  scene.drawCurbsideStreetDetails = () => {};
  scene.drawSewerManholes = () => {};
  scene.drawRoadWindow = () => {};
  scene.drawBuilding = () => renderOrder.push("building");

  scene.drawDistrictStreet();

  assert.equal(observed.geometryCount, completed.length);
  assert.equal(observed.sidewalkDrawCount, completed.length);
  assert.equal(observed.crosswalkPhaseCount, sidewalks.length);
  assert.deepEqual(renderOrder, ["building", "road-pavement", "junction-pavement", "sidewalk-network"]);
  assert.equal(scene.citySurfaceAuthoritativePavementDrawCount, 2);
  assert.strictEqual(scene.chunkItems, authoredChunkItems);
});

test("temporary presentation query is restored when sidewalk drawing throws", () => {
  const bounds = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const scene = new PresentationScene();
  const authoredChunkItems = function authoredChunkItems(category, queryBounds, fallback) {
    if (category === "sidewalks") return fallback;
    return [];
  };

  scene.chunkItems = authoredChunkItems;
  scene.citySurfaceCompletedSidewalks = [...sidewalks, {
    id: "presentation-only-error-test",
    x: 4,
    y: 4,
    w: 4,
    h: 4,
    geometry: "rect",
    presentationOnly: true,
    authoritativeRoadEdge: true
  }];
  scene.urbanRenderBounds = bounds;
  scene.currentLayer = LAYERS.STREET;
  scene.map = mapStub();
  scene.prepareCitySurfaceGeometry = function prepareCitySurfaceGeometry() {
    this.citySurfaceGeometryCache = { boundary: { curbSegments: [], corners: [] } };
    return this.citySurfaceGeometryCache;
  };
  scene.drawOpenGroundWindow = () => {};
  scene.drawCurbsideStreetDetails = () => {};
  scene.drawRoadWindow = () => {};
  scene.drawBuilding = () => {};
  scene.drawSidewalkNetwork = () => {
    throw new Error("render failure");
  };

  assert.throws(() => scene.drawDistrictStreet(), /render failure/);
  assert.strictEqual(scene.chunkItems, authoredChunkItems);
});
