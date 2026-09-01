import test from "node:test";
import assert from "node:assert/strict";
import { RADIO_STATIONS } from "../phaser/src/audio/RadioCatalog.js";
import { LAYERS } from "../phaser/src/data/district.js";
import {
  TrafficRadioAmbienceSystem,
  selectTrafficRadioCandidates,
  trafficRadioGain,
  trafficRadioStationId
} from "../phaser/src/systems/TrafficRadioAmbienceSystem.js";

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.targets = [];
  }

  setTargetAtTime(value, time, constant) {
    this.value = value;
    this.targets.push({ value, time, constant });
  }
}

function fakeAudioContext() {
  const starts = [];
  const stops = [];
  const sources = [];
  const ctx = {
    state: "running",
    currentTime: 10,
    createBufferSource() {
      const source = {
        buffer: null,
        onended: null,
        connect() {},
        disconnect() {},
        start(...args) { starts.push(args); },
        stop(...args) { stops.push(args); }
      };
      sources.push(source);
      return source;
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        Q: new FakeParam(),
        frequency: new FakeParam(),
        connect() {},
        disconnect() {}
      };
    },
    createGain() {
      return {
        gain: new FakeParam(),
        connect() {},
        disconnect() {}
      };
    },
    createStereoPanner() {
      return {
        pan: new FakeParam(),
        connect() {},
        disconnect() {}
      };
    }
  };
  return { ctx, starts, stops, sources };
}

function slot(tokenId, x, y, active = true) {
  return { tokenId, x, y, container: { active } };
}

test("traffic radio assigns each traffic token to one deterministic station", () => {
  const ids = new Set(RADIO_STATIONS.map(station => station.id));
  const first = trafficRadioStationId("road-7#2");
  assert.ok(ids.has(first));
  assert.equal(trafficRadioStationId("road-7#2"), first);
  assert.ok(ids.has(trafficRadioStationId("road-7#3")));
});

test("traffic radio is perceptible nearby, falls quickly and is silent outside the local radius", () => {
  const near = trafficRadioGain(20);
  const mid = trafficRadioGain(90);
  const far = trafficRadioGain(160);
  assert.ok(near >= 0.095 && near <= 0.101, `near gain ${near} should be about 0.10`);
  assert.ok(mid > 0.03 && mid < near, `mid gain ${mid} should remain audible but secondary`);
  assert.ok(far > 0 && far < 0.01, `far gain ${far} should be nearly gone`);
  assert.equal(trafficRadioGain(180), 0);
  assert.equal(trafficRadioGain(500), 0);
  assert.equal(trafficRadioGain(20, { multiplier: 0 }), 0);
});

test("traffic radio selects only the nearest bounded materialized cars", () => {
  const candidates = selectTrafficRadioCandidates([
    slot("near", 20, 0),
    slot("middle", 55, 0),
    slot("third", 80, 0),
    slot("far", 150, 0),
    slot("inactive", 5, 0, false),
    slot(null, 1, 0)
  ], { x: 0, y: 0 }, { maxEmitters: 3, audibleRadius: 180 });

  assert.deepEqual(candidates.map(candidate => candidate.tokenId), ["near", "middle", "third"]);
  assert.ok(candidates.every(candidate => candidate.stationId));
});

test("traffic radio shares decoded buffers, seeks to the live timeline and releases despawned cars", async () => {
  const audio = fakeAudioContext();
  const rawAudio = { ctx: audio.ctx, master: { id: "raw-master" } };
  const tracksByStation = new Map(RADIO_STATIONS.map(station => [station.id, station.tracks[0]]));
  const decodeCalls = [];
  const timeline = {
    position(stationId) {
      const track = tracksByStation.get(stationId);
      return {
        stationId,
        track,
        trackIndex: 0,
        trackCount: 3,
        offsetSeconds: 37,
        durationSeconds: track.durationSeconds,
        observedAtMs: 37_000
      };
    }
  };
  const playback = {
    rawAudio,
    ensureDecoded(url) {
      decodeCalls.push(url);
      return Promise.resolve({ duration: 260 });
    }
  };
  const radioSystem = {
    timeline,
    playback,
    driving: false,
    selectedStationId: "vice-fm"
  };
  const trafficSystem = {
    pool: [slot("car-a", 22, 0), slot("car-b", 48, 0), slot("car-c", 95, 0)]
  };
  const scene = {
    currentLayer: LAYERS.STREET,
    radioSystem,
    trafficMaterializationSystem: trafficSystem,
    renderFocus: () => ({ x: 0, y: 0 }),
    events: { once() {} }
  };
  const system = new TrafficRadioAmbienceSystem(scene, {
    radioSystem,
    trafficSystem,
    rawAudio,
    maxEmitters: 2,
    audibleRadius: 120
  });

  system.update();
  await Promise.resolve();
  await Promise.resolve();

  const initial = system.snapshot();
  assert.equal(initial.trackedCount, 2);
  assert.equal(initial.activeCount, 2);
  assert.equal(initial.maxGain, 0.10);
  assert.equal(initial.audioContextState, "running");
  assert.equal(decodeCalls.length, 2);
  assert.deepEqual(audio.starts.map(args => args.slice(0, 2)), [[0, 37], [0, 37]]);
  assert.ok(initial.emitters.every(emitter => emitter.gain > 0 && emitter.gain <= 0.10));

  radioSystem.driving = true;
  radioSystem.selectedStationId = "vice-fm";
  system.update();
  const drivingSnapshot = system.snapshot();
  assert.ok(drivingSnapshot.emitters.length > 0);
  assert.ok(
    drivingSnapshot.emitters.every(emitter => emitter.gain === 0),
    "nearby NPC radios are silent while the player's own car radio is on"
  );

  radioSystem.selectedStationId = "off";
  system.update();
  const radioOffSnapshot = system.snapshot();
  assert.ok(
    radioOffSnapshot.emitters.every(emitter => emitter.gain > 0),
    "nearby NPC radios return when the player switches the car radio off"
  );

  trafficSystem.pool[0].tokenId = null;
  system.update();
  await Promise.resolve();
  await Promise.resolve();

  const afterDespawn = system.snapshot();
  assert.equal(afterDespawn.trackedCount, 2, "next-nearest traffic replaces the released emitter within the cap");
  assert.ok(afterDespawn.emitters.every(emitter => emitter.tokenId !== "car-a"));
  assert.ok(audio.stops.length >= 1, "despawn/hijack cleanup stops the old source");

  system.destroy();
});
