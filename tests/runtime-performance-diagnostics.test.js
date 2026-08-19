import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RuntimeDiagnostics } from "../phaser/src/runtime/RuntimeDiagnostics.js";
import { GameplayRuntime } from "../phaser/src/runtime/GameplayRuntimeCore.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("RuntimeDiagnostics samples named wall time at a bounded cadence", () => {
  let now = 0;
  const diagnostics = new RuntimeDiagnostics({
    sampleSize: 10,
    systemSampleStride: 2,
    snapshotCacheMs: 0,
    clock: () => now
  });

  let mark = diagnostics.beginSystem("TrafficPipeline");
  assert.equal(mark, 0);
  now = 4;
  assert.equal(diagnostics.endSystem("TrafficPipeline", mark), 4);

  now = 10;
  assert.equal(diagnostics.beginSystem("TrafficPipeline"), null);

  now = 20;
  mark = diagnostics.beginSystem("TrafficPipeline");
  assert.equal(mark, 20);
  now = 26;
  assert.equal(diagnostics.endSystem("TrafficPipeline", mark), 6);

  const snapshot = diagnostics.snapshot({ force: true });
  assert.equal(snapshot.systemSampleStride, 2);
  assert.deepEqual(snapshot.systemTimings.TrafficPipeline, {
    calls: 3,
    samples: 2,
    averageMs: 5,
    recentMaxMs: 6,
    maxMs: 6
  });
});

test("RuntimeDiagnostics ranks the slowest measured pipelines", () => {
  let now = 0;
  const diagnostics = new RuntimeDiagnostics({
    systemSampleStride: 1,
    snapshotCacheMs: 0,
    clock: () => now
  });
  const record = (name, duration) => {
    const mark = diagnostics.beginSystem(name);
    now += duration;
    diagnostics.endSystem(name, mark);
  };

  record("StreamingPipeline", 2);
  record("TrafficPipeline", 7);
  record("PedestrianSystem", 4);

  assert.deepEqual(
    diagnostics.rankedSystems(undefined, 3).map(entry => entry.name),
    ["TrafficPipeline", "PedestrianSystem", "StreamingPipeline"]
  );
  assert.match(diagnostics.summary(), /hot TrafficPipeline 7\.00 ms/);
});

test("runtime diagnostic snapshots reuse their heavy nested object inside the cache window", () => {
  let now = 0;
  const diagnostics = new RuntimeDiagnostics({
    systemSampleStride: 1,
    snapshotCacheMs: 250,
    clock: () => now
  });

  diagnostics.beginFrame();
  now = 5;
  diagnostics.endFrame();
  const first = diagnostics.snapshot();

  now = 100;
  const cached = diagnostics.snapshot();
  assert.equal(cached, first);

  now = 260;
  const refreshed = diagnostics.snapshot();
  assert.notEqual(refreshed, first);
  assert.equal(refreshed.snapshotCacheMs, 250);
});

test("GameplayRuntime profiles the expensive outer pipelines without callback timers", () => {
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  for (const name of [
    "StreamingPipeline",
    "TrafficPipeline",
    "MotorizedPoliceSystem",
    "PedestrianSystem",
    "GameplayRuntimeCore",
    "TerritoryRuntimeSystem"
  ]) {
    assert.match(runtime, new RegExp(`beginSystem\\("${name}"\\)`));
    assert.match(runtime, new RegExp(`endSystem\\("${name}"`));
  }

  assert.doesNotMatch(runtime, /measureSystem\([^,]+,\s*\(\)\s*=>/);
});

test("cached runtime diagnostics publish only when their snapshot refreshes", () => {
  let currentSnapshot = { serial: 1 };
  let diagnosticsPublishes = 0;
  let performancePublishes = 0;
  let summaryCalls = 0;
  let publishStateCalls = 0;
  const runtime = Object.create(GameplayRuntime.prototype);
  runtime.lastDiagnosticsSnapshot = null;
  runtime.diagnostics = {
    endFrame: () => 12.5,
    snapshot: () => currentSnapshot,
    summary: () => {
      summaryCalls += 1;
      return "systems 1";
    }
  };
  runtime.scene = {
    taskRevealCinematic: null,
    registry: { get: () => false },
    updateCameraForLayer() {},
    outskirtsSystem: { updatePresentation() {} },
    objectiveMarkerSystem: { update() {} },
    time: { now: 0 },
    drawPromptMarker() {},
    npcSystem: { spatial: { size: () => 72 } },
    statePublisher: {
      setMany(values) {
        if (Object.hasOwn(values, "runtimeDiagnostics")) diagnosticsPublishes += 1;
        if (Object.hasOwn(values, "performanceText")) performancePublishes += 1;
      }
    },
    publishState() {
      publishStateCalls += 1;
    }
  };

  runtime.finishFrame();
  runtime.finishFrame();
  assert.equal(diagnosticsPublishes, 1);
  assert.equal(summaryCalls, 1);
  assert.equal(performancePublishes, 2);
  assert.equal(publishStateCalls, 2);

  currentSnapshot = { serial: 2 };
  runtime.finishFrame();
  assert.equal(diagnosticsPublishes, 2);
  assert.equal(summaryCalls, 2);
  assert.equal(performancePublishes, 3);
  assert.equal(publishStateCalls, 3);
});

test("browser performance capture persists machine-readable CI evidence", () => {
  const captureSpec = source("tests/browser/runtime-performance-capture.spec.js");
  const workflow = source(".github/workflows/tests.yml");

  assert.match(captureSpec, /NBD_PERF_CAPTURE=/);
  assert.match(captureSpec, /runtime-performance-capture\.json/);
  assert.match(captureSpec, /writeFile\(PERFORMANCE_CAPTURE_PATH/);
  assert.match(workflow, /Upload performance capture evidence/);
  assert.match(workflow, /runtime-performance-capture-shard-\$\{\{ matrix\.shard \}\}/);
  assert.match(workflow, /if-no-files-found:\s*ignore/);
});
