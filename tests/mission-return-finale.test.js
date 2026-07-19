import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

const distanceBetween = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
globalThis.Phaser = {
  Math: {
    Distance: { Between: distanceBetween }
  }
};

const { LAYERS } = await import("../phaser/src/data/district.js");
const { MissionSystem, RETURN_FINALE_COPY } = await import("../phaser/src/systems/MissionSystem.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeScene() {
  const dialogue = deferred();
  const order = [];
  const resultWrites = [];
  const freezeCalls = [];
  const controlModes = [];
  const events = new EventEmitter();
  const director = {
    busy: false,
    state: "complete",
    setControlMode(mode) { controlModes.push(mode); },
    setTip() {},
    freezeWorld(value) { freezeCalls.push(Boolean(value)); },
    async showDialogue(payload) {
      order.push("dialogue-opened");
      this.lastDialogue = payload;
      await dialogue.promise;
      order.push("dialogue-dismissed");
    }
  };

  const scene = {
    currentLayer: LAYERS.ROOF_HIGH,
    player: { x: 150, y: 146 },
    lastActionText: "",
    tutorialDirector: director,
    inputSystem: {
      resets: 0,
      resetWorldEdges() { this.resets++; }
    },
    npcSystem: {
      npcs: [],
      rebuildSpatialIndex() {},
      refreshVisibility() {},
      summary: () => "NPC summary"
    },
    feedingSystem: {
      stats: { targetHandled: true },
      summary: () => "Hunger summary"
    },
    exposureSystem: { summary: () => "Exposure summary" },
    policeSystem: { summary: () => "Police summary" },
    witnessSystem: { summary: () => "Witness summary" },
    evidenceSystem: { summary: () => "Evidence summary" },
    propDamageSystem: { summary: () => "Prop summary" },
    weaponSystem: { summary: () => "Weapon summary" },
    aiStateSystem: { summary: () => "AI summary" },
    events,
    redrawLayer() {},
    statePublisher: {
      set(key, value) {
        resultWrites.push({ key, value });
        if (key === "missionResult") order.push("report-published");
      }
    },
    registry: { set() {} }
  };

  return {
    scene,
    director,
    dialogue,
    order,
    resultWrites,
    freezeCalls,
    controlModes
  };
}

for (const outcome of ["killed", "drained"]) {
  test(`${outcome} journalist still requires sire dialogue before REPORT ACCEPTED`, async () => {
    const context = makeScene();
    const mission = new MissionSystem(context.scene);
    mission.step = 2;

    mission.resolveJournalistPlaceholder(`Journalist ${outcome}. Return to the refuge.`);
    assert.equal(mission.step, 3);
    assert.equal(mission.completed, false);
    assert.equal(context.resultWrites.length, 0);

    mission.update();
    const finalePromise = mission.returnFinalePromise;
    mission.update();

    assert.ok(finalePromise);
    assert.equal(mission.returnFinalePending, true);
    assert.equal(mission.completed, false);
    assert.equal(context.resultWrites.length, 0);
    assert.deepEqual(context.order, ["dialogue-opened"]);
    assert.equal(context.director.lastDialogue.speaker, RETURN_FINALE_COPY.speaker);
    assert.deepEqual(context.director.lastDialogue.segments, [...RETURN_FINALE_COPY.segments]);
    assert.deepEqual(context.freezeCalls, [true]);
    assert.deepEqual(context.controlModes, ["locked"]);

    context.dialogue.resolve();
    await finalePromise;

    assert.equal(mission.completed, true);
    assert.equal(mission.step, 4);
    assert.equal(mission.resultPublished, true);
    assert.deepEqual(context.order, ["dialogue-opened", "dialogue-dismissed", "report-published"]);
    assert.equal(context.resultWrites.length, 1);
    assert.equal(context.resultWrites[0].key, "missionResult");
    assert.equal(context.resultWrites[0].value.status, "complete");
    assert.equal(context.resultWrites[0].value.title, "REPORT ACCEPTED");
    assert.deepEqual(context.freezeCalls, [true, false]);
    assert.deepEqual(context.controlModes, ["locked", "full"]);
    assert.equal(context.scene.inputSystem.resets, 1);
  });
}

test("reaching the refuge before handling the journalist cannot start the finale", () => {
  const context = makeScene();
  const mission = new MissionSystem(context.scene);
  mission.step = 2;
  mission.update();

  assert.equal(mission.returnFinalePending, false);
  assert.equal(mission.returnFinalePromise, null);
  assert.equal(mission.completed, false);
  assert.equal(context.order.length, 0);
  assert.equal(context.resultWrites.length, 0);
});

test("repeated refuge updates start one finale sequence only", () => {
  const context = makeScene();
  const mission = new MissionSystem(context.scene);
  mission.step = 3;

  mission.update();
  mission.update();
  mission.update();

  assert.equal(context.order.filter(value => value === "dialogue-opened").length, 1);
  assert.equal(mission.returnFinalePending, true);
});
