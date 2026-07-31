import test from "node:test";
import assert from "node:assert/strict";

import { heatLevelFromValue } from "../phaser/src/data/attention.js";
import {
  chooseVehicleExitPoint,
  vehicleExitPointHasClearStep
} from "../phaser/src/vehicles/VehicleInteractions.js";
import {
  PEDESTRIAN_IMPACT_BURST_WINDOW_MS,
  planVehiclePedestrianImpactHeat,
  vehiclePedestrianBurstCeiling
} from "../phaser/src/vehicles/VehiclePedestrianImpactPolicy.js";

function applyImpactSequence({ startHeat = 0, lethal = true, count = 3, startAt = 0, stepMs = 500 } = {}) {
  let state = null;
  let heat = startHeat;
  const plans = [];
  for (let index = 0; index < count; index++) {
    const plan = planVehiclePedestrianImpactHeat(state, {
      nowMs: startAt + index * stepMs,
      districtId: "old-quarter",
      currentHeat: heat,
      lethal
    });
    state = plan.state;
    heat += plan.heat;
    plans.push(plan);
  }
  return { state, heat, plans };
}

test("rapid pedestrian impacts use diminishing Heat instead of jumping straight to Wanted 3", () => {
  const result = applyImpactSequence({ lethal: true, count: 3 });
  assert.deepEqual(result.plans.map(plan => plan.heat), [18, 10, 6]);
  assert.equal(result.heat, 34);
  assert.equal(heatLevelFromValue(result.heat), 1);
  assert.equal(result.plans.at(-1).chainCount, 3);
});

test("one rapid impact burst cannot climb more than one Wanted band by itself", () => {
  const fromClear = applyImpactSequence({ startHeat: 0, lethal: true, count: 12 });
  assert.equal(fromClear.heat, vehiclePedestrianBurstCeiling(0));
  assert.equal(fromClear.heat, 44);
  assert.equal(heatLevelFromValue(fromClear.heat), 1);
  assert.ok(fromClear.plans.some(plan => plan.suppressedHeat > 0));

  const fromWantedOne = applyImpactSequence({ startHeat: 30, lethal: true, count: 12 });
  assert.equal(fromWantedOne.heat, vehiclePedestrianBurstCeiling(30));
  assert.equal(fromWantedOne.heat, 74);
  assert.equal(heatLevelFromValue(fromWantedOne.heat), 2);
});

test("a later separate incident can escalate the response again", () => {
  const first = applyImpactSequence({ lethal: true, count: 3 });
  const later = planVehiclePedestrianImpactHeat(first.state, {
    nowMs: PEDESTRIAN_IMPACT_BURST_WINDOW_MS + 1500,
    districtId: "old-quarter",
    currentHeat: first.heat,
    lethal: true
  });

  assert.equal(later.continuesBurst, false);
  assert.equal(later.chainCount, 1);
  assert.equal(later.heat, 18);
  assert.equal(heatLevelFromValue(first.heat + later.heat), 2);
});

test("non-lethal impacts also diminish but remain lower than fatalities", () => {
  const result = applyImpactSequence({ lethal: false, count: 4 });
  assert.deepEqual(result.plans.map(plan => plan.heat), [10, 6, 4, 2]);
  assert.equal(result.heat, 22);
  assert.equal(heatLevelFromValue(result.heat), 1);
});

test("vehicle exit selection requires both a valid landing point and a movement escape step", () => {
  const vehicle = {
    x: 100,
    y: 100,
    angle: 0,
    archetype: { width: 30, height: 14 }
  };
  const system = {
    scene: {
      canStandAt(x, y) {
        return x >= 120 && x <= 150 && y >= 86 && y <= 114;
      }
    }
  };

  const exit = chooseVehicleExitPoint(system, vehicle);
  assert.ok(exit);
  assert.ok(exit.x > vehicle.x);
  assert.equal(vehicleExitPointHasClearStep(system, vehicle, exit), true);
});

test("an isolated pixel-sized exit is rejected instead of trapping the player", () => {
  const vehicle = {
    x: 100,
    y: 100,
    angle: 0,
    archetype: { width: 30, height: 14 }
  };
  const system = {
    scene: {
      canStandAt(x, y) {
        return Math.abs(x - 131) < 0.01 && Math.abs(y - 100) < 0.01;
      }
    }
  };

  assert.equal(chooseVehicleExitPoint(system, vehicle), null);
});
