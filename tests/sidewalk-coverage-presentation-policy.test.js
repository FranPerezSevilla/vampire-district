import assert from "node:assert/strict";
import test from "node:test";

import { WORLD } from "../phaser/src/data/balance.js";
import { LAYERS, sidewalks } from "../phaser/src/data/district.js";
import { installSidewalkCoveragePresentationPolicy } from "../phaser/src/policies/SidewalkCoveragePresentationPolicy.js";

function mapStub() {
  return {
    fillStyle() { return this; },
    fillRect() { return this; },
    lineStyle() { return this; },
    lineBetween() { return this; }
  };
}

class PresentationScene {
  drawDistrictStreet() {}
}

installSidewalkCoveragePresentationPolicy(PresentationScene);

test("completed sidewalks stay inside geometry and sidewalk rendering queries", () => {
  const bounds = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const visualOnly = {
    id: "presentation-only-test-sidewalk",
    x: 4,
    y: 4,
    w: 4,
    h: 4,
    geometry: "rect",
    presentationOnly: true
  };
  const completed = [...sidewalks, visualOnly];
  const observed = {};
  const scene = new PresentationScene();

  const authoredChunkItems = function authoredChunkItems(category, queryBounds, fallback) {
    if (category === "sidewalks") return fallback;
    return [];
  };

  scene.chunkItems = authoredChunkItems;
  scene.citySurfaceCompletedSidewalks = completed;
  scene.urbanRenderBounds = bounds;
  scene.currentLayer = LAYERS.STREET;
  scene.map = mapStub();

  scene.prepareCitySurfaceGeometry = function prepareCitySurfaceGeometry(queryBounds) {
    observed.geometryCount = this.chunkItems("sidewalks", queryBounds, sidewalks, { margin: 56 }).length;
    this.citySurfaceGeometryCache = {
      boundary: { curbSegments: [], corners: [] }
    };
    return this.citySurfaceGeometryCache;
  };
  scene.drawSidewalkNetwork = function drawSidewalkNetwork() {
    observed.sidewalkDrawCount = this.chunkItems("sidewalks", bounds, sidewalks, { margin: 8 }).length;
  };
  scene.drawCrosswalkNetwork = function drawCrosswalkNetwork() {
    observed.crosswalkPhaseCount = this.chunkItems("sidewalks", bounds, sidewalks, { margin: 8 }).length;
  };
  scene.drawOpenGroundWindow = () => {};
  scene.drawCurbsideStreetDetails = () => {};
  scene.drawSewerManholes = () => {};
  scene.drawRoadWindow = () => {};
  scene.drawBuilding = () => {};

  scene.drawDistrictStreet();

  assert.equal(observed.geometryCount, completed.length);
  assert.equal(observed.sidewalkDrawCount, completed.length);
  assert.equal(observed.crosswalkPhaseCount, sidewalks.length);
  assert.strictEqual(scene.chunkItems, authoredChunkItems);
  assert.equal(scene.chunkItems("sidewalks", bounds, sidewalks).length, sidewalks.length);
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
    presentationOnly: true
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
  scene.drawSidewalkNetwork = () => {
    throw new Error("render failure");
  };

  assert.throws(() => scene.drawDistrictStreet(), /render failure/);
  assert.strictEqual(scene.chunkItems, authoredChunkItems);
  assert.equal(scene.chunkItems("sidewalks", bounds, sidewalks).length, sidewalks.length);
});
