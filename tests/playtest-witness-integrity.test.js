import test from "node:test";
import assert from "node:assert/strict";

import { LAYERS } from "../phaser/src/data/district.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { PedestrianSystem } from "../phaser/src/systems/PedestrianSystem.js";
import {
  hasStrictVisualContact,
  pointInsideWitnessCone,
  WitnessPerceptionPolicy
} from "../phaser/src/systems/WitnessPerceptionPolicy.js";
import {
  reportLabelForWitness,
  WitnessMarkerPolicy
} from "../phaser/src/systems/WitnessMarkerPolicy.js";

function livingPedestrian(overrides = {}) {
  return {
    id: "pedestrian-1",
    type: NPC_TYPES.CIVILIAN,
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    layer: LAYERS.STREET,
    dead: false,
    inactive: false,
    hiddenBody: false,
    intercepted: false,
    alarmed: false,
    chasingPlayer: false,
    enemyAttack: null,
    dragged: false,
    drainVictim: false,
    stunnedTimer: 0,
    ...overrides
  };
}

function textDouble() {
  return {
    text: "",
    x: 0,
    y: 0,
    visible: false,
    destroyed: false,
    setOrigin() { return this; },
    setDepth() { return this; },
    setVisible(value) { this.visible = Boolean(value); return this; },
    setResolution() { return this; },
    setStroke() { return this; },
    setColor() { return this; },
    setText(value) { this.text = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.destroyed = true; }
  };
}

test("close witnesses still need the feeding action inside their vision cone", () => {
  const witness = livingPedestrian({ x: 0, y: 0, dirX: 1, dirY: 0 });
  const inFront = { x: 12, y: 0, layer: LAYERS.STREET };
  const behind = { x: -12, y: 0, layer: LAYERS.STREET };

  assert.equal(pointInsideWitnessCone(witness, inFront), true);
  assert.equal(pointInsideWitnessCone(witness, behind), false);
});

test("strict visual contact requires an unobstructed line of sight", () => {
  const witness = livingPedestrian();
  const subject = { x: 40, y: 0, layer: LAYERS.STREET };
  const blockedScene = {
    npcSystem: { lineClear: () => false }
  };
  const clearScene = {
    npcSystem: { lineClear: () => true }
  };

  assert.equal(hasStrictVisualContact(blockedScene, witness, subject), false);
  assert.equal(hasStrictVisualContact(clearScene, witness, subject), true);
});

test("ordinary and traffic witnesses outside their angle are removed before Exposure", () => {
  const ordinary = livingPedestrian({ id: "ordinary-behind" });
  const traffic = livingPedestrian({
    id: "traffic-behind",
    trafficWitness: true,
    vehicleOccupant: true
  });
  const subject = { id: "victim", x: -18, y: 0, layer: LAYERS.STREET };
  const player = { id: "player", x: -20, y: 0, layer: LAYERS.STREET };
  const originalCanWitnessSee = () => true;
  const originalWitnessesSeeing = () => [ordinary, traffic];
  const witnessSystem = {
    canWitnessSee: originalCanWitnessSee,
    witnessesSeeing: originalWitnessesSeeing
  };
  const scene = {
    currentLayer: LAYERS.STREET,
    player,
    witnessSystem,
    npcSystem: { lineClear: () => true }
  };
  const policy = new WitnessPerceptionPolicy(scene);

  assert.equal(witnessSystem.canWitnessSee(ordinary, subject, 140), false);
  assert.deepEqual(witnessSystem.witnessesSeeing(subject, 140), []);

  subject.x = 18;
  player.x = 20;
  assert.equal(witnessSystem.canWitnessSee(ordinary, subject, 140), true);
  assert.deepEqual(
    witnessSystem.witnessesSeeing(subject, 140).map(witness => witness.id),
    [ordinary.id, traffic.id]
  );

  policy.destroy();
  assert.equal(witnessSystem.canWitnessSee, originalCanWitnessSee);
  assert.equal(witnessSystem.witnessesSeeing, originalWitnessesSeeing);
});

test("a reporting witness owns one attached label instead of leaving text trails", () => {
  const witness = livingPedestrian({
    alarmed: true,
    reactionTimer: 0,
    reportNavigation: { phase: "flee" },
    masqueradeRisk: true
  });
  let mapLabelCalls = 0;
  let textCreations = 0;
  const labels = [];
  const originalDrawMarkers = () => {
    scene.addMapLabel("! WITNESS", witness.x, witness.y, 0xff3b50);
  };
  const witnessSystem = {
    drawMarkers: originalDrawMarkers,
    alarmedWitnesses: () => [witness]
  };
  const scene = {
    currentLayer: LAYERS.STREET,
    witnessSystem,
    npcSystem: { npcs: [witness] },
    addMapLabel: () => { mapLabelCalls++; },
    add: {
      text: () => {
        textCreations++;
        const label = textDouble();
        labels.push(label);
        return label;
      }
    }
  };
  const policy = new WitnessMarkerPolicy(scene);

  witnessSystem.drawMarkers({});
  witness.x = 24;
  witness.y = 16;
  witnessSystem.drawMarkers({});

  assert.equal(reportLabelForWitness(witness), "REPORT");
  assert.equal(mapLabelCalls, 0);
  assert.equal(textCreations, 1);
  assert.equal(labels[0].text, "REPORT");
  assert.equal(labels[0].x, 24);
  assert.equal(labels[0].y, -6);
  assert.equal(labels[0].visible, true);

  witness.hasReported = true;
  witnessSystem.drawMarkers({});
  assert.equal(labels[0].visible, false);

  policy.destroy();
  assert.equal(witnessSystem.drawMarkers, originalDrawMarkers);
  assert.equal(labels[0].destroyed, true);
});

test("pedestrian routing cannot move the active feeding victim", () => {
  const npc = livingPedestrian();
  const scene = {
    entityStreamSystem: { shouldSimulateNpc: () => true },
    feedingSystem: { active: null },
    registry: { get: () => false },
    transitionSystem: { active: false }
  };
  const canMove = candidate => PedestrianSystem.prototype.canMove.call({ scene }, candidate);

  assert.equal(canMove(npc), true);
  npc.drainVictim = true;
  assert.equal(canMove(npc), false);
  npc.drainVictim = false;
  scene.feedingSystem.active = { npc };
  assert.equal(canMove(npc), false);
});
