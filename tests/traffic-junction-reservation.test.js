import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseJunctionReservationOwner,
  junctionReservationHasStalled
} from "../phaser/src/policies/TrafficJunctionReservationPolicy.js";
import { chooseTrafficSeparationLoser } from "../phaser/src/policies/TrafficPlaytestPolicy.js";

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
