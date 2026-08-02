import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bootstrapSource = fs.readFileSync("phaser/src/playtest/bootstrap.js", "utf8");
const bootCoverSource = fs.readFileSync("phaser/src/playtest/PlaytestBootCover.js", "utf8");

const narrativeContracts = [
  /VICEBLOOD · ONE MORE NIGHT/,
  /Immortality was never/,
  /the luxury you imagined\./,
  /turned into a vampire decades ago/,
  /clan wars and keeping the Veil hidden from humanity/,
  /defined every night of your existence/,
  /Feed, lose the police, and return to the refuge\./
];

test("boot cover and interactive intro share one vampire narrative", () => {
  for (const contract of narrativeContracts) {
    assert.match(bootstrapSource, contract);
    assert.match(bootCoverSource, contract);
  }
  assert.match(bootstrapSource, /Step into the night/);
  assert.match(bootCoverSource, /Preparing the city/);
  for (const source of [bootstrapSource, bootCoverSource]) {
    assert.doesNotMatch(source, /Hunt\. Feed\. Escape\./);
    assert.doesNotMatch(source, /EARLY PLAYTEST 0\.1/);
    assert.doesNotMatch(source, /Early browser build\. Art and audio are unfinished/);
  }
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
