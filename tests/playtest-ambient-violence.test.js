import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bootstrapSource = fs.readFileSync("phaser/src/playtest/bootstrap.js", "utf8");

test("playtest intro establishes the vampire premise in one short beat", () => {
  assert.match(bootstrapSource, /VICEBLOOD · ONE MORE NIGHT/);
  assert.match(bootstrapSource, /Immortality was never the luxury you imagined\./);
  assert.match(bootstrapSource, /turned into a vampire decades ago/);
  assert.match(bootstrapSource, /clan wars and keeping the Veil intact/);
  assert.match(bootstrapSource, /Feed, lose the police, and return to the refuge\./);
  assert.match(bootstrapSource, /Step into the night/);
  assert.doesNotMatch(bootstrapSource, /Early browser build\. Art and audio are unfinished/);
});

test("three unwitnessed street deaths create restrained local attention without Exposure", async () => {
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
  assert.deepEqual(heat.map(entry => entry.amount), [4, 5, 6]);
  assert.equal(heat.reduce((sum, entry) => sum + entry.amount, 0), 15);
  assert.ok(heat.every(entry => entry.options.witnessed === false));
  assert.ok(heat.every(entry => entry.options.supernatural === false));
  assert.match(heat.at(-1).reason, /multiple gunshots and bodies reported/);
  assert.equal(emitted.filter(entry => entry.name === "playtest:ambient-violence-reported").length, 3);
});
