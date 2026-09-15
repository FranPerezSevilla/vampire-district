import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreparationTask } from '../phaser/src/streaming/PreparationTask.js';

function hostFixture({broken = false, channel = true} = {}) {
  const messages = [], timers = new Map(), ports = []; let next = 1;
  const host = {
    setTimeout(fn, delay) { const id = next++; timers.set(id, {fn, delay}); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  if (channel) host.MessageChannel = class {
    constructor() {
      if (broken) throw new Error('Channel unavailable');
      this.port1 = {onmessage:null, closed:false, close(){this.closed = true;}};
      this.port2 = {closed:false, close(){this.closed = true;}, postMessage:() => messages.push(this.port1.onmessage)};
      ports.push(this.port1, this.port2);
    }
  };
  return {host, messages, timers, ports};
}

test('finite preparation schedules asynchronous messages, deduplicates pending work and closes both ports', () => {
  const h = hostFixture(); let calls = 0;
  const task = createPreparationTask(() => { calls++; }, h.host);
  task.schedule(); task.schedule();
  assert.equal(calls, 0); assert.equal(h.messages.length, 1); assert.equal(h.timers.size, 0);
  h.messages.shift()(); assert.equal(calls, 1);
  task.schedule(); const late = h.messages.shift();
  task.cancel(); task.cancel(); late(); task.schedule();
  assert.equal(calls, 1); assert.ok(h.ports.every(p => p.closed));
  assert.equal(h.ports[0].onmessage, null); assert.equal(h.messages.length, 0);
});

test('pending transport checks use a timer that shutdown cancels', () => {
  const h = hostFixture(); let calls = 0;
  const task = createPreparationTask(() => calls++, h.host);
  task.schedule(16); assert.equal(h.messages.length, 0);
  const [{fn, delay}] = h.timers.values(); assert.equal(delay, 16);
  task.cancel(); fn(); assert.equal(calls, 0); assert.equal(h.timers.size, 0);
  assert.ok(h.ports.every(p => p.closed));
});

test('missing or unsupported channels fall back to cancellable zero-delay tasks', () => {
  for (const options of [{channel:false},{broken:true}]) {
    const h = hostFixture(options); let calls = 0;
    const task = createPreparationTask(() => calls++, h.host);
    task.schedule(); const [{fn, delay}] = h.timers.values(); assert.equal(delay, 0);
    task.cancel(); fn(); assert.equal(calls, 0); assert.equal(h.timers.size, 0);
  }
});

test('a completed task can schedule its next batch but does not leave an autonomous loop', () => {
  const h = hostFixture(); let calls = 0;
  const task = createPreparationTask(() => { if (++calls < 3) task.schedule(); else task.cancel(); }, h.host);
  task.schedule();
  for (let i = 0; i < 3; i++) h.messages.shift()();
  assert.equal(calls, 3); assert.equal(h.messages.length, 0); assert.equal(h.timers.size, 0);
  assert.ok(h.ports.every(p => p.closed));
});
