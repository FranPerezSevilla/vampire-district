import assert from "node:assert/strict";
import test from "node:test";

import { WORLD } from "../phaser/src/data/balance.js";
import { LAYERS, sidewalks } from "../phaser/src/data/district.js";
import { installSidewalkCoveragePresentationPolicy } from "../phaser/src/policies/SidewalkCoveragePresentationPolicy.js";

function mapStub(onFillRect = () => {}, onFillPoints = () => {}) {
  return {
    fillStyle() { return this; },
    fillRect(x, y, w, h) { onFillRect(x, y, w, h); return this; },
    fillPoints(points, close) { onFillPoints(points, close); return this; },
    lineStyle() { return this; },
    lineBetween() { return this; }
  };
}

class PresentationScene {
  drawDistrictStreet() {}
}

installSidewalkCoveragePresentationPolicy(PresentationScene);

test("authoritative road and junction pavement are painted after buildings and still participate in sidewalk geometry", () => {
  const bounds = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const roadBand = {
    id: "presentation-road-edge-test",
    x: 40,
    y: 78,
    w: 120,
    h: 22,
    geometry: "rect",
    presentationOnly: true,
    authoritativeRoadEdge: true
  };
  const junctionCap = {
    id: "presentation-junction-cap-test",
    x: 160,
    y: 78,
    w: 22,
    h: 22,
    geometry: "rect",
    presentationOnly: true,
    authoritativeJunctionSidewalk: true
  };
  const completed = [...sidewalks, roadBand, junctionCap];
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
    if (x === roadBand.x && y === roadBand.y && w === roadBand.w && h === roadBand.h) {
      renderOrder.push("authoritative-road");
    }
    if (x === junctionCap.x && y === junctionCap.y && w === junctionCap.w && h === junctionCap.h) {
      renderOrder.push("authoritative-junction");
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
  assert.deepEqual(renderOrder, ["building", "authoritative-road", "authoritative-junction", "sidewalk-network"]);
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
