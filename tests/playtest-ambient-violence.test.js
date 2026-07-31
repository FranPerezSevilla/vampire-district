import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bootstrapSource = fs.readFileSync("phaser/src/playtest/bootstrap.js", "utf8");

test("playtest intro is a single short character beat", () => {
  assert.match(bootstrapSource, /The city smells alive\./);
  assert.match(bootstrapSource, /One clean feed\. Then home before the sirens learn my name\./);
  assert.match(bootstrapSource, /Step into the night/);
  assert.doesNotMatch(bootstrapSource, /Early browser build\. Art and audio are unfinished/);
});

test("three unwitnessed street deaths create local police attention without Exposure", async () => {
  globalThis.Phaser = {
    Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } }
  };
  const { AmbientViolenceResponseSystem } = await import(
    `../phaser/src/playtest/AmbientViolenceResponseSystem.js?test=${Date.now()}`
  );

  const heat = [];
  const emitted = [];
  const listeners = new Map();
  const scene = {
    time: { now: 1000 },
    npcSystem: { npcs: [] },
    policeSystem: {
      addHeat: (x, y, amount, reason, options) => heat.push({ x, y, amount, reason, options })
    },
    events: {
      on: (name, callback) => listeners.set(name, callback),
      once: () => {},
      off: () => {},
      emit: (name, payload) => emitted.push({ name, payload })
    },
    exposureSystem: {
      add: () => assert.fail("Ambient violence must not create supernatural Exposure")
    }
  };

  const system = new AmbientViolenceResponseSystem(scene);
  scene.npcSystem.npcs.push(
    { id: "victim-a", type: "civilian", layer: 0, x: 10, y: 20, dead: true },
    { id: "victim-b", type: "civilian", layer: 0, x: 12, y: 22, dead: true },
    { id: "victim-c", type: "civilian", layer: 0, x: 14, y: 24, dead: true }
  );
  system.update();

  assert.equal(heat.length, 3);
  assert.deepEqual(heat.map(entry => entry.amount), [6, 7, 8]);
  assert.equal(heat.reduce((sum, entry) => sum + entry.amount, 0), 21);
  assert.ok(heat.every(entry => entry.options.witnessed === false));
  assert.ok(heat.every(entry => entry.options.supernatural === false));
  assert.match(heat.at(-1).reason, /multiple gunshots and bodies reported/);
  assert.equal(emitted.filter(entry => entry.name === "playtest:ambient-violence-reported").length, 3);
});
