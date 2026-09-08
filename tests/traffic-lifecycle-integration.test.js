import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const PRODUCTION_SOURCE_ROOT = fileURLToPath(new URL("phaser/src/", ROOT));
const ISOLATED_LEGACY_MODULES = new Set([
  "MacroTrafficRouteContinuityPolicy.js",
  "TrafficIntentDrivingPolicy.js",
  "TrafficShadowRoutePolicy.js"
]);
const FORBIDDEN_PRODUCTION_REFERENCES = [
  "MacroTrafficRouteContinuityPolicy",
  "TrafficIntentDrivingPolicy",
  "TrafficShadowRoutePolicy"
];

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await javascriptFiles(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(absolute);
    }
  }
  return files;
}

test("local traffic assignment keeps lifecycle retention without superseded route experiments", async () => {
  const source = await readFile(new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT), "utf8");
  assert.equal(source.includes("installTrafficLifecyclePolicy"), true);
  assert.equal(source.includes("installMacroTrafficRouteContinuityPolicy"), false);
  assert.equal(source.includes("installTrafficLaneJunctionTopologyPolicy"), false);
  assert.equal(source.includes("installTrafficShadowRoutePolicy"), false);
  assert.equal(source.includes("shadowRouteContinuity"), false);
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

test("superseded traffic experiments have no live production references", async () => {
  const files = await javascriptFiles(PRODUCTION_SOURCE_ROOT);
  const offenders = [];

  for (const filename of files) {
    if (ISOLATED_LEGACY_MODULES.has(path.basename(filename))) continue;
    const source = await readFile(filename, "utf8");
    for (const forbidden of FORBIDDEN_PRODUCTION_REFERENCES) {
      if (source.includes(forbidden)) {
        offenders.push(`${path.relative(PRODUCTION_SOURCE_ROOT, filename)} -> ${forbidden}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `superseded traffic policy leaked into production:\n${offenders.join("\n")}`);
});
