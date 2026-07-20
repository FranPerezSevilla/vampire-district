import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA } from "../phaser/src/data/balance.js";
import { LAYERS } from "../phaser/src/data/district.js";
import { GameplayRuntime } from "../phaser/src/runtime/GameplayRuntime.js";
import { OUTER_BOUNDS, OutskirtsSystem } from "../phaser/src/systems/OutskirtsSystem.js";
import { TutorialDirector } from "../phaser/src/tutorial/TutorialDirector.js";

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
    currentLayer: LAYERS.ROOF_HIGH,
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

function tutorialZoomFixture() {
  const calls = [];
  const zooms = [];
  const centers = [];
  let counter = null;
  const player = { x: 150, y: 146 };
  const camera = {
    zoom: 6,
    setZoom(value) {
      this.zoom = value;
      zooms.push(value);
    },
    centerOn(x, y) {
      centers.push([x, y]);
    },
    startFollow(target, roundPixels, lerpX, lerpY) {
      calls.push(["follow", target, roundPixels, lerpX, lerpY]);
    }
  };
  const scene = {
    currentLayer: LAYERS.ROOF_HIGH,
    player,
    cameras: { main: camera },
    outskirtsSystem: {
      updatePresentation() {
        calls.push(["expanded-bounds"]);
      }
    },
    tweens: {
      addCounter(config) {
        counter = config;
        calls.push(["tween"]);
        return config;
      }
    }
  };
  const director = Object.create(TutorialDirector.prototype);
  director.scene = scene;
  const completion = director.zoomBackToWorld();
  return {
    calls,
    zooms,
    centers,
    counter: () => counter,
    completion,
    player,
    camera
  };
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

test("intro zoom-out installs expanded bounds before tweening and never stops centring the player", async () => {
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = {
    Math: {
      Linear: (from, to, progress) => from + (to - from) * progress
    }
  };

  try {
    const fixture = tutorialZoomFixture();
    const counter = fixture.counter();

    assert.ok(counter, "zoom-out tween should be registered");
    assert.deepEqual(fixture.calls.slice(0, 2), [["expanded-bounds"], ["tween"]]);

    counter.onUpdate({ getValue: () => 0 });
    counter.onUpdate({ getValue: () => 0.5 });
    counter.onUpdate({ getValue: () => 1 });
    assert.deepEqual(fixture.centers, [
      [fixture.player.x, fixture.player.y],
      [fixture.player.x, fixture.player.y],
      [fixture.player.x, fixture.player.y]
    ]);
    assert.equal(fixture.zooms[0], 6);
    assert.ok(fixture.zooms[1] < 6 && fixture.zooms[1] > CAMERA.roofHighZoom);
    assert.ok(Math.abs(fixture.zooms[2] - CAMERA.roofHighZoom) < 1e-9);

    counter.onComplete();
    await fixture.completion;

    assert.equal(fixture.camera.zoom, CAMERA.roofHighZoom);
    assert.deepEqual(fixture.centers.at(-1), [fixture.player.x, fixture.player.y]);
    assert.deepEqual(fixture.calls.at(-1), ["follow", fixture.player, true, 0.12, 0.12]);
  } finally {
    if (previousPhaser === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = previousPhaser;
  }
});
