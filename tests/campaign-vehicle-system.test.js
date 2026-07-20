import test from "node:test";
import assert from "node:assert/strict";

import { vehicleDefinitions, VEHICLE_OWNERSHIP } from "../phaser/src/data/vehicles.js";
import { CampaignVehicleSystem } from "../phaser/src/vehicles/CampaignVehicleSystem.js";

function makeState() {
  return {
    world: {
      ownedVehicles: [],
      flags: {}
    }
  };
}

function makeSystem() {
  const state = makeState();
  const emitted = [];
  const system = new CampaignVehicleSystem(state, {
    now: () => 1234,
    events: { emit(type, payload) { emitted.push({ type, payload }); } }
  });
  return { state, emitted, system };
}

test("authored starter ownership is persistent and theft changes status", () => {
  const context = makeSystem();
  assert.equal(context.system.ensureStartingOwnership(vehicleDefinitions), true);
  assert.equal(context.system.status("refuge_compact"), VEHICLE_OWNERSHIP.OWNED);
  assert.ok(context.state.world.ownedVehicles.includes("refuge_compact"));

  const sedan = vehicleDefinitions.find(vehicle => vehicle.id === "market_sedan");
  assert.equal(context.system.status(sedan), VEHICLE_OWNERSHIP.PARKED);
  assert.equal(context.system.markStolen(sedan.id, { factionId: sedan.factionId }), VEHICLE_OWNERSHIP.STOLEN);
  assert.equal(context.system.status(sedan), VEHICLE_OWNERSHIP.STOLEN);
  assert.equal(context.state.world.flags["vehicle.market_sedan.stolenAt"], 1234);
  assert.ok(context.emitted.some(event => event.type === "vehicle:ownership-changed"));
});

test("vehicle condition and trunk storage serialize through primitive world flags", () => {
  const context = makeSystem();
  const compact = vehicleDefinitions.find(vehicle => vehicle.id === "refuge_compact");
  context.system.updateCondition(compact.id, {
    x: 333.25,
    y: 325.5,
    angle: 0.4,
    health: 51,
    parked: false
  });
  const condition = context.system.condition(compact);
  assert.deepEqual(condition, {
    x: 333.25,
    y: 325.5,
    angle: 0.4,
    health: 51,
    disabled: false,
    parked: false
  });

  assert.deepEqual(context.system.storeItem(compact.id, "camera_case", 2).items, ["camera_case"]);
  assert.deepEqual(context.system.storeItem(compact.id, "blood_bag", 2).items, ["camera_case", "blood_bag"]);
  assert.throws(
    () => context.system.storeItem(compact.id, "spare_weapon", 2),
    error => error?.code === "TRUNK_FULL"
  );
  assert.deepEqual(context.system.removeItem(compact.id, "camera_case", 2).items, ["blood_bag"]);
  assert.equal(typeof context.state.world.flags["vehicle.refuge_compact.trunk"], "string");
});
