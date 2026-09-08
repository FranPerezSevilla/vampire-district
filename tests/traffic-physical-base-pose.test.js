import test from "node:test";
import assert from "node:assert/strict";

import { TrafficPhysicalConsequencesSystem } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";

const routeBaseFor = TrafficPhysicalConsequencesSystem.prototype.routeBaseFor;

test("route-active traffic physics always uses the explicit route base", () => {
  const slot = {
    routeActive: true,
    routeBaseX: 100,
    routeBaseY: 50,
    routeBaseAngle: 0.25,
    physicalOffsetX: 12,
    physicalOffsetY: -6,
    // Rendered position already contains a physical displacement.
    x: 112,
    y: 44
  };

  const base = routeBaseFor.call({}, slot);

  assert.deepEqual(base, {
    x: 100,
    y: 50
  });
});

test("fallback base removes the already-rendered offset instead of compounding it", () => {
  let slot = {
    routeActive: false,
    x: 112,
    y: 44,
    angle: 0.25,
    physicalOffsetX: 12,
    physicalOffsetY: -6
  };

  for (let frame = 0; frame < 20; frame++) {
    const base = routeBaseFor.call({}, slot);
    assert.equal(base.x, 100);
    assert.equal(base.y, 50);

    // Simulate the physical system composing the same offset for another frame.
    slot = {
      ...slot,
      x: base.x + slot.physicalOffsetX,
      y: base.y + slot.physicalOffsetY
    };
  }

  assert.equal(slot.x, 112);
  assert.equal(slot.y, 44);
});
