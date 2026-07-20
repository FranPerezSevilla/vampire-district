import test from "node:test";
import assert from "node:assert/strict";
import { GameplayRuntime } from "../phaser/src/runtime/GameplayRuntime.js";
import { OUTER_BOUNDS, OutskirtsSystem } from "../phaser/src/systems/OutskirtsSystem.js";

function runtimeFixture({ cinematicActive = false, registryActive = false } = {}) {
  let cameraUpdates = 0;
  const scene = {
    taskRevealCinematic: { active: cinematicActive },
    registry: { get: key => key === "taskRevealActive" && registryActive },
    updateCameraForLayer() { cameraUpdates++; },
    outskirtsSystem: { updatePresentation() {} },
    objectiveMarkerSystem: { update() {} },
    drawPromptMarker() {},
    statePublisher: { setMany() {} },
    npcSystem: { spatial: { size: () => 0 } },
    time: { now: 0 },
    publishState() {}
  };
  const runtime = Object.create(GameplayRuntime.prototype);
  runtime.scene = scene;
  runtime.diagnostics = {
    endFrame: () => 0,
    summary: () => "runtime",
    snapshot: () => ({ conflicts: [] })
  };
  return {
    runtime,
    cameraUpdates: () => cameraUpdates
  };
}

function outskirtsFixture({ locked = false, busy = false } = {}) {
  const bounds = [];
  const centers = [];
  const alphas = [];
  const scene = {
    currentLayer: 2,
    player: { x: 150, y: 146 },
    registry: { get: key => key === "taskRevealActive" && locked },
    tutorialDirector: { busy },
    cameras: {
      main: {
        setBounds(...args) { bounds.push(args); },
        centerOn(...args) { centers.push(args); }
      }
    }
  };
  const system = Object.create(OutskirtsSystem.prototype);
  system.scene = scene;
  system.graphics = { setAlpha(value) { alphas.push(value); } };
  system.updatePresentation();
  return { bounds, centers, alphas };
}

test("normal layer zoom does not overwrite an active tutorial cinematic", () => {
  const fixture = runtimeFixture({ cinematicActive: true });
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 0);
});

test("registry-owned task cinematics also retain camera ownership", () => {
  const fixture = runtimeFixture({ registryActive: true });
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 0);
});

test("layer zoom resumes after the cinematic releases the camera", () => {
  const fixture = runtimeFixture();
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 1);
});

test("cinematics keep expanded city bounds and the player centred", () => {
  const fixture = outskirtsFixture({ locked: true, busy: true });
  assert.deepEqual(fixture.bounds, [[
    OUTER_BOUNDS.x,
    OUTER_BOUNDS.y,
    OUTER_BOUNDS.width,
    OUTER_BOUNDS.height
  ]]);
  assert.deepEqual(fixture.centers, [[150, 146]]);
});

test("normal gameplay keeps expanded bounds without forcing a recenter", () => {
  const fixture = outskirtsFixture();
  assert.equal(fixture.bounds.length, 1);
  assert.deepEqual(fixture.centers, []);
});
