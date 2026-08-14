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
