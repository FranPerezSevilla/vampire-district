import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { ChunkFileStore } from "../phaser/src/streaming/ChunkFileStore.js";
import { ChunkStreamSystem } from "../phaser/src/streaming/ChunkStreamSystem.js";
import { PLAYER } from "../phaser/src/data/balance.js";

// Real file store, stream and spatial index; only HTTP transport and scene
// presentation are substituted. No Phaser/render frames, browser or fake ready.
globalThis.Phaser = { Scene: class {} };
globalThis.document = { getElementById: () => null };
globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { hostname: "localhost" } };
const { MainMenuScene } = await import("../phaser/src/scenes/MainMenuScene.js");
const { GameScene } = await import("../phaser/src/scenes/GameScene.js");
const { titleScreenController } = await import("../phaser/src/ui/TitleScreenController.js");
const { titleScreenAudioGate } = await import("../phaser/src/ui/TitleScreenAudioGate.js");
const dataRoot = new URL("../phaser/assets/city/current/", import.meta.url);
const publicRoot = "https://example.test/vampire-district/phaser/assets/city/current/";
const initialIds = ["1:1", "2:1", "3:1", "1:2", "2:2", "3:2", "1:3", "2:3", "3:3"];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) {
  const end = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < end, "bounded test condition did not complete");
    await delay(1);
  }
}
const abortError = () => Object.assign(new Error("Request aborted"), { name: "AbortError" });
function stalled(signal) {
  return new Promise((_, reject) => {
    if (signal?.aborted) reject(abortError());
    else signal?.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}
async function responseFor(path) {
  const body = await readFile(new URL(path, dataRoot), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
}
function harness(t, intercept = () => undefined) {
  const requests = [], batches = [], trace = [];
  const store = new ChunkFileStore({ manifestUrl: `${publicRoot}manifest.json`, maxRetries: 0,
    fetchImpl: async (url, options) => {
      assert.ok(url.startsWith(publicRoot), "chunk URL must remain below the deployed subpath");
      const path = url.slice(publicRoot.length); requests.push(path);
      return intercept(path, options) ?? responseFor(path);
    }
  });
  const scene = new GameScene();
  Object.assign(scene, { player: { x: PLAYER.startX, y: PLAYER.startY },
    registry: new Map([["mainMenuActive", true]]), events: { once() {} },
    statePublisher: { setMany() {} }, campaignSystem: { state: { world: { flags: {} } } },
    npcSystem: { npcs: [], rebuildSpatialIndex() { trace.push("npc-index"); } },
    entityStreamSystem: { update(dt) { assert.equal(dt, 0); trace.push("entities"); } },
    gameplayRuntime: { update() { throw new Error("Gameplay must not advance during preparation"); } },
    radioSystem: { update() { throw new Error("Radio must not advance during preparation"); } }
  });
  const stream = scene.cityStreamSystem = new ChunkStreamSystem(scene, { fileStore: store });
  scene.redrawLayer = () => { assert.equal(stream.isReady(), true, "do not present partial initial geometry"); trace.push("draw"); };
  const activate = stream.processActivationQueue;
  stream.processActivationQueue = function(options) {
    const count = activate.call(this, options); batches.push(count); return count;
  };
  const menu = new MainMenuScene(); menu.sys = { isActive: () => true };
  t.after(() => stream.destroy());
  return { store, scene, stream, menu, requests, batches, trace };
}

test("reproduces the screenshot: downloaded chunks remain queued when a passive waiter receives no frames", async t => {
  const h = harness(t);
  await h.stream.initialization;
  await Promise.all([...h.stream.loadPromises.values()]);
  assert.equal(h.store.stats.chunkRequests, 25);
  assert.equal(h.stream.activationQueue.size, 25);
  assert.equal(h.stream.index.residentChunkIds().length, 0);
  assert.deepEqual([...h.stream.activeChunkIds], initialIds);
  await assert.rejects(h.stream.waitUntilReady(null, 40), error => {
    assert.equal(error.message, `Timed out loading city chunks: ${initialIds.join(", ")}`);
    return true;
  });
});

test("cold title preparation hydrates all nine real chunks without any game frames and draws once", async t => {
  const h = harness(t);
  await h.menu.waitForPreviewGeometry(h.scene);
  assert.equal(h.stream.isReady(), true);
  assert.deepEqual([...h.stream.activeChunkIds], initialIds);
  for (const id of initialIds) assert.equal(h.stream.loadStateOf(id), "resident");
  assert.equal(h.stream.index.residentChunkIds().length, 9);
  assert.ok(h.stream.query("roads", { x: 900, y: 900, w: 1200, h: 1200 }).length > 0);
  assert.ok(h.batches.every(n => n <= h.stream.activationBudget));
  assert.equal(h.batches.reduce((n, v) => n + v, 0), 9);
  assert.deepEqual(h.trace, ["entities", "draw"]);
  assert.equal(h.stream.initialViewPreparation, null);
});

test("already downloaded payloads are hydrated, not treated as ready or downloaded a second time", async t => {
  const h = harness(t);
  await h.stream.initialization; await Promise.all([...h.stream.loadPromises.values()]);
  const count = h.requests.length;
  assert.equal(h.stream.isReady(), false);
  await h.stream.prepareInitialView();
  assert.equal(h.requests.length, count);
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.trace.length, 0, "resource preparation does not render partial batches");
});

test("a stalled optional prefetched chunk cannot hold the required starting view hostage", async t => {
  const h = harness(t, (path, { signal }) => path === "chunks/4-4.json" ? stalled(signal) : undefined);
  await h.menu.waitForPreviewGeometry(h.scene);
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.stream.loadStateOf("4:4"), "loading");
  assert.deepEqual(h.trace, ["entities", "draw"]);
});

test("the initial waiter shares one preparation and frame updates do not compete for hydration", async t => {
  const release = deferred(), finalChunk = deferred();
  const h = harness(t, path => {
    if (path === "manifest.json") return release.promise.then(() => responseFor(path));
    if (path === "chunks/3-3.json") return finalChunk.promise.then(() => responseFor(path));
  });
  const first = h.stream.prepareInitialView();
  assert.equal(h.stream.prepareInitialView(), first);
  release.resolve(); await h.stream.initialization;
  // Hold a required chunk until the ownership assertions. Optional downloads
  // may finish before OR after the faster local preparation; neither order is
  // a contract, and observing their completion cannot prove preparation pending.
  await Promise.all([...h.stream.loadPromises.entries()].filter(([id]) => id !== "3:3").map(([, promise]) => promise));
  assert.ok(h.stream.initialViewPreparation, "required final chunk still owns preparation");
  assert.equal(h.stream.isReady(), false);
  const before = h.stream.index.residentChunkIds().length;
  for (let i = 0; i < 20; i++) h.scene.update(i * 16, 16);
  assert.equal(h.stream.index.residentChunkIds().length, before);
  finalChunk.resolve(); await first;
  assert.equal(h.stream.initialViewPreparation, null);
  assert.equal(h.stream.isReady(), true);
  // Once preparation ends, the original frame-owned prefetch path resumes.
  const previous = h.stream.index.residentChunkIds().length;
  h.scene.update(400, 16);
  assert.ok(h.stream.index.residentChunkIds().length > previous);
});

test("focus changes during loading are followed instead of waiting forever for obsolete active IDs", async t => {
  const h = harness(t, (path, { signal }) => path === "chunks/1-1.json" ? stalled(signal) : undefined);
  const ready = h.stream.prepareInitialView();
  await until(() => h.store.inFlight.has("1:1"));
  h.scene.player = { x: 3900, y: 2500 };
  await ready;
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.stream.activeChunkIds.has("1:1"), false);
  assert.equal(h.stream.centerChunkId, "7:4");
});

