import test from "node:test";
import assert from "node:assert/strict";

import { CampaignEventBus } from "../phaser/src/campaign/CampaignEventBus.js";
import { createCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { WalletSystem } from "../phaser/src/campaign/WalletSystem.js";
import { REFUGE_GARAGE } from "../phaser/src/data/vehicle-maintenance.js";
import { vehicleDefinitions } from "../phaser/src/data/vehicles.js";
import { CampaignVehicleSystem } from "../phaser/src/vehicles/CampaignVehicleSystem.js";
import { VehicleMaintenanceService } from "../phaser/src/vehicles/VehicleMaintenanceService.js";

function setup({ cash = 0 } = {}) {
  let clock = 1000;
  const now = () => ++clock;
  const state = createCampaignState({ now: now() });
  const events = new CampaignEventBus(state, { now });
  const wallet = new WalletSystem(state, { events, now });
  const vehicles = new CampaignVehicleSystem(state, { events, now });
  vehicles.ensureStartingOwnership(vehicleDefinitions);
  const service = new VehicleMaintenanceService(state, {
    wallet,
    vehicles,
    definitions: vehicleDefinitions,
    events,
    now
  });
  if (cash > 0) wallet.credit(cash, { source: "test", reason: "setup" });
  return { state, events, wallet, vehicles, service };
}

function setCompact(vehicles, condition) {
  vehicles.updateCondition("refuge_compact", {
    x: REFUGE_GARAGE.x,
    y: REFUGE_GARAGE.y,
    angle: 0,
    parked: true,
    ...condition
  });
}

test("maintenance quote uses missing hull and archetype rate", () => {
  const { vehicles, service } = setup({ cash: 500 });
  setCompact(vehicles, { health: 50 });
  const quote = service.quote("refuge_compact");
  assert.equal(quote.action, "repair");
  assert.equal(quote.health, 50);
  assert.equal(quote.maxHealth, 72);
  assert.equal(quote.missingHealth, 22);
  assert.equal(quote.cost, 66);
  assert.equal(quote.atGarage, true);
  assert.equal(quote.available, true);
});

test("repair debits once, restores full hull and records one maintenance event", () => {
  const { state, events, wallet, vehicles, service } = setup({ cash: 500 });
  setCompact(vehicles, { health: 50 });
  const completed = [];
  const walletEvents = [];
  events.on("vehicle:maintenance-completed", event => completed.push(event));
  events.on("wallet:changed", event => walletEvents.push(event));
  const ledgerBefore = state.ledger.length;

  const result = service.repair("refuge_compact");
  const condition = vehicles.condition(vehicleDefinitions.find(vehicle => vehicle.id === "refuge_compact"));

  assert.equal(result.changed, true);
  assert.equal(result.code, "VEHICLE_REPAIRED");
  assert.equal(result.cost, 66);
  assert.equal(condition.health, 72);
  assert.equal(wallet.balance(), 434);
  assert.equal(state.ledger.length, ledgerBefore + 1);
  assert.equal(state.ledger.at(-1).source, "vehicle-maintenance");
  assert.equal(state.ledger.at(-1).reason, "repair");
  assert.equal(state.ledger.at(-1).metadata.healthBefore, 50);
  assert.equal(state.ledger.at(-1).metadata.healthAfter, 72);
  assert.equal(completed.length, 1);
  assert.equal(walletEvents.length, 0);

  const ledgerAfterRepair = state.ledger.length;
  const balanceAfterRepair = wallet.balance();
  const repeated = service.repair("refuge_compact");
  assert.equal(repeated.changed, false);
  assert.equal(repeated.code, "VEHICLE_REPAIR_NOT_NEEDED");
  assert.equal(state.ledger.length, ledgerAfterRepair);
  assert.equal(wallet.balance(), balanceAfterRepair);
  assert.equal(completed.length, 1);
});

test("repair rejects insufficient cash without mutating vehicle or ledger", () => {
  const { state, wallet, vehicles, service } = setup();
  setCompact(vehicles, { health: 10 });
  const ledgerBefore = state.ledger.length;
  assert.throws(
    () => service.repair("refuge_compact"),
    error => error.code === "INSUFFICIENT_CASH"
  );
  const condition = vehicles.condition(vehicleDefinitions.find(vehicle => vehicle.id === "refuge_compact"));
  assert.equal(condition.health, 10);
  assert.equal(wallet.balance(), 0);
  assert.equal(state.ledger.length, ledgerBefore);
});

test("repair requires a parked owned vehicle inside the refuge garage", () => {
  const { vehicles, service } = setup({ cash: 500 });
  setCompact(vehicles, { health: 40, x: 1000, y: 760, parked: true });
  assert.throws(
    () => service.repair("refuge_compact"),
    error => error.code === "VEHICLE_SERVICE_UNAVAILABLE" && /garage/i.test(error.message)
  );
  setCompact(vehicles, { health: 40, parked: false });
  assert.throws(
    () => service.repair("refuge_compact"),
    error => error.code === "VEHICLE_SERVICE_UNAVAILABLE" && /park/i.test(error.message)
  );
});

test("maintenance rejects non-owned vehicles before returning a no-op", () => {
  const { service } = setup({ cash: 500 });
  assert.throws(
    () => service.repair("market_sedan"),
    error => error.code === "VEHICLE_NOT_OWNED"
  );
  assert.throws(
    () => service.recover("market_sedan"),
    error => error.code === "VEHICLE_NOT_OWNED"
  );
});

test("recovery tows an owned wreck to its garage slot with minimum drivable hull", () => {
  const { state, events, wallet, vehicles, service } = setup({ cash: 500 });
  setCompact(vehicles, { health: 0, x: 1400, y: 760, angle: 1.2, parked: true });
  const completed = [];
  events.on("vehicle:maintenance-completed", event => completed.push(event));

  const result = service.recover("refuge_compact");
  const definition = vehicleDefinitions.find(vehicle => vehicle.id === "refuge_compact");
  const condition = vehicles.condition(definition);

  assert.equal(result.changed, true);
  assert.equal(result.code, "VEHICLE_RECOVERED");
  assert.equal(result.cost, 120);
  assert.equal(result.healthAfter, 26);
  assert.equal(condition.health, 26);
  assert.equal(condition.disabled, false);
  assert.equal(condition.x, REFUGE_GARAGE.x);
  assert.equal(condition.y, REFUGE_GARAGE.y);
  assert.equal(condition.angle, 0);
  assert.equal(condition.parked, true);
  assert.equal(wallet.balance(), 380);
  assert.equal(state.ledger.at(-1).reason, "recover");
  assert.equal(completed.length, 1);

  const ledgerAfterRecovery = state.ledger.length;
  const repeated = service.recover("refuge_compact");
  assert.equal(repeated.changed, false);
  assert.equal(repeated.code, "VEHICLE_RECOVERY_NOT_NEEDED");
  assert.equal(state.ledger.length, ledgerAfterRecovery);
  assert.equal(wallet.balance(), 380);
});

test("a failed condition update rolls back the silent debit and ledger", () => {
  const { state, wallet, vehicles, service } = setup({ cash: 500 });
  setCompact(vehicles, { health: 50 });
  const balanceBefore = wallet.balance();
  const ledgerBefore = structuredClone(state.ledger);
  const flagsBefore = structuredClone(state.world.flags);
  service.vehicles.updateCondition = () => {
    throw new Error("synthetic condition failure");
  };

  assert.throws(() => service.repair("refuge_compact"), /synthetic condition failure/);
  assert.equal(wallet.balance(), balanceBefore);
  assert.deepEqual(state.ledger, ledgerBefore);
  assert.deepEqual(state.world.flags, flagsBefore);
});
