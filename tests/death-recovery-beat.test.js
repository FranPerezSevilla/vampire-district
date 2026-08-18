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

test("death beat remains idempotent and exposes one terminal black edge", () => {
  const state = createDeathSequenceState();
  const timings = { ...DEATH_BEAT, masterHoldMs: 20, fadeMs: 10 };
  assert.equal(startDeathSequence(state), true);
  assert.equal(startDeathSequence(state), false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.MASTER);

  let result = advanceDeathSequence(state, 10, timings);
  assert.equal(result.fadeCompleted, false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.MASTER);
  assert.equal(deathDialogueAlpha(state), 0);
  assert.equal(deathFadeAlpha(state, timings), 0);

  result = advanceDeathSequence(state, 10, timings);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.FADE);
  assert.equal(result.fadeCompleted, false);

  result = advanceDeathSequence(state, 10, timings);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.BLACK);
  assert.equal(result.fadeCompleted, true);
  assert.equal(deathDialogueAlpha(state), 0);
  assert.equal(deathFadeAlpha(state, timings), 1);

  result = advanceDeathSequence(state, 5000, timings);
  assert.equal(result.fadeCompleted, false);
  assert.equal(state.phase, DEATH_SEQUENCE_PHASES.BLACK);
});

test("runtime death presentation attenuates world audio and reaches black before the conventional Sire dialogue", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  assert.match(code, /"player:died"/);
  assert.ok(DEATH_BEAT.audioAttenuateMs >= 300);
  assert.ok(DEATH_BEAT.blackoutFadeMs >= 500);
  assert.ok(DEATH_BEAT.audioAttenuatedFactor > 0 && DEATH_BEAT.audioAttenuatedFactor < 0.5);
  assert.match(DEATH_BEAT.masterLine, /predator.*prey/i);
  assert.equal(DEATH_BEAT.masterSpeaker, "YOUR SIRE · IN YOUR MIND");

  const attenuate = code.indexOf("this.beginWorldAudioAttenuation()");
  const waitForDip = code.indexOf("await this.waitForPresentation(DEATH_BEAT.audioAttenuateMs)");
  const stopLoops = code.indexOf("this.stopTransientWorldAudio()");
  const silence = code.indexOf("this.beginWorldAudioSilence()");
  const blackout = code.indexOf("await this.fadeWorldToBlack()");
  const raiseDialogue = code.indexOf("this.setSireDialogueAboveBlackout(true)");
  const dialogue = code.indexOf("await director.showDialogue({");

  for (const index of [attenuate, waitForDip, stopLoops, silence, blackout, raiseDialogue, dialogue]) {
    assert.ok(index >= 0);
  }
  assert.ok(attenuate < waitForDip);
  assert.ok(waitForDip < stopLoops);
  assert.ok(stopLoops < silence);
  assert.ok(silence < blackout);
  assert.ok(blackout < raiseDialogue);
  assert.ok(raiseDialogue < dialogue);

  const attenuationMethod = code.slice(
    code.indexOf("beginWorldAudioAttenuation() {"),
    code.indexOf("beginWorldAudioSilence() {")
  );
  const silenceMethod = code.slice(
    code.indexOf("beginWorldAudioSilence() {"),
    code.indexOf("fadeWorldToBlack() {")
  );
  assert.match(attenuationMethod, /RawAudio\.master/);
  assert.doesNotMatch(attenuationMethod, /narrativeMaster/);
  assert.match(silenceMethod, /RawAudio\.master/);
  assert.doesNotMatch(silenceMethod, /narrativeMaster/);
  assert.match(silenceMethod, /linearRampToValueAtTime\(0\.0001, end\)/);

  assert.match(code, /RawAudio\.stopAllVehicleEngines/);
  assert.match(code, /kind: "thought"/);
  assert.match(code, /death-blackout-backdrop/);
  assert.match(code, /zIndex: "9998"/);
  assert.match(code, /dialogue\.style\.zIndex = "9999"/);
  assert.match(code, /Math\.max\(deathFadeAlpha\(this\.state\), this\.deathBlackoutAlpha\)/);
  assert.doesNotMatch(code, /scene\.add\.text\(0, 0, "Pathetic\."/);
  assert.match(code, /death:sequence-started/);
  assert.match(code, /death:fade-complete/);
});

test("conventional Sire dialogue is DOM-backed so it can remain above the canvas blackout", () => {
  const code = source("phaser/src/tutorial/TutorialDirector.js");
  assert.match(code, /dialogue = document\.createElement\("div"\)/);
  assert.match(code, /dialogue\.id = "tutorial-dialogue"/);
  assert.match(code, /\.tutorial-dialogue\.thought/);
  assert.match(code, /z-index: 95/);
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