test("HTTP and malformed payload errors cannot pass the title readiness gate", async t => {
  for (const variant of ["http", "payload"]) {
    const h = harness(t, path => path === "chunks/2-2.json"
      ? Promise.resolve(variant === "http" ? { ok: false, status: 404 }
        : { ok: true, json: async () => ({ id: "wrong", collections: {} }) }) : undefined);
    await assert.rejects(h.menu.waitForPreviewGeometry(h.scene), variant === "http" ? /HTTP 404.*2-2\.json/ : /payload 2:2 is malformed/);
    assert.equal(h.stream.isReady(), false);
    assert.equal(h.trace.includes("draw"), false);
    assert.equal(h.stream.initialViewPreparation, null);
  }
});

test("activation exceptions reject preparation rather than marking invalid geometry ready", async t => {
  const h = harness(t);
  await h.stream.initialization;
  const hydrate = h.stream.index.hydrateChunk;
  h.stream.index.hydrateChunk = function(id, payload) {
    if (id === "2:2") throw new Error("Invalid compiled geometry");
    return hydrate.call(this, id, payload);
  };
  await assert.rejects(h.menu.waitForPreviewGeometry(h.scene), /Invalid compiled geometry/);
  assert.equal(h.stream.isReady(), false);
  assert.equal(h.trace.includes("draw"), false);
  assert.equal(h.stream.initialViewPreparation, null);
});

