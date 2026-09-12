import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { uiHarness } from './helpers/ui-harness.js';
import { InteractionSystem } from '../phaser/src/systems/InteractionSystem.js';

// Exercise the installed production policy, not just InteractionSystemCore.
// Real campaign/runtime, Phaser field injection, UIScene.create and React DOM;
// only rendering/time/scene-plugin facilities are fixtures. No browser runs.
let dom, act, h;
const observers = [];
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="game-root"><canvas tabindex="0"></canvas></div><div id="game-ui"><div id="interface-root"></div><div id="ui-overlay-host"></div></div></body></html>', {
    url: 'http://localhost/', pretendToBeVisual: true
  });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'NodeFilter', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    const bound = ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true,
      value: bound ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  const Observer = globalThis.MutationObserver;
  globalThis.MutationObserver = class extends Observer { constructor(callback) { super(callback); observers.push(this); } };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ act } = await import('react'));
  await mkdir('.artifacts', { recursive: true });
  await build({ entryPoints: ['ui/main.jsx'], outfile: '.artifacts/ui-policy-test.mjs', bundle: true,
    format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"development"' } });
  globalThis.NBD_INTERFACE_VIEW = await import('../.artifacts/ui-policy-test.mjs');
  const base = await uiHarness(); base.destroy();
  const { installPlaytestSurfacePolicy } = await import('../phaser/src/policies/PlaytestSurfacePolicy.js');
  installPlaytestSurfacePolicy();
});
beforeEach(async () => {
  h = await uiHarness();
  assert.ok(h.scene.interactionSystem instanceof InteractionSystem);
  assert.equal(h.scene.interactionSystem.__nbdHiddenTraversalPolicy, true);
  await act(async () => h.ui.create());
  assert.equal(h.ui.bootError, null);
});
afterEach(async () => {
  await act(async () => { h.ui.cleanup(); h.destroy(); });
  // Allow Radix's unmount focus restoration to finish before the next case.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
});
after(() => { for (const observer of observers) observer.disconnect(); dom.window.close(); });
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label || node.getAttribute('aria-label') === label);
async function click(node) {
  assert.ok(node, 'requested control must be mounted');
  await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
}
async function press(code, target = document.body) {
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key: code, code, bubbles: true, cancelable: true })));
}
async function tab(label) {
  const node = [...document.querySelectorAll('[role=tab]')].find(item => item.textContent.includes(label));
  assert.ok(node, `${label} tab must exist`);
  await act(async () => {
    node.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
    node.focus();
  });
}
function expectDomain(tabId) {
  assert.equal(h.ui.activeMode(), 'domain');
  assert.equal(h.ui.store.getSnapshot().tab, tabId);
  assert.equal(h.scene.interactionSystem.menu.view, 'vampire-domain');
  assert.equal(document.querySelectorAll('[role=tab]').length, 6);
  assert.ok(document.querySelector('[role=tabpanel][data-state=active]'));
  assert.equal(document.querySelector('.vb-choices'), null, 'never render the old seven-option launcher');
  assert.equal(h.paused(), true);
  assert.equal(h.registry.get('uiPaused'), false);
  assert.equal(h.registry.get('uiKeyboardOwned'), true);
  assert.equal(h.ui.pendingAction, null, 'section navigation must not enqueue a gameplay action');
}

test('installed traversal filter preserves menu metadata, disabled options and hidden-action restrictions', async () => {
  const visible = { id: 'service', label: 'Service', type: 'vampire', disabled: true, run() {} };
  let hiddenCalls = 0;
  const hidden = { id: 'roof', type: 'roofJump', run() { hiddenCalls++; } };
  const presentation = { title: 'Sire services', detail: 'Keep the briefing', view: 'vampire-domain' };
  h.scene.interactionSystem.open([hidden, visible], presentation);
  const snapshot = h.scene.interactionSystem.snapshot();
  assert.equal(snapshot.title, presentation.title); assert.equal(snapshot.detail, presentation.detail);
  assert.equal(snapshot.view, presentation.view);
  assert.equal(snapshot.options.length, 1); assert.equal(snapshot.options[0].disabled, true);
  const previous = h.scene.interactionSystem.menu;
  assert.equal(h.scene.interactionSystem.open([hidden], presentation), false);
  assert.equal(h.scene.interactionSystem.menu, previous);
  assert.equal(h.scene.interactionSystem.runOption(hidden), false); assert.equal(hiddenCalls, 0);
  h.scene.interactionSystem.open([visible]);
  assert.equal(h.scene.interactionSystem.menu.title, 'Choose interaction');
  assert.equal(h.scene.interactionSystem.menu.view, null);
});

