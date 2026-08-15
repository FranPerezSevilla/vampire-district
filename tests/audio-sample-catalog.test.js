import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const WEAPON_FIRE_FILES = [
  "phaser/assets/audio/combat/weapon-fire-01.mp3",
  "phaser/assets/audio/combat/weapon-fire-02.mp3",
  "phaser/assets/audio/combat/weapon-fire-03.mp3"
];

const BULLET_HIT_BODY_FILES = [
  "phaser/assets/audio/combat/bullet-hit-body-02.mp3"
];

const DRAIN_START_FILES = [
  "phaser/assets/audio/feeding/drain-start-01.mp3"
];

const DRAIN_LOOP_FILES = [
  "phaser/assets/audio/feeding/drain-loop-01.wav"
];

const DRAIN_COMPLETE_FILES = [
  "phaser/assets/audio/feeding/drain-complete-01.mp3"
];

const CIVILIAN_SCREAM_FILES = [
  "phaser/assets/audio/civilians/civilian-scream-01.mp3",
  "phaser/assets/audio/civilians/civilian-scream-02.mp3",
  "phaser/assets/audio/civilians/civilian-scream-03.mp3",
  "phaser/assets/audio/civilians/civilian-scream-04.mp3",
  "phaser/assets/audio/civilians/civilian-scream-05.mp3",
  "phaser/assets/audio/civilians/civilian-scream-06.mp3"
];

function repoFile(path) {
  return new URL(`../${path}`, import.meta.url);
}

function assertMp3Files(paths) {
  for (const path of paths) {
    const data = readFileSync(repoFile(path));
    assert.ok(data.length > 8_000, `${path} should contain the processed sample, not a placeholder`);
    const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
    const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
    assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
  }
}

function assertWavFiles(paths) {
  for (const path of paths) {
    const data = readFileSync(repoFile(path));
    assert.ok(data.length > 20_000, `${path} should contain the processed loop, not a placeholder`);
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(data.subarray(8, 12).toString("ascii"), "WAVE");
  }
}

test("weaponFire registers one stable event with three WebKit-compatible runtime variants", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.weaponFire.files, WEAPON_FIRE_FILES);
  assert.equal(SAMPLE_AUDIO_CATALOG.weaponFire.volume, 0.95);
});

test("weaponFire runtime variants are committed MP3 binaries", () => {
  assertMp3Files(WEAPON_FIRE_FILES);
});

test("pistol fire routes through the sample-backed weaponFire event", () => {
  const weaponSource = readFileSync(repoFile("phaser/src/systems/WeaponSystem.js"), "utf8");
  assert.match(weaponSource, /weapon\.id === WEAPON_IDS\.PISTOL[\s\S]*?RawAudio\.play\("weaponFire"\)/);

  const rawAudioSource = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  assert.match(rawAudioSource, /if \(this\.playSample\(name, options\)\) return;/);
  assert.match(rawAudioSource, /case "weaponFire": return this\.weaponFireFallback\(\);/);
});

test("bulletHitBody is registered as a WebKit-compatible runtime sample", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.bulletHitBody.files, BULLET_HIT_BODY_FILES);
  assert.equal(SAMPLE_AUDIO_CATALOG.bulletHitBody.volume, 1.15);
  assertMp3Files(BULLET_HIT_BODY_FILES);
});

