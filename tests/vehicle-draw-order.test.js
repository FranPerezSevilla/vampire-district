import test from 'node:test';
import assert from 'node:assert/strict';
import {updateVehicleDrawOrder} from '../phaser/src/rendering/VehicleDrawOrder.js';

function car(id, y, x = 0) {
  return {id, x, y, container: {
    name: id, x, y, rotation: 0, visible: true, depth: 45.5, writes: 0,
    setDepth(depth) { this.depth = depth; this.writes++; return this; }
  }};
}
function scene(authored = [], traffic = [], police = []) {
  return {vehicleSystem: {vehicles: authored}, trafficMaterializationSystem: {pool: traffic},
    motorizedPoliceSystem: {slots: police}};
}
const names = buffer => buffer.map(c => c.name);

test('authored, driven, ambient, bus, ambulance and police share ground Y order', () => {
  const driven = car('driven', 130), ambulance = car('ambulance', 60);
  const taxi = car('taxi', 140), bus = car('bus', 80), patrol = car('patrol', 110);
  const s = scene([driven, ambulance], [taxi, bus], [patrol]), buffer = [];
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(names(buffer), ['ambulance', 'bus', 'patrol', 'driven', 'taxi']);
  for (let i = 0; i < buffer.length; i++) {
    assert.ok(buffer[i].depth >= 46 && buffer[i].depth < 47, 'remain below actors and architecture');
    if (i) assert.ok(buffer[i].depth > buffer[i - 1].depth);
  }
  // Simulate the final presented positions following recovery/interpolation;
  // stale model coordinates must not reorder the image incorrectly.
  driven.container.y = 50;
  patrol.container.y = 150;
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(names(buffer), ['driven', 'ambulance', 'bus', 'taxi', 'patrol']);
  assert.equal(driven.y, 130, 'render sorting does not change simulation');
});

test('parallel movement, rotations, camera and roof height do not queue depth work', () => {
  const cars = Array.from({length: 80}, (_, i) => car(`car-${i}`, i * 20));
  const s = scene(cars.slice(0, 11), cars.slice(11, 75), cars.slice(75)), buffer = [];
  updateVehicleDrawOrder(s, buffer);
  const writes = cars.map(c => c.container.writes);
  for (let frame = 0; frame < 120; frame++) {
    for (const c of cars) {
      c.container.y += .17;
      c.container.rotation += .01;
    }
    s.cameras = {main: {scrollY: frame * 100, zoom: frame + 1}};
    s.vehicleStackMagnitude = frame % 4;
    updateVehicleDrawOrder(s, buffer);
  }
  assert.deepEqual(cars.map(c => c.container.writes), writes);
  // One crossing changes just the two ranks, not all 80 vehicles.
  cars[30].container.y = cars[31].container.y + .1;
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(cars.filter((c, i) => c.container.writes !== writes[i]).map(c => c.id), ['car-30', 'car-31']);
});

test('hidden slots, reuse, removal and equal-Y ties stay deterministic', () => {
  const a = car('authored', 40, 10), b = car('pool', 40, -10), p = car('patrol', 40, 10);
  const hidden = car('hidden', -100); hidden.container.visible = false;
  const s = scene([a], [b, hidden], [p]), buffer = [];
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(names(buffer), ['pool', 'authored', 'patrol']);
  const depths = buffer.map(c => c.depth);
  for (let i = 0; i < 20; i++) updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(buffer.map(c => c.depth), depths);
  assert.equal(hidden.container.writes, 0);
  b.container.visible = false;
  updateVehicleDrawOrder(s, buffer);
  b.container.y = 80; b.container.visible = true; // reused slot / new archetype
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(names(buffer), ['authored', 'patrol', 'pool']);
  s.vehicleSystem.vehicles.length = 0;
  updateVehicleDrawOrder(s, buffer);
  assert.deepEqual(names(buffer), ['patrol', 'pool']);
  updateVehicleDrawOrder({}, buffer);
  assert.equal(buffer.length, 0, 'no stale container retained in the next frame');
});

test('expanded city coordinates do not escape vehicle depth band or clamp order', () => {
  const cars = [-1e9, -10, 0, 100, 5000, 1e9].map((y, i) => car(`car-${i}`, y));
  const buffer = [];
  updateVehicleDrawOrder(scene(cars.slice().reverse()), buffer);
  assert.deepEqual(names(buffer), cars.map(c => c.id));
  assert.ok(buffer.every(c => c.depth >= 46 && c.depth < 47));
});
