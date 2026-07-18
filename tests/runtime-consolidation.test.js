import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INPUT_BINDINGS,
  INPUT_BINDING_STORAGE_KEY,
  bindingConflicts,
  bindingLabel,
  loadInputBindings,
  normalizeInputBindings,
  resetInputBindings,
  saveInputBindings
} from "../phaser/src/input/bindings.js";
import { RegistryPublisher } from "../phaser/src/runtime/RegistryPublisher.js";
import { RuntimeDiagnostics } from "../phaser/src/runtime/RuntimeDiagnostics.js";
import { SpatialHash } from "../phaser/src/utils/SpatialHash.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

test("input bindings normalize invalid values and round-trip through storage", () => {
  const storage = memoryStorage();
  const bindings = normalizeInputBindings({ w: "i", quiet: "alt!", traverse: "space" });
  assert.equal(bindings.w, "I");
  assert.equal(bindings.quiet, DEFAULT_INPUT_BINDINGS.quiet);
  assert.equal(bindings.traverse, "SPACE");

  const saved = saveInputBindings({ ...bindings, interact: "G" }, storage);
  assert.equal(saved.interact, "G");
  assert.equal(JSON.parse(storage.getItem(INPUT_BINDING_STORAGE_KEY)).interact, "G");
  assert.equal(loadInputBindings(storage).interact, "G");

  const reset = resetInputBindings(storage);
  assert.equal(reset.interact, DEFAULT_INPUT_BINDINGS.interact);
  assert.equal(storage.getItem(INPUT_BINDING_STORAGE_KEY), null);
});

test("binding conflicts and labels are deterministic", () => {
  const conflicts = bindingConflicts({ ...DEFAULT_INPUT_BINDINGS, interact: "Q", dash: "Q" });
  assert.deepEqual(conflicts, [{ code: "Q", actions: ["interact", "dash"] }]);
  assert.equal(bindingLabel("SPACE"), "Space");
  assert.equal(bindingLabel("UP"), "↑");
  assert.equal(bindingLabel("SEVEN"), "7");
});

test("SpatialHash limits radius and layer queries without duplicates", () => {
  const hash = new SpatialHash(32);
  const entities = [
    { id: "a", x: 10, y: 10, layer: 0 },
    { id: "b", x: 30, y: 10, layer: 0 },
    { id: "c", x: 12, y: 12, layer: 1 },
    { id: "d", x: 100, y: 100, layer: 0 }
  ];
  hash.rebuild(entities);

  assert.deepEqual(
    hash.queryRadius(10, 10, 25, 0).map(entity => entity.id).sort(),
    ["a", "b"]
  );
  assert.deepEqual(hash.queryRadius(10, 10, 25, 1).map(entity => entity.id), ["c"]);
  assert.deepEqual(
    hash.queryRect({ x: 0, y: 0, w: 40, h: 20, layer: 0 }, entity => entity.id !== "b")
      .map(entity => entity.id),
    ["a"]
  );
  assert.equal(hash.size(), 4);
});

test("RegistryPublisher skips unchanged primitive and object state", () => {
  const writes = [];
  const publisher = new RegistryPublisher({ set: (key, value) => writes.push({ key, value }) });

  assert.equal(publisher.set("status", "ready"), true);
  assert.equal(publisher.set("status", "ready"), false);
  assert.equal(publisher.set("state", { level: 1, active: true }), true);
  assert.equal(publisher.set("state", { level: 1, active: true }), false);
  assert.equal(publisher.set("state", { level: 2, active: true }), true);

  assert.equal(writes.length, 3);
  assert.equal(publisher.writes, 3);
  assert.equal(publisher.skipped, 2);
});

test("RuntimeDiagnostics rejects duplicate owners and records frame samples", async () => {
  const diagnostics = new RuntimeDiagnostics({ sampleSize: 10 });
  assert.equal(diagnostics.claim("GameScene.update", "GameplayRuntime"), true);
  assert.equal(diagnostics.claim("GameScene.update", "GameplayRuntime"), false);
  assert.throws(
    () => diagnostics.claim("GameScene.update", "LegacyPatch"),
    /Runtime owner conflict/
  );

  diagnostics.registerSystem("InputSystem");
  diagnostics.registerSystem("CombatSystem");
  diagnostics.beginFrame();
  await new Promise(resolve => setTimeout(resolve, 2));
  const elapsed = diagnostics.endFrame();
  const snapshot = diagnostics.snapshot();

  assert.ok(elapsed >= 0);
  assert.equal(snapshot.owners["GameScene.update"], "GameplayRuntime");
  assert.deepEqual(snapshot.systems, ["CombatSystem", "InputSystem"]);
  assert.equal(snapshot.conflicts.length, 0);
  assert.equal(snapshot.samples, 1);
});
