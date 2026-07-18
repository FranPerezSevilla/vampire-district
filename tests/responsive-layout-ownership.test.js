import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../phaser/src/responsive-layout.js", import.meta.url), "utf8");

test("responsive layout does not replace gameplay scene methods", () => {
  assert.equal(source.includes("GameScene.prototype.update"), false);
  assert.equal(source.includes("GameScene.prototype.create"), false);
  assert.equal(source.includes("GameScene.prototype.updatePlayerMovement"), false);
  assert.equal(source.includes("CombatSystem.prototype"), false);
  assert.equal(source.includes("PoliceSystem.prototype"), false);
  assert.equal(source.includes("WitnessSystem.prototype"), false);
});
