import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { InteractionSystem } from "../phaser/src/systems/InteractionSystemCore.js";
import { selectTraversalCandidate } from "../phaser/src/data/traversal.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("bestOption preserves standard interaction priority without sorting or cloning", () => {
  const scene = { player: { x: 0, y: 0 }, combatSystem: { aimDirection: { x: 1, y: 0 } } };
  const system = new InteractionSystem(scene);
  const options = [
    { id: "lower-priority", priority: 5, distance: 1 },
    { id: "far", priority: 10, distance: 8 },
    { id: "b-near", priority: 10, distance: 3 },
    { id: "a-near", priority: 10, distance: 3 }
  ];
  const order = [...options];
  const best = system.bestOption(options);
  assert.equal(best.id, "a-near");
  assert.equal(system.sortOptions(options)[0], best);
  assert.deepEqual(options, order);
});

test("traversal selection remains deterministic while using a single pass", () => {
  const player = { x: 0, y: 0 };
  const aim = { x: 1, y: 0 };
  const options = [
    { id: "far", x: 30, y: 0, priority: 60 },
    { id: "b-near", x: 8, y: 0, priority: 60 },
    { id: "a-near", x: 8, y: 0, priority: 60 }
  ];
  assert.equal(selectTraversalCandidate(player, aim, options)?.id, "a-near");

  const traversalSource = source("phaser/src/data/traversal.js");
  const selectionBody = traversalSource.slice(traversalSource.indexOf("export function selectTraversalCandidate"));
  assert.doesNotMatch(selectionBody, /candidates\s*\.map\s*\(/);
  assert.doesNotMatch(selectionBody, /\.filter\s*\(/);
  assert.doesNotMatch(selectionBody, /\.sort\s*\(/);
});

test("GameplayRuntime nearest hot path uses bestOption and reuses the selected traversal", () => {
  const runtime = source("phaser/src/runtime/GameplayRuntimeCore.js");
  const nearestBody = runtime.slice(runtime.indexOf("function nearest"), runtime.indexOf("export class GameplayRuntime"));
  assert.match(nearestBody, /interactionSystem\?\.bestOption/);
  assert.match(nearestBody, /typeof bestOption === "function"/);
  assert.match(runtime, /const option = scene\.nearestMovement;/);
});
