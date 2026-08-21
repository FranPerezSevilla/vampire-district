import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

test("local traffic assignment composes macro route continuity before lifecycle retention", async () => {
  const source = await readFile(new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT), "utf8");
  assert.equal(source.includes("installMacroTrafficRouteContinuityPolicy"), true);
  assert.equal(source.includes("installTrafficLifecyclePolicy"), true);
  assert.ok(source.indexOf("installMacroTrafficRouteContinuityPolicy") < source.lastIndexOf("installTrafficLifecyclePolicy(materializer)"));
});

test("intent driving explicitly preserves physical state across edge handoff", async () => {
  const source = await readFile(new URL("phaser/src/streaming/TrafficIntentDrivingPolicy.js", ROOT), "utf8");
  assert.equal(source.includes("edgeChanged"), true);
  assert.equal(source.includes("behaviorState.visualTravel = finite(slot.phase)"), true);
  assert.equal(source.includes("junctionHandoffs"), true);
  assert.equal(source.includes('"intent-junction-handoff"'), true);
});
