import test from "node:test";
import assert from "node:assert/strict";

import { trafficPhysicalBasePose } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";

test("route-active traffic physics always uses the explicit route base", () => {
  const slot = {
    routeActive: true,
    routeBaseX: 100,
    routeBaseY: 50,
    routeBaseAngle: 0.25,
    // Rendered position already contains a physical displacement.
    x: 112,
    y: 44
  };
  const state = { offsetX: 12, offsetY: -6 };

  const base = trafficPhysicalBasePose(slot, state);

  assert.deepEqual(base, {
    x: 100,
    y: 50,
    angle: 0.25,
    authority: "route-base"
  });
});

test("fallback base removes the already-rendered offset instead of compounding it", () => {
  const state = { offsetX: 12, offsetY: -6 };
  let slot = { routeActive: false, x: 112, y: 44, angle: 0.25 };

  for (let frame = 0; frame < 20; frame++) {
    const base = trafficPhysicalBasePose(slot, state);
    assert.equal(base.x, 100);
    assert.equal(base.y, 50);
    assert.equal(base.authority, "rendered-minus-offset");

    // Simulate the physical system composing the same offset for another frame.
    slot = {
      ...slot,
      x: base.x + state.offsetX,
      y: base.y + state.offsetY
    };
  }

  assert.equal(slot.x, 112);
  assert.equal(slot.y, 44);
});
