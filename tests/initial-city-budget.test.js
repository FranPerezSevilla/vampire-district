import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootPayload } from '../tools/boot/assets.mjs';
import { ChunkFileStore } from '../phaser/src/streaming/ChunkFileStore.js';
import { ChunkStreamSystem } from '../phaser/src/streaming/ChunkStreamSystem.js';
import { PLAYER } from '../phaser/src/data/balance.js';

const { city } = await createBootPayload();
const initialIds = ['1:1','2:1','3:1','1:2','2:2','3:2','1:3','2:3','3:3'];
function harness(t) {
  let requests = 0;
  const scene = { player: { x: PLAYER.startX, y: PLAYER.startY },
    registry: new Map([['mainMenuActive', true]]), events: { once() {} },
    campaignSystem: { state: { world: { flags: {} } } }, npcSystem: { npcs: [] },
    statePublisher: { setMany() {} },
    redrawLayer() { throw new Error('Do not present partial geometry'); } };
  const store = new ChunkFileStore({ seed: city, fetchImpl: () => { requests++; throw new Error('City transport blocked'); } });
  const stream = new ChunkStreamSystem(scene, { fileStore: store });
  t.after(() => stream.destroy());
  return { scene, store, stream, requests: () => requests };
}

test('all nine embedded chunks still activate when delayed batches cross the old eight-second cutoff', async t => {
  const h = harness(t); await h.stream.initialization;
  let wall = 0; t.mock.method(Date, 'now', () => wall);
  const batches = [], activate = h.stream.processActivationQueue;
  h.stream.processActivationQueue = function(options) {
    const count = activate.call(this, options); batches.push(count);
    wall += 2200; // Controlled clock: reproduce delayed work without a real 11s wait.
    return count;
  };
  await h.stream.prepareInitialView();
  assert.deepEqual(batches, [2,2,2,2,1]);
  assert.deepEqual([...h.stream.activeChunkIds], initialIds);
  assert.equal(h.stream.loadStateOf('3:3'), 'resident');
  assert.equal(h.stream.index.residentChunkIds().length, 9);
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.requests(), 0);
  assert.equal(h.scene.registry.get('mainMenuActive'), true);
  assert.equal(h.stream.initialViewPreparation, null);
});

test('a pre-existing eight-resident/one-queued view finishes without fetching or bypassing the final chunk', async t => {
  const h = harness(t); await h.stream.initialization;
  for (let i = 0; i < 4; i++) h.stream.processActivationQueue({ ids: h.stream.activeChunkIds, present: false });
  assert.equal(h.stream.index.residentChunkIds().length, 8);
  assert.equal(h.stream.loadStateOf('3:3'), 'queued');
  assert.equal(h.stream.isReady(), false);
  await h.stream.prepareInitialView({ timeoutMs: 0 });
  assert.equal(h.stream.loadStateOf('3:3'), 'resident');
  assert.equal(h.stream.isReady(), true);
  assert.ok(h.stream.query('roads', {x:1200,y:1200,w:800,h:800}).length);
  assert.equal(h.requests(), 0);
});

test('zero network-wait budget does not reject compiler data that is already in the activation queue', async t => {
  const h = harness(t); await h.stream.initialization;
  await h.stream.prepareInitialView({ timeoutMs: 0 });
  assert.equal(h.stream.index.residentChunkIds().length, 9);
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.requests(), 0);
});

test('a very late first callback still prepares local geometry instead of treating it as a network failure', async t => {
  const h = harness(t); await h.stream.initialization;
  let wall = 0; t.mock.method(Date, 'now', () => wall);
  const pending = h.stream.prepareInitialView();
  wall = 60000;
  await pending;
  assert.equal(h.stream.index.residentChunkIds().length, 9);
  assert.equal(h.requests(), 0);
});

test('ready local batches use task messages, not repeated sixteen-millisecond timers', async t => {
  const h = harness(t); await h.stream.initialization;
  assert.equal(typeof globalThis.MessageChannel, 'function');
  const original = globalThis.setTimeout, waits = [];
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => { waits.push(ms); return original(fn, ms, ...args); });
  await h.stream.prepareInitialView();
  assert.deepEqual(waits, [], 'no timer or animation-frame gate on embedded local work');
  assert.equal(h.stream.isReady(), true);
});

test('the timer fallback still completes all queued work even with a zero network allowance', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'MessageChannel');
  Object.defineProperty(globalThis, 'MessageChannel', {configurable:true, writable:true, value:undefined});
  t.after(() => Object.defineProperty(globalThis, 'MessageChannel', descriptor));
  const h = harness(t); await h.stream.initialization;
  await h.stream.prepareInitialView({timeoutMs:0});
  assert.equal(h.stream.isReady(), true);
  assert.equal(h.stream.index.residentChunkIds().length, 9);
});

test('blocked transport is still bounded when other initial chunks were already in memory', async t => {
  const h = harness(t);
  h.store.cache.delete('3:3');
  h.store.fetchImpl = () => new Promise(() => {});
  await h.stream.initialization;
  await assert.rejects(h.stream.prepareInitialView({timeoutMs:20}), error => {
    assert.equal(error.message, 'Timed out preparing city: 3:3 (loading)'); return true;
  });
  assert.equal(h.stream.index.residentChunkIds().length, 8);
  assert.equal(h.stream.isReady(), false);
  assert.equal(h.stream.initialViewPreparation, null);
});

test('a genuinely broken activator rejects explicitly instead of looping on queued work', async t => {
  const h = harness(t); await h.stream.initialization;
  let calls = 0; h.stream.processActivationQueue = () => { calls++; return 0; };
  await assert.rejects(h.stream.prepareInitialView(), /City activation made no progress/);
  assert.equal(calls, 1);
  assert.equal(h.stream.isReady(), false);
  assert.equal(h.stream.initialViewPreparation, null);
});

test('failure of the final chunk cannot be hidden by eight valid resident chunks', async t => {
  const h = harness(t); await h.stream.initialization;
  const hydrate = h.stream.index.hydrateChunk;
  h.stream.index.hydrateChunk = function(id, payload) {
    if (id === '3:3') throw new Error('Broken final geometry');
    return hydrate.call(this, id, payload);
  };
  await assert.rejects(h.stream.prepareInitialView({timeoutMs:0}), /Failed activating city chunk 3:3: Broken final geometry/);
  assert.equal(h.stream.index.residentChunkIds().length, 8);
  assert.equal(h.stream.loadStateOf('3:3'), 'error');
  assert.equal(h.stream.isReady(), false);
});
