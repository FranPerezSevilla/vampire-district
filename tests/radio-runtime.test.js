import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RADIO_STATIONS,
  RADIO_STATION_ORDER,
  radioTrackCount
} from "../phaser/src/audio/RadioCatalog.js";
import { RadioPlayback } from "../phaser/src/audio/RadioPlayback.js";
import { RadioSystem } from "../phaser/src/systems/RadioSystem.js";
import { enrichVehicleInputFrame } from "../phaser/src/runtime/VehicleRuntimeAdapter.js";
import { buildRuntimeStagePlan } from "../tools/radio-curator/stage-runtime-audio.js";

globalThis.Phaser ||= { Scenes: { Events: { SHUTDOWN: "shutdown" } } };

class FakeEvents {
  constructor() {
    this.listeners = new Map();
  }

  on(name, callback) {
    const list = this.listeners.get(name) || [];
    list.push(callback);
    this.listeners.set(name, list);
  }

  once(name, callback) {
    const once = (...args) => {
      this.off(name, once);
      callback(...args);
    };
    this.on(name, once);
  }

  off(name, callback) {
    const list = this.listeners.get(name) || [];
    this.listeners.set(name, list.filter(item => item !== callback));
  }

  emit(name, payload) {
    for (const callback of [...(this.listeners.get(name) || [])]) callback(payload);
  }
}

class FakePlayback {
  constructor() {
    this.calls = [];
    this.status = "idle";
    this.options = null;
  }

  play(track, options = {}) {
    this.calls.push(track.id);
    this.options = options;
    this.status = "playing";
    return true;
  }

  stop() {
    this.status = "idle";
    return true;
  }

  snapshot() {
    return { status: this.status, active: this.status === "playing" };
  }

  finish() {
    const ended = this.options?.onEnded;
    this.status = "ended";
    ended?.();
  }

  destroy() {
    this.stop();
  }
}

function fakeScene() {
  const events = new FakeEvents();
  const registryValues = new Map();
  const hud = {
    text: "SEDAN · G1/5 · 0 km/h · hull 100% · SPACE handbrake · ENTER exit",
    setText(value) { this.text = String(value); return this; }
  };
  const vehicleSystem = {
    driving: false,
    hud,
    isDriving() { return this.driving; }
  };
  const scene = {
    events,
    vehicleSystem,
    currentInputFrame: {},
    lastActionText: "",
    registry: {
      set(key, value) { registryValues.set(key, value); },
      get(key) { return registryValues.get(key); }
    }
  };
  return { scene, vehicleSystem, registryValues };
}

test("locked radio catalogue contains exactly three stations with three acquired tracks each", () => {
  assert.deepEqual(RADIO_STATION_ORDER, [
    "off",
    "vice-fm",
    "night-shift",
    "pulse-94-6"
  ]);
  assert.equal(radioTrackCount(), 9);
  assert.deepEqual(Object.fromEntries(RADIO_STATIONS.map(station => [station.id, station.tracks.length])), {
    "vice-fm": 3,
    "night-shift": 3,
    "pulse-94-6": 3
  });
  const ids = new Set(RADIO_STATIONS.flatMap(station => station.tracks.map(track => track.id)));
  assert.equal(ids.size, 9);
  assert.ok(ids.has("abydos-trip-hop-lovers"));
  assert.ok(!ids.has("1000-handz-architexture-cobabeats"));
  assert.ok(!ids.has("kulakovka-trip-hop"));
  assert.ok(!ids.has("1000-handz-kyoto"));
});

test("vehicle input enrichment preserves weapon wheel and exposes the same edge as radioStep", () => {
  const forward = enrichVehicleInputFrame({ weaponStep: 1, menuConfirmPressed: false, interactPressed: false }, false);
  assert.equal(forward.weaponStep, 1);
  assert.equal(forward.radioStep, 1);

  const backward = enrichVehicleInputFrame({ weaponStep: -1, menuConfirmPressed: false, interactPressed: false }, true);
  assert.equal(backward.weaponStep, -1);
  assert.equal(backward.radioStep, -1);
  assert.equal(backward.handbrakeHeld, true);
});

