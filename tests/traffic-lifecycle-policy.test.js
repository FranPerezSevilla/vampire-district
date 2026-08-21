import test from "node:test";
import assert from "node:assert/strict";

import {
  lifecycleProtectsFromDespawn,
  TRAFFIC_LIFECYCLE_STATES,
  trafficLifecycleState
} from "../phaser/src/streaming/TrafficLifecyclePolicy.js";

test("junction approach and crossing are explicit protected lifecycle states", () => {
  assert.equal(trafficLifecycleState({ phase: 0.88, visible: true }), TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION);
  assert.equal(trafficLifecycleState({ phase: 0.03, edgeChanged: true }), TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION);
  assert.equal(lifecycleProtectsFromDespawn(TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION), true);
  assert.equal(lifecycleProtectsFromDespawn(TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION), true);
});

test("recently visible traffic stays protected after leaving the viewport", () => {
  const state = trafficLifecycleState({ phase: 0.45, visible: false, recentVisibleSeconds: 1.7 });
  assert.equal(state, TRAFFIC_LIFECYCLE_STATES.RECENTLY_VISIBLE);
  assert.equal(lifecycleProtectsFromDespawn(state), true);
});

test("only traffic that has genuinely left the view lifecycle becomes despawn eligible", () => {
  const state = trafficLifecycleState({ phase: 0.45, visible: false, recentVisibleSeconds: 0 });
  assert.equal(state, TRAFFIC_LIFECYCLE_STATES.LEAVING_VIEW);
  assert.equal(lifecycleProtectsFromDespawn(state), false);
});

test("active driving situations outrank camera lifecycle states", () => {
  assert.equal(
    trafficLifecycleState({ phase: 0.4, behaviorReason: "steering-around-parked", visible: false }),
    TRAFFIC_LIFECYCLE_STATES.AVOIDING
  );
  assert.equal(
    trafficLifecycleState({ phase: 0.4, behaviorReason: "traffic", visible: false }),
    TRAFFIC_LIFECYCLE_STATES.FOLLOWING
  );
  assert.equal(
    trafficLifecycleState({ phase: 0.4, behaviorReason: "physical-blocked", visible: false }),
    TRAFFIC_LIFECYCLE_STATES.BLOCKED
  );
});
