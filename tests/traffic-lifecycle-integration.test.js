import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

test("local traffic assignment keeps lifecycle retention without installing macro or legacy junction routing", async () => {
  const source = await readFile(new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT), "utf8");
  assert.equal(source.includes("installTrafficLifecyclePolicy"), true);
  assert.equal(source.includes("installMacroTrafficRouteContinuityPolicy"), false);
  assert.equal(source.includes("installTrafficLaneJunctionTopologyPolicy"), false);
  assert.equal(source.includes('legacyEndpointJunctionInferenceActive: false'), true);
  assert.equal(source.includes('laneAuthority: "authored-local-lanes"'), true);
  assert.equal(source.includes("compilerLocalTopology"), true);
});

test("runtime does not install free-form intent driving until lane-level junctions exist", async () => {
  const source = await readFile(new URL("phaser/src/runtime/GameplayRuntime.js", ROOT), "utf8");
  assert.equal(source.includes("installTrafficIntentDrivingPolicy"), false);
  assert.equal(source.includes("trafficIntentDrivingPolicy ="), false);
  assert.equal(source.includes("authored lane geometry"), true);
});