test("radio cycles stations only while driving, advances playlists and remembers the station across exit", () => {
  const { scene, vehicleSystem } = fakeScene();
  const playback = new FakePlayback();
  const radio = new RadioSystem(scene, { vehicleSystem, playback });

  assert.equal(radio.snapshot().selectedStationId, "vice-fm");
  assert.equal(radio.snapshot().trackCount, 3);
  assert.equal(playback.calls.length, 0);

  vehicleSystem.driving = true;
  scene.events.emit("vehicle:entered", { vehicleId: "car-1" });
  assert.equal(playback.calls.at(-1), "daisuke-teiko-real-deal-90s-hip-hop");

  playback.finish();
  assert.equal(playback.calls.at(-1), "catch22-coasting-west-coast-hip-hop");
  playback.finish();
  assert.equal(playback.calls.at(-1), "abydos-trip-hop-lovers");

  radio.update(0.016, { radioStep: 1 });
  assert.equal(radio.snapshot().selectedStationId, "night-shift");
  assert.equal(playback.calls.at(-1), "ejah-big-beat-industrial-breakbeat-1");
  playback.finish();
  assert.equal(playback.calls.at(-1), "natureseye-dirty-industrial-rave");

  scene.events.emit("vehicle:exited", { vehicleId: "car-1" });
  vehicleSystem.driving = false;
  assert.equal(playback.status, "idle");
  assert.equal(radio.snapshot().selectedStationId, "night-shift");

  const callsBeforeOnFootWheel = playback.calls.length;
  radio.update(0.016, { radioStep: 1 });
  assert.equal(radio.snapshot().selectedStationId, "night-shift", "on-foot wheel cannot change station");
  assert.equal(playback.calls.length, callsBeforeOnFootWheel);

  vehicleSystem.driving = true;
  scene.events.emit("vehicle:entered", { vehicleId: "car-2" });
  assert.equal(playback.calls.at(-1), "natureseye-dirty-industrial-rave", "re-entry keeps station playlist cursor");
  radio.update(0.016, {});
  assert.match(vehicleSystem.hud.text, /RADIO Night Shift · WHEEL station/);
});

test("RadioPlayback connects long-form media to the existing RawAudio master", async () => {
  const master = { id: "raw-master" };
  const connections = [];
  const source = { connect(target) { connections.push(["source", target]); }, disconnect() {} };
  const gain = { gain: { value: 0 }, connect(target) { connections.push(["gain", target]); }, disconnect() {} };
  const ctx = {
    createMediaElementSource() { return source; },
    createGain() { return gain; }
  };
  const rawAudio = { master, unlock() { return ctx; } };

  class FakeAudio {
    constructor() { this.listeners = new Map(); this.src = ""; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    play() { return Promise.resolve(); }
    pause() {}
    removeAttribute() { this.src = ""; }
    load() {}
  }

  const playback = new RadioPlayback(rawAudio, { AudioCtor: FakeAudio });
  assert.equal(playback.play({ id: "track", src: "phaser/assets/audio/radio-private/track.mp3" }), true);
  await Promise.resolve();
  assert.equal(playback.snapshot().status, "playing");
  assert.equal(connections[0][1], gain);
  assert.equal(connections[1][1], master, "radio must terminate at RawAudio.master");
});

test("runtime staging plan maps acquired source filenames onto the nine stable private runtime filenames", () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-source-"));
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-destination-"));
  const seed = {
    tracks: [{ id: "track-a", stationId: "vice-fm", runtimeFilename: "vice-fm__a.mp3" }]
  };
  const ledger = {
    tracks: [{ id: "track-a", acquisitionStatus: "acquired", downloadedFilename: "official-a.mp3" }]
  };
  const plan = buildRuntimeStagePlan({ seed, ledger, sourceDirectory: source, destinationDirectory: destination });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].sourcePath, path.join(source, "official-a.mp3"));
  assert.equal(plan[0].destinationPath, path.join(destination, "vice-fm__a.mp3"));
  assert.equal(plan[0].acquired, true);
});
