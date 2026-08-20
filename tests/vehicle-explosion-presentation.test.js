import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RawAudio } from "../phaser/src/systems/RawAudioSystem.js";
import {
  VEHICLE_EXPLOSION_PRESENTATION,
  installVehicleExplosionPresentation,
  presentVehicleExplosion
} from "../phaser/src/vehicles/VehicleExplosionPresentation.js";

function mockDisplayObject(kind, values = {}) {
  return {
    kind,
    destroyed: false,
    ...values,
    setDepth(value) { this.depth = value; return this; },
    setStrokeStyle(width, color, alpha) { this.stroke = { width, color, alpha }; return this; },
    setRotation(value) { this.rotation = value; return this; },
    destroy() { this.destroyed = true; }
  };
}

function mockScene() {
  const circles = [];
  const rectangles = [];
  const tweens = [];
  const delayedCalls = [];
  const events = new EventEmitter();
  const scene = {
    events,
    add: {
      circle(x, y, radius, color, alpha) {
        const object = mockDisplayObject("circle", { x, y, radius, color, alpha });
        circles.push(object);
        return object;
      },
      rectangle(x, y, width, height, color, alpha) {
        const object = mockDisplayObject("rectangle", { x, y, width, height, color, alpha });
        rectangles.push(object);
        return object;
      }
    },
    tweens: {
      add(config) {
        tweens.push(config);
        return config;
      }
    },
    time: {
      delayedCall(delay, callback) {
        const call = { delay, callback };
        delayedCalls.push(call);
        return call;
      }
    }
  };
  return { scene, circles, rectangles, tweens, delayedCalls };
}

test("vehicle explosion creates a distinct boom, flash, pressure ring, smoke and debris then cleans up", () => {
  const fixture = mockScene();
  const audioCalls = [];
  const originalPlay = RawAudio.play;
  RawAudio.play = (name, options) => audioCalls.push({ name, options });

  try {
    const presentation = presentVehicleExplosion(fixture.scene, { vehicleId: "sedan_01", x: 240, y: 180 });

    assert.deepEqual(audioCalls.map(call => call.name), ["vehicleCollisionHeavy", "kill", "breakLight"]);
    assert.equal(fixture.circles.length, 7, "core + fire + pressure ring + four smoke puffs");
    assert.equal(fixture.rectangles.length, VEHICLE_EXPLOSION_PRESENTATION.debrisCount);
    assert.equal(presentation.objects.length, 7 + VEHICLE_EXPLOSION_PRESENTATION.debrisCount);
    assert.ok(fixture.tweens.length >= presentation.objects.length, "every visible explosion element animates");

    const cleanupCall = fixture.delayedCalls.find(call => call.delay === VEHICLE_EXPLOSION_PRESENTATION.cleanupMs);
    assert.ok(cleanupCall, "presentation schedules deterministic cleanup");
    cleanupCall.callback();
    assert.ok(presentation.objects.every(object => object.destroyed), "temporary blast objects are destroyed");
  } finally {
    RawAudio.play = originalPlay;
  }
});

test("vehicle explosion event presentation is guarded against duplicate per-frame emission", () => {
  const fixture = mockScene();
  const audioCalls = [];
  const originalPlay = RawAudio.play;
  RawAudio.play = name => audioCalls.push(name);

  try {
    const remove = installVehicleExplosionPresentation(fixture.scene);
    const payload = { vehicleId: "compact_02", x: 120, y: 90 };

    fixture.scene.events.emit("vehicle:exploded", payload);
    fixture.scene.events.emit("vehicle:exploded", payload);
    assert.equal(audioCalls.length, 3, "duplicate event inside guard window does not replay the blast");

    const release = fixture.delayedCalls.find(call => call.delay === VEHICLE_EXPLOSION_PRESENTATION.duplicateGuardMs);
    assert.ok(release, "duplicate guard is temporary rather than permanent vehicle-id suppression");
    release.callback();
    fixture.scene.events.emit("vehicle:exploded", payload);
    assert.equal(audioCalls.length, 6, "a future legitimate explosion after state reuse may present again");

    remove();
    fixture.scene.events.emit("vehicle:exploded", payload);
    assert.equal(audioCalls.length, 6, "scene cleanup removes the event listener");
  } finally {
    RawAudio.play = originalPlay;
  }
});

test("VehicleSystem keeps one authoritative explosion event behind the exploded-state guard", () => {
  const source = readFileSync(new URL("../phaser/src/vehicles/VehicleSystem.js", import.meta.url), "utf8");
  const start = source.indexOf("  explodeVehicle(vehicle,");
  const end = source.indexOf("\n  syncFromCampaign(", start);
  assert.ok(start >= 0 && end > start, "explodeVehicle method is discoverable");
  const method = source.slice(start, end);

  const guardIndex = method.indexOf("if (!vehicle || vehicle.exploded) return false;");
  const eventIndex = method.indexOf('events?.emit?.("vehicle:exploded"');
  assert.ok(guardIndex >= 0, "exploded vehicles are rejected before any repeat work");
  assert.ok(eventIndex > guardIndex, "authoritative event is emitted only after the one-shot guard");
  assert.equal((method.match(/events\?\.emit\?\.\("vehicle:exploded"/g) || []).length, 1);

  const gameSceneSource = readFileSync(new URL("../phaser/src/scenes/GameScene.js", import.meta.url), "utf8");
  assert.match(gameSceneSource, /installVehicleExplosionPresentation\(this\)/,
    "the game scene installs presentation as a listener instead of duplicating damage authority");
});
