import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";
import {
  findStaticHitscanImpact,
  findVehicleHitscanImpact,
  rayOrientedRectDistance,
  resolveHitscanWorldImpact
} from "../phaser/src/combat/HitscanWorldCollision.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

test("bulletHitWorld registers a real one-shot and procedural fallback", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.bulletHitWorld.files, [
    "phaser/assets/audio/combat/bullet-hit-world-01.mp3"
  ]);
  const data = readFileSync(repoFile(SAMPLE_AUDIO_CATALOG.bulletHitWorld.files[0]));
  assert.ok(data.length > 5_000);
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /case "bulletHitWorld": return this\.bulletHitWorldFallback\(\)/);
});

test("ray collision resolves an oriented vehicle in front of the shooter", () => {
  const vehicle = {
    id: "test-car",
    x: 50,
    y: 0,
    angle: 0,
    layer: 0,
    archetype: { width: 20, height: 10 }
  };
  assert.equal(rayOrientedRectDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, vehicle, 100), 40);
  const hit = findVehicleHitscanImpact({
    origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, range: 100, layer: 0, vehicles: [vehicle]
  });
  assert.equal(hit.vehicle.id, "test-car");
  assert.equal(hit.distance, 40);
});

test("static collision is refined and the nearest world target wins", () => {
  const pointClear = (_layer, x) => x < 80;
  const wall = findStaticHitscanImpact({
    origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, range: 100, layer: 0, pointClear
  });
  assert.ok(Math.abs(wall.distance - 80) < 0.05);

  const vehicle = { id: "near-car", x: 50, y: 0, angle: 0, layer: 0, archetype: { width: 20, height: 10 } };
  const nearest = resolveHitscanWorldImpact({
    origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, range: 100, layer: 0, pointClear, vehicles: [vehicle]
  });
  assert.equal(nearest.kind, "vehicle");
  assert.equal(nearest.vehicle.id, "near-car");
});

test("CombatSystem resolves the travelling projectile against world and vehicles before NPCs", () => {
  const combat = source("phaser/src/combat/CombatSystem.js");
  assert.match(combat, /resolveHitscanWorldImpact\(/);
  assert.match(combat, /worldImpact\.distance <= selectedDistance/);
  assert.match(combat, /advanceBallisticProjectile\(projectile, dt\)/);
  assert.match(combat, /minimumVehicleDistance: 0/);
  assert.match(combat, /RawAudio\.play\("bulletHitWorld"/);
  assert.match(combat, /"vehicle:bullet-hit"/);
  assert.match(combat, /"traffic:bullet-hit"/);
  assert.match(combat, /"combat:world-hit"/);
  assert.doesNotMatch(combat, /this\.attack\.tracer = endpoint/);
});
