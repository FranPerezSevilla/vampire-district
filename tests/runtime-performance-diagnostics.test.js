import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RuntimeDiagnostics } from "../phaser/src/runtime/RuntimeDiagnostics.js";

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