test("a missing required response times out with only unresolved IDs and their actual load state", async t => {
  const h = harness(t, (path, { signal }) => path === "chunks/2-2.json" ? stalled(signal) : undefined);
  await assert.rejects(h.stream.prepareInitialView({ timeoutMs: 1000 }), error => {
    assert.equal(error.message, "Timed out preparing city: 2:2 (loading)");
    return true;
  });
  assert.equal(h.stream.initialViewPreparation, null);
  assert.equal(h.stream.isReady(), false);
});

test("manifest failure and a never-finishing manifest are both bounded and cannot present the menu", async t => {
  const bad = harness(t, path => path === "manifest.json" ? Promise.resolve({ ok: false, status: 503 }) : undefined);
  await assert.rejects(bad.menu.waitForPreviewGeometry(bad.scene), /HTTP 503.*manifest\.json/);
  assert.equal(bad.trace.length, 0);
  const stuck = harness(t, path => path === "manifest.json" ? new Promise(() => {}) : undefined);
  await assert.rejects(stuck.stream.prepareInitialView({ timeoutMs: 30 }), /Timed out preparing city: city manifest/);
  assert.equal(stuck.stream.initialViewPreparation, null);
});

test("shutdown cancels preparation immediately and late downloads cannot resurrect the stream", async t => {
  const release = deferred();
  const h = harness(t, path => path === "chunks/2-2.json" ? release.promise.then(() => responseFor(path)) : undefined);
  const pending = h.menu.waitForPreviewGeometry(h.scene);
  await until(() => h.store.inFlight.has("2:2"));
  const loads = [...h.stream.loadPromises.values()];
  h.stream.destroy();
  await assert.rejects(pending, { name: "AbortError" });
  release.resolve(); await Promise.all(loads);
  assert.equal(h.stream.activationQueue.size, 0);
  assert.equal(h.stream.index.residentChunkIds().length, 0);
  assert.equal(h.trace.length, 0);
  const lateManifest = deferred();
  const next = harness(t, path => path === "manifest.json" ? lateManifest.promise.then(() => responseFor(path)) : undefined);
  const waiting = next.stream.prepareInitialView(); next.stream.destroy();
  await assert.rejects(waiting, { name: "AbortError" });
  lateManifest.resolve(); await assert.rejects(next.stream.initialization, { name: "AbortError" });
  assert.equal(next.store.stats.chunkRequests, 0);
});

test("the actual menu handoff waits for audio AND hydrated geometry before accepting the gesture", async t => {
  const h = harness(t), audio = deferred(), gesture = deferred();
  const originalGate = titleScreenAudioGate.waitForStart, originalPresent = titleScreenController.present;
  const originalFailure = titleScreenController.showFailure;
  t.after(() => { titleScreenAudioGate.waitForStart = originalGate; titleScreenController.present = originalPresent; titleScreenController.showFailure = originalFailure; });
  titleScreenAudioGate.waitForStart = () => { assert.equal(h.stream.isReady(), true); h.trace.push("gesture"); return gesture.promise; };
  titleScreenController.present = async () => { h.trace.push("menu"); };
  titleScreenController.showFailure = error => { h.trace.push(`failure:${error.message}`); };
  h.menu.assetsReady = audio.promise;
  h.menu.scene = { bringToTop() {} };
  h.menu.lockPreviewControl = () => true;
  h.menu.composeMenuCamera = () => {};
  h.menu.publishReadiness = state => h.trace.push(state);
  h.menu.activateWorldPreview(h.scene);
  await until(() => h.trace.includes("draw"));
  assert.equal(h.trace.includes("gesture"), false);
  audio.resolve(); await until(() => h.trace.includes("gesture"));
  assert.equal(h.trace.includes("menu"), false);
  gesture.resolve(true); await until(() => h.trace.includes("title-presented"));
  assert.ok(h.trace.indexOf("draw") < h.trace.indexOf("gesture"));
  assert.ok(h.trace.indexOf("gesture") < h.trace.indexOf("menu"));
  assert.equal(h.scene.registry.get("mainMenuActive"), true);
});
