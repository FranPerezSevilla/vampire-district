import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEATH_BEAT,
  DEATH_SEQUENCE_PHASES,
  advanceDeathSequence,
  createDeathSequenceState,
  deathDialogueAlpha,
  deathFadeAlpha,
  startDeathSequence
} from "../phaser/src/data/death-recovery.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("death beat is idempotent and advances from master dialogue to black", () => {
  const state = createDeathSequenceState();
  assert.equal(startDeathSequence(state), true);
  assert.equal(startDeathSequence(state), false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.MASTER);

  let result = advanceDeathSequence(state, DEATH_BEAT.masterHoldMs - 1);
  assert.equal(result.fadeCompleted, false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.MASTER);
  assert.equal(deathDialogueAlpha(state), 0);
  assert.equal(deathFadeAlpha(state), 0);

  result = advanceDeathSequence(state, 2);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.FADE);
  assert.equal(result.fadeCompleted, false);
  assert.equal(deathDialogueAlpha(state), 0);
  assert.ok(deathFadeAlpha(state) > 0);

  result = advanceDeathSequence(state, DEATH_BEAT.fadeMs);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.BLACK);
  assert.equal(result.fadeCompleted, true);
  assert.equal(deathDialogueAlpha(state), 0);
  assert.equal(deathFadeAlpha(state), 1);

  result = advanceDeathSequence(state, 5000);
  assert.equal(result.fadeCompleted, false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.BLACK);
});

test("runtime death presentation uses the conventional Sire dialogue after a readable zoom hold", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  assert.match(code, /"player:died"/);
  assert.ok(DEATH_BEAT.zoomHoldMs >= 1500);
  assert.match(DEATH_BEAT.masterLine, /predator.*prey/i);
  assert.equal(DEATH_BEAT.masterSpeaker, "YOUR SIRE · IN YOUR MIND");
  assert.match(code, /tutorialDirector/);
  assert.match(code, /zoomToPlayer/);
  assert.match(code, /showDialogue/);
  assert.match(code, /kind: "thought"/);
  assert.match(code, /DEATH_BEAT\.zoomHoldMs/);
  assert.doesNotMatch(code, /scene\.add\.text\(0, 0, "Pathetic\."/);
  assert.match(code, /death:sequence-started/);
  assert.match(code, /death:fade-complete/);
  assert.match(code, /RawAudio\.stopAllVehicleEngines/);
  assert.match(code, /linearRampToValueAtTime\(0\.0001, end\)/);
});

test("GameplayRuntime composes and advances the death beat even while world input is locked", () => {
  const code = source("phaser/src/runtime/GameplayRuntimeCore.js");
  assert.match(code, /new DeathRecoverySystem\(scene\)/);
  const deathUpdate = code.indexOf("scene.deathRecoverySystem?.update?.(dt)");
  const beginFrame = code.indexOf("scene.inputSystem?.beginFrame()");
  assert.ok(deathUpdate >= 0);
  assert.ok(beginFrame >= 0);
  assert.ok(deathUpdate < beginFrame);
});
