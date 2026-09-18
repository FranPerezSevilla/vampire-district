import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseJunctionReservationOwner,
  junctionReservationHasStalled
} from "../phaser/src/policies/TrafficJunctionReservationPolicy.js";
import { chooseTrafficSeparationLoser } from "../phaser/src/policies/TrafficPlaytestPolicy.js";
import { installTrafficJunctionReservationPolicy } from "../phaser/src/policies/TrafficJunctionReservationPolicy.js";
import { TrafficLocalBehaviorSystem } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";

function candidate(tokenId, {
  junctionId = "cross",
  laneKey = `lane:${tokenId}`,
  arrivalAt = 0,
  approach = 40,
  inside = false
} = {}) {
  return { tokenId, junctionId, laneKey, arrivalAt, approach, inside };
}

function slot(tokenId, slotIndex = 0) {
  return { tokenId, slotIndex, x: 0, y: 0, radius: 14 };
}

test("a vehicle already inside the junction owns priority over approaching traffic", () => {
  const approaching = candidate("alpha", { arrivalAt: 0, approach: 8 });
  const inside = candidate("bravo", { arrivalAt: 1, approach: 0, inside: true });

  const owner = chooseJunctionReservationOwner([approaching, inside], null, 2);
  assert.equal(owner.tokenId, "bravo");
});

test("junction reservation uses arrival order then a stable token tie-break", () => {
  const late = candidate("alpha", { arrivalAt: 2 });
  const early = candidate("zulu", { arrivalAt: 1 });
  assert.equal(chooseJunctionReservationOwner([late, early], null, 3).tokenId, "zulu");

  const tieB = candidate("bravo", { arrivalAt: 4 });
  const tieA = candidate("alpha", { arrivalAt: 4 });
  assert.equal(chooseJunctionReservationOwner([tieB, tieA], null, 5).tokenId, "alpha");
});

test("a granted movement keeps its short commitment window", () => {
  const alpha = candidate("alpha", { arrivalAt: 2 });
  const bravo = candidate("bravo", { arrivalAt: 1 });
  const reservation = {
    ownerId: "alpha",
    leaseUntil: 6,
    grantedAt: 4,
    lastProgressAt: 4
  };

  assert.equal(
    chooseJunctionReservationOwner([alpha, bravo], reservation, 5).tokenId,
    "alpha"
  );
});

test("a reservation that cannot make progress becomes recoverable after its lease", () => {
  const owner = candidate("alpha", { arrivalAt: 0, approach: 28 });
  const reservation = {
    ownerId: "alpha",
    grantedAt: 0,
    leaseUntil: 1.45,
    lastProgressAt: 0,
    lastApproach: 28
  };

  assert.equal(junctionReservationHasStalled(reservation, owner, 1.4), false);
  assert.equal(junctionReservationHasStalled(reservation, owner, 2.4), true);

  const waiting = candidate("bravo", { arrivalAt: 0.5, approach: 31 });
  const backoffs = new Map([["cross:alpha", 3.3]]);
  assert.equal(
    chooseJunctionReservationOwner([owner, waiting], null, 2.4, backoffs).tokenId,
    "bravo"
  );
});

test("hard separation retreats junction-reserved traffic before the committed movement", () => {
  const reserved = slot("reserved", 0);
  const priority = slot("priority", 1);
  const reservedState = {
    tokenId: reserved.tokenId,
    edgeId: "road-a",
    direction: "forward",
    visualTravel: 0.4,
    reason: "junction-reserved"
  };
  const priorityState = {
    tokenId: priority.tokenId,
    edgeId: "road-b",
    direction: "forward",
    visualTravel: 0.4,
    reason: "junction-priority"
  };

  assert.equal(
    chooseTrafficSeparationLoser(reserved, priority, reservedState, priorityState),
    reserved
  );
});

test("legacy junction reservations stop projecting fully driver-owned traffic and resume for mixed traffic", () => {
  const prototype = TrafficLocalBehaviorSystem.prototype;
  const originals = { update: prototype.update, decisionFor: prototype.decisionFor, snapshot: prototype.snapshot };
  installTrafficJunctionReservationPolicy();
  try {
    let projections = 0;
    const driver = { ...slot("driver"), driverActive: true };
    const legacy = { ...slot("legacy", 1), driverActive: false };
    const system = Object.assign(Object.create(prototype), {
      ready: true, destroyed: false, scene: {},
      materializer: { pool: [driver] },
      states: new Map([[driver.tokenId, { tokenId: driver.tokenId, visualTravel: 0 }],
        [legacy.tokenId, { tokenId: legacy.tokenId, visualTravel: 0 }]]),
      tokenMap: () => new Map([[driver.tokenId, driver], [legacy.tokenId, legacy]]),
      stateFor(slot, token) {
        if (!this.states.has(token.tokenId)) this.states.set(token.tokenId, { tokenId: token.tokenId, visualTravel: 0 });
        return this.states.get(token.tokenId);
      },
      syncAuthority: state => state, decisionFor: () => ({ reason: "cruise" }),
      applyDecision() {}, processPlayerImpact() {}, publish() {},
      laneFor() { projections++; return { length: 100, edgeId: "road", direction: "forward" }; },
      junctionsForLane: () => [{ junction: { id: "cross", x: 0, y: 0, radius: 30, approachDistance: 82 }, projection: { progress: 0.2 } }]
    });
    system.update(0.016);
    assert.equal(projections, 0, "physical authority must not run the old junction planner");
    assert.equal(system.__nbdJunctionReservations.size, 0);
    system.materializer.pool.push(legacy);
    system.update(0.016);
    system.update(0.016); // newly assigned legacy state is created by the first update
    assert.ok(projections > 0, "mixed traffic retains its original projections");
    assert.equal(system.__nbdJunctionCandidatesByToken.size, 2);
    assert.equal(system.__nbdJunctionReservations.size, 1);
    projections = 0;
    legacy.driverActive = true;
    system.update(0.016);
    assert.equal(projections, 0);
    assert.equal(system.__nbdJunctionReservations.size, 0, "retire stale reservations on promotion");
    assert.equal(system.__nbdJunctionArrivals.size, 0);
    legacy.driverActive = false;
    system.update(0.016);
    assert.equal(system.__nbdJunctionReservations.size, 1, "legacy ownership can resume immediately");
  } finally {
    Object.assign(prototype, originals);
    delete prototype.__nbdJunctionReservationPolicy;
  }
});
