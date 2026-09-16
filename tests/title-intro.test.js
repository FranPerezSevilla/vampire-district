import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { TitleScreenAudioGate } from '../phaser/src/ui/TitleScreenAudioGate.js';

function harness(play = () => Promise.resolve()) {
  const dom = new JSDOM('<div id="viceblood-title-screen"><p data-title-boot-message></p></div><div id="viceblood-intro" hidden><video id="viceblood-intro-video"></video><button id="viceblood-intro-skip">Skip</button></div>');
  const win = dom.window, video = win.document.querySelector('video');
  let starts = 0, pauses = 0;
  video.play = play; video.pause = () => pauses++;
  win.NBD_MAIN_MENU_THEME = { start: () => { starts++; return Promise.resolve(true); }, stop() {} };
  const gate = new TitleScreenAudioGate({ documentRef: win.document, windowRef: win });
  const waiting = gate.waitForStart();
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  return { dom, win, video, gate, waiting, starts: () => starts, pauses: () => pauses };
}

for (const ending of ['ended', 'Escape', 'error', 'button']) {
  test(`opening waits for ${ending}, then enters menu exactly once`, async () => {
    const h = harness();
    assert.equal(h.gate.introActive, true);
    assert.equal(h.starts(), 0);
    assert.equal(h.win.document.getElementById('viceblood-intro').hidden, false);
    h.win.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'x' }));
    assert.equal(h.starts(), 0);
    if (ending === 'Escape') h.win.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape' }));
    else if (ending === 'button') h.win.document.querySelector('button').click();
    else h.video.dispatchEvent(new h.win.Event(ending));
    assert.equal(await h.waiting, true);
    h.video.dispatchEvent(new h.win.Event('ended'));
    assert.equal(h.starts(), 1);
    assert.equal(h.pauses(), 1);
    assert.equal(h.win.document.getElementById('viceblood-intro').hidden, true);
    h.gate.dispose(); h.dom.window.close();
  });
}

test('rejected playback falls through to the menu', async () => {
  const h = harness(() => Promise.reject(new Error('unsupported')));
  assert.equal(await h.waiting, true);
  assert.equal(h.starts(), 1);
  h.gate.dispose(); h.dom.window.close();
});

test('disposing an opening invalidates a pending play rejection', async () => {
  let reject;
  const h = harness(() => new Promise((_, r) => { reject = r; }));
  h.gate.dispose(); reject(new Error('cancelled'));
  assert.equal(await h.waiting, false);
  await Promise.resolve();
  assert.equal(h.starts(), 0);
  assert.equal(h.pauses(), 1);
  h.dom.window.close();
});
