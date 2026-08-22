import assert from "node:assert/strict";
import test from "node:test";

import {
  VEHICLE_CONTACT_SHADOW_PRESENTATION,
  createVehicleContactShadow,
  vehicleContactShadowSpec
} from "../phaser/src/vehicles/VehicleGroundingPresentation.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function fakeScene() {
  const created = [];
  return {
    created,
    add: {
      ellipse(x, y, width, height, color, alpha) {
        const shape = {
          kind: "ellipse",
          x,
          y,
          width,
          height,
          color,
          alpha,
          name: "",
          setName(name) {
            this.name = name;
            return this;
          }
        };
        created.push(shape);
        return shape;
      }
    }
  };
}

test("vehicle contact shadow geometry is deterministic, restrained and footprint-derived", () => {
  const archetype = { id: "sedan", width: 34, height: 16, vehicleClass: "civilian" };
  const before = snapshot(archetype);
  const first = vehicleContactShadowSpec(archetype);
  const second = vehicleContactShadowSpec(archetype);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(archetype), before);
  assert.ok(Object.isFrozen(first));
  assert.equal(first.family, "vehicle-contact-shadow");
  assert.ok(first.alpha > 0.1 && first.alpha <= 0.2);
  assert.ok(first.width >= archetype.width * 0.85 && first.width <= archetype.width * 0.95);
  assert.ok(first.height >= archetype.height * 0.6 && first.height <= archetype.height * 0.75);
  assert.ok(first.x > 0 && first.x < 2);
  assert.ok(first.y > 0 && first.y < 2.5);
});

test("civilian and police archetypes use the same grounding rule", () => {
  const civilian = vehicleContactShadowSpec({ width: 38, height: 20, vehicleClass: "civilian", bodyStyle: "suv" });
  const police = vehicleContactShadowSpec({ width: 38, height: 20, vehicleClass: "police", bodyStyle: "police-suv" });
  assert.deepEqual(civilian, police);
});

test("larger vehicles receive a larger but still shallow contact footprint", () => {
  const compact = vehicleContactShadowSpec({ width: 28, height: 14 });
  const van = vehicleContactShadowSpec({ width: 40, height: 19 });
  assert.ok(van.width > compact.width);
  assert.ok(van.height > compact.height);
  assert.ok(van.height < 14);
  assert.equal(VEHICLE_CONTACT_SHADOW_PRESENTATION.alpha, 0.17);
});

test("creation emits exactly one named ellipse and does not mutate archetype data", () => {
  const scene = fakeScene();
  const archetype = { id: "police", width: 36, height: 18, vehicleClass: "police" };
  const before = snapshot(archetype);
  const shadow = createVehicleContactShadow(scene, archetype);

  assert.equal(scene.created.length, 1);
  assert.equal(scene.created[0], shadow);
  assert.equal(shadow.kind, "ellipse");
  assert.equal(shadow.name, "vehicle-contact-shadow");
  assert.equal(shadow.alpha, VEHICLE_CONTACT_SHADOW_PRESENTATION.alpha);
  assert.deepEqual(snapshot(archetype), before);
});
