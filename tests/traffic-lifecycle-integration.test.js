import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

test("local traffic assignment keeps lifecycle retention without macro or legacy junction routing", async () => {
  const source = await readFile(new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT), "utf8");
  assert.equal(source.includes("installTrafficLifecyclePolicy"), true);
  assert.equal(source.includes("installMacroTrafficRouteContinuityPolicy"), false);
  assert.equal(source.includes("installTrafficLaneJunctionTopologyPolicy"), false);
  assert.equal(source.includes('legacyEndpointJunctionInferenceActive: false'), true);
  assert.equal(source.includes('laneAuthority: multiAgent.enabled ? "compiler-route-lanes" : "authored-local-lanes"'), true);
  assert.equal(source.includes("compilerLocalTopology"), true);
});

test("runtime keeps free-form intent driving disabled after compiler-route default activation", async () => {
  const source = await readFile(new URL("phaser/src/runtime/GameplayRuntime.js", ROOT), "utf8");
  assert.equal(source.includes("installTrafficIntentDrivingPolicy"), false);
  assert.equal(source.includes("trafficIntentDrivingPolicy ="), false);
  assert.equal(source.includes("compiler-owned directed lanes/connectors"), true);
});
