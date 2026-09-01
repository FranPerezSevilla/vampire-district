import test from "node:test";
import assert from "node:assert/strict";
import { RADIO_STATIONS } from "../phaser/src/audio/RadioCatalog.js";
import { RadioPlayback } from "../phaser/src/audio/RadioPlayback.js";

function fakeAudioContext() {
  const context = {
    state: "suspended",
    currentTime: 0,
    decodeCount: 0,
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
    decodeAudioData(encoded, success) {
      this.decodeCount += 1;
      const buffer = { byteLength: encoded.byteLength, duration: 180 };
      success?.(buffer);
      return Promise.resolve(buffer);
    },
    createGain() {
      return {
        gain: { value: 0 },
        connect() {},
        disconnect() {}
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        onended: null,
        connect() {},
        disconnect() {},
        start() {},
        stop() {}
      };
    }
  };
  return context;
}

test("radio startup prefetches all nine masters in parallel and bounds decoded buffers", async () => {
  const context = fakeAudioContext();
  const requested = [];
  const fetchFn = async url => {
    requested.push(url);
    return {
      ok: true,
      status: 200,
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
      }
    };
  };
  const rawAudio = {
    ctx: null,
    master: { id: "raw-master" },
    ensureListeners() {},
    unlock() {
      this.ctx = context;
      return context;
    }
  };

  const playback = new RadioPlayback(rawAudio, {
    fetchFn,
    maxDecodedBuffers: 4,
    AudioCtor: null
  });

  const preload = await playback.preloadCatalog(RADIO_STATIONS);
  assert.equal(preload.total, 9);
  assert.equal(preload.fetched, 9);
  assert.equal(preload.failed, 0);
  assert.equal(preload.decoded, 3, "startup decodes the first track of each station");
  assert.equal(new Set(requested).size, 9, "every master is fetched exactly once during startup preload");
  assert.equal(requested.length, 9);

  const secondViceTrack = RADIO_STATIONS[0].tracks[1];
  assert.equal(await playback.prepare(secondViceTrack), true);
  assert.equal(playback.preloadSnapshot().decoded, 4, "warming the next song stays inside the decode cache budget");

  const firstViceTrack = RADIO_STATIONS[0].tracks[0];
  assert.equal(playback.play(firstViceTrack), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(playback.snapshot().playbackKind, "buffer");
  assert.equal(playback.snapshot().contextState, "running");
  assert.ok(playback.preloadSnapshot().decoded <= 4);

  playback.destroy();
});
