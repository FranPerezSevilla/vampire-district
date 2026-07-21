import test from "node:test";
import assert from "node:assert/strict";

import {
  STREET_PROP_IMPACT,
  STREET_PROP_TYPES,
  impactBreaksDumpster,
  impactBreaksStreetlight,
  pointHitsVehicleFootprint,
  vehiclePropImpactResult
} from "../phaser/src/systems/StreetFurnitureModel.js";

test("streetlights break before heavy dumpsters", () => {
  assert.equal(impactBreaksStreetlight(STREET_PROP_IMPACT.streetlightBreakSpeed - 0.1), false);
  assert.equal(impactBreaksStreetlight(STREET_PROP_IMPACT.streetlightBreakSpeed), true);
  assert.equal(impactBreaksDumpster(STREET_PROP_IMPACT.dumpsterBreakSpeed - 0.1), false);
  assert.equal(impactBreaksDumpster(STREET_PROP_IMPACT.dumpsterBreakSpeed), true);
  assert.ok(STREET_PROP_IMPACT.dumpsterBreakSpeed > STREET_PROP_IMPACT.streetlightBreakSpeed);
});

test("low-speed furniture impacts block while high-speed impacts break and damage the vehicle", () => {
  assert.deepEqual(vehiclePropImpactResult(STREET_PROP_TYPES.STREETLIGHT, 5), {
    breaks: false,
    blocks: true,
    vehicleDamage: 0
  });
  assert.deepEqual(vehiclePropImpactResult(STREET_PROP_TYPES.STREETLIGHT, 30), {
    breaks: true,
    blocks: false,
    vehicleDamage: STREET_PROP_IMPACT.streetlightVehicleDamage
  });
  assert.deepEqual(vehiclePropImpactResult(STREET_PROP_TYPES.DUMPSTER, 50), {
    breaks: true,
    blocks: false,
    vehicleDamage: STREET_PROP_IMPACT.dumpsterVehicleDamage
  });
});

test("street furniture collision accepts any sampled vehicle footprint point", () => {
  const footprint = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 }
  ];
  assert.equal(pointHitsVehicleFootprint({ x: 21, y: 20 }, footprint, 2), true);
  assert.equal(pointHitsVehicleFootprint({ x: 30, y: 30 }, footprint, 2), false);
});