test("bulletHitBody plays only after a confirmed hitscan hit on a human NPC", () => {
  const weaponSource = readFileSync(repoFile("phaser/src/systems/WeaponSystem.js"), "utf8");
  assert.match(weaponSource, /events\?\.on\?\.\("combat:hit", this\.onCombatHit, this\)/);
  assert.match(
    weaponSource,
    /onCombatHit\(event = \{\}\)[\s\S]*?weaponById\(event\.weaponId\)[\s\S]*?attackType !== WEAPON_TYPES\.HITSCAN[\s\S]*?RawAudio\.play\("bulletHitBody"/
  );
  assert.match(weaponSource, /events\?\.off\?\.\("combat:hit", this\.onCombatHit, this\)/);

  const combatSource = readFileSync(repoFile("phaser/src/combat/CombatSystem.js"), "utf8");
  assert.match(combatSource, /if \(candidate\.kind === "npc"\) this\.applyHit\(candidate\.entity, config\);/);
  assert.match(combatSource, /if \(candidate\.kind === "prop"\) \{[\s\S]*?propDamageSystem\?\.damage/);
  assert.equal((combatSource.match(/"combat:hit"/g) || []).length, 1, "combat:hit should remain the human-NPC hit event");
});

test("feeding family registers browser-compatible one-shots and a PCM loop", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainStart.files, DRAIN_START_FILES);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainLoop.files, DRAIN_LOOP_FILES);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainComplete.files, DRAIN_COMPLETE_FILES);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.loop, true);
  assertMp3Files([...DRAIN_START_FILES, ...DRAIN_COMPLETE_FILES]);
  assertWavFiles(DRAIN_LOOP_FILES);
});

test("feeding lifecycle starts one stateful bite loop and stops it on every exit path", () => {
  const rawAudioSource = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  assert.match(rawAudioSource, /startSampleLoop\(name, options = \{\}\)/);
  assert.match(rawAudioSource, /source\.loop = true/);
  assert.match(rawAudioSource, /stopSampleLoop\(name\)/);

  const feedingSource = readFileSync(repoFile("phaser/src/systems/FeedingSystem.js"), "utf8");
  assert.match(
    feedingSource,
    /RawAudio\.play\("drainStart"\);\s*RawAudio\.startSampleLoop\?\.\("drainLoop", \{ delay: 0\.45 \}\);/
  );
  assert.match(
    feedingSource,
    /cancel\([\s\S]*?RawAudio\.stopSampleLoop\?\.\("drainLoop"\)[\s\S]*?RawAudio\.play\("drainCancel"\)/
  );
  assert.match(
    feedingSource,
    /RawAudio\.stopSampleLoop\?\.\("drainLoop"\);\s*RawAudio\.play\(depth === FEEDING_DEPTHS\.DRAIN \? "drainComplete" : "drainCancel"/
  );
});

test("civilianScream registers six browser-compatible panic variants under one event", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.civilianScream.files, CIVILIAN_SCREAM_FILES);
  assert.equal(SAMPLE_AUDIO_CATALOG.civilianScream.volume, 0.82);
  assertMp3Files(CIVILIAN_SCREAM_FILES);
});

test("civilianScream fires once when an alarmed witness leaves shock and starts fleeing", () => {
  const witnessSource = readFileSync(repoFile("phaser/src/systems/WitnessSystem.js"), "utf8");
  assert.match(
    witnessSource,
    /wasReacting > 0 && witness\.reactionTimer <= 0\) RawAudio\.play\("civilianScream", \{ cooldown: 0\.55 \}\);/
  );

  const rawAudioSource = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  assert.match(rawAudioSource, /case "civilianScream": return this\.gasp\(\);/);
});

test("playtest Audio Lab previews catalogue events and exact variants without gameplay", () => {
  const labSource = readFileSync(repoFile("phaser/src/playtest/AudioLab.js"), "utf8");
  assert.match(labSource, /SAMPLE_AUDIO_IDS/);
  assert.match(labSource, /sampleAudioDefinition/);
  assert.match(labSource, /const RAW_AUDIO_MASTER_GAIN = 0\.20/);
  assert.match(labSource, /RAW_AUDIO_MASTER_GAIN \* this\.labVolume/);
  assert.match(labSource, /max="3"/);
  assert.match(labSource, /playEvent\(id\)/);
  assert.match(labSource, /playVariant\(id, index\)/);
  assert.match(labSource, /fetch\(file\)/);
  assert.match(labSource, /decodeAudioData/);
  assert.match(labSource, /event\.key === "F8"/);

  const bootstrapSource = readFileSync(repoFile("phaser/src/playtest/bootstrap.js"), "utf8");
  assert.match(bootstrapSource, /import \{ AudioLab \} from "\.\/AudioLab\.js"/);
  assert.match(bootstrapSource, /new AudioLab\(scene\)/);
  assert.match(bootstrapSource, /openAudioLab: \(\) => audioLab\.open\(\)/);
});