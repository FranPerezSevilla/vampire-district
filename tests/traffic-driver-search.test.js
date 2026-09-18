import test from "node:test";
import assert from "node:assert/strict";
import { searchDriverManeuver, planDriverManeuver, advanceDriverSearch } from "../phaser/src/streaming/TrafficDriverController.js";
import { createVehicleState, stepVehicleKinematics } from "../phaser/src/vehicles/VehicleModel.js";
import { trafficVehicleArchetype } from "../phaser/src/data/vehicles.js";
import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";

test("interrupted manoeuvre planning keeps the exact static-scene solution and checks every candidate", () => {
  const archetype = trafficVehicleArchetype("search");
  const pose = createVehicleState({ id: "search", x: 0, y: 0, angle: 0 }, archetype);
  const obstacle = { x: 48, y: 0, angle: 0, archetype };
  let probes = 0;
  const safe = candidate => { probes++; return Math.abs(candidate.y) < 30 && !orientedVehicleContact({ ...candidate, archetype }, obstacle); };
  const request = { pose, archetype, goal: { x: 125, y: 0, angle: 0 }, safe };
  const expected = planDriverManeuver(request), search = searchDriverManeuver(request);
  assert.ok(expected);
  let result, slices = 0;
  do {
    const before = probes;
    result = advanceDriverSearch(search, { maxSteps: 7, now: () => 0 });
    assert.ok(probes - before <= 7);
    assert.ok(++slices < 10000);
  } while (!result.done);
  assert.ok(slices > 1);
  assert.deepEqual(result.value, expected);
  let next = pose;
  for (const frame of result.value.frames) {
    next = stepVehicleKinematics(next, frame, result.value.frameSeconds, archetype);
    assert.ok(safe(next));
  }
  assert.ok(Math.hypot(next.x - 125, next.y) < 13);
});

test("a search yields when its time budget expires, without consuming the rest of its probe quota", () => {
  let work = 0, clock = 0;
  function* search() { while (work < 20) { work++; clock += 0.6; yield; } return "finished"; }
  const iterator = search();
  assert.equal(advanceDriverSearch(iterator, { budgetMs: 1, maxSteps: 100, now: () => clock }).done, false);
  assert.equal(work, 2);
  assert.equal(advanceDriverSearch(iterator, { budgetMs: 20, now: () => clock }).value, "finished");
});