test('HUD City opens the domain directly and all six clicked tabs render distinct sections while paused', async () => {
  await click(button('City')); expectDomain('city');
  assert.equal(document.querySelectorAll('.vb-map-district').length, 14);
  const elapsed = h.v.state.elapsed;
  h.scene.currentInputFrame.worldEnabled = false;
  for (const [label, id, content] of [
    ['Contacts', 'contacts', 'Rook Mercer'], ['Herd', 'herd', 'Your herd'],
    ['Resources', 'resources', 'Make the city work for you.'], ['Errand', 'errand', 'No outstanding errand'],
    ['Your power', 'power', 'The city compact'], ['City', 'city', null]
  ]) {
    await tab(label); expectDomain(id);
    if (id === 'city') assert.ok(document.querySelector('.vb-city-map'));
    else assert.ok(document.querySelector('[role=tabpanel][data-state=active]').textContent.includes(content), content);
    assert.equal(h.step(), false); assert.equal(h.v.state.elapsed, elapsed);
  }
  assert.doesNotMatch(document.body.textContent, /undefined|NaN|\[object Object\]/);
});

test('all six number shortcuts and internal links work with the published policy and a locked world frame', async () => {
  await click(button('City'));
  h.scene.currentInputFrame.worldEnabled = false;
  for (const [i, id] of ['city', 'contacts', 'herd', 'resources', 'errand', 'power'].entries()) {
    await press(`Digit${i + 1}`); expectDomain(id);
    assert.equal(h.scene.interactionSystem.menu.index, i);
  }
  await press('Digit5'); await click(button('Find a contact')); expectDomain('contacts');
  await press('Escape');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(h.ui.activeMode(), null); assert.equal(h.paused(), false);
  assert.equal(h.registry.get('uiKeyboardOwned'), false); assert.equal(document.activeElement.tagName, 'CANVAS');
  assert.ok(document.querySelector('.vb-hud'));
});

test('pause-to-city and Errand/M use the same live domain instead of reopening a generic chooser', async () => {
  await click(button('Pause')); assert.equal(h.ui.activeMode(), 'pause');
  await click(button('Your city')); expectDomain('city');
  await click(button('Close window')); await click(button('Errand M')); expectDomain('errand');
  await press('KeyM'); assert.equal(h.ui.activeMode(), null);
  await press('KeyM'); expectDomain('errand');
});

test('map inspection and Go here keep their meaning under the real installed menu wrapper', async () => {
  await click(button('City'));
  const guide = h.v.state.guide;
  await click(document.querySelector('[aria-label="contact: Rook Mercer"]'));
  assert.equal(h.v.state.guide, guide);
  assert.match(document.querySelector('.vb-city-detail').textContent, /Rook Mercer/);
  await click(button('Go here'));
  assert.equal(h.v.state.guide, 'contact:rook'); assert.equal(h.paused(), false);
  assert.equal(h.ui.activeMode(), null); assert.ok(document.querySelector('.vb-hud'));
});

test('contact services retain their title and a real accepted errand opens the domain, not the seven-option list', async () => {
  await act(async () => { assert.equal(h.runtime.openContact('sire'), true); h.ui.refresh(); });
  assert.equal(h.ui.activeMode(), 'interaction');
  assert.match(h.scene.interactionSystem.snapshot().title, /Sire/);
  assert.equal(h.scene.interactionSystem.menu.view, null);
  const workIndex = h.scene.interactionSystem.menu.options.findIndex(option => option.id === 'work:sire');
  const choice = document.querySelectorAll('.vb-choice')[workIndex];
  assert.ok(choice, 'Sire must offer the real work option');
  h.scene.currentInputFrame.worldEnabled = false;
  await click(choice); assert.equal(h.v.state.job, null); assert.ok(h.ui.pendingAction);
  await act(async () => { h.step(); });
  assert.equal(h.v.state.job.issuer, 'sire'); expectDomain('errand');
  assert.match(document.querySelector('.vb-errand').textContent, /Collect the sealed supplies/);
});
