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
  assert.equal(document.querySelectorAll('[role=tab]').length, 5);
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

test('HUD City opens the domain directly and all five clicked chapters render distinct sections while paused', async () => {
  await click(button('City')); expectDomain('city');
  assert.equal(document.querySelectorAll('.vb-map-district').length, 14);
  const elapsed = h.v.state.elapsed;
  h.scene.currentInputFrame.worldEnabled = false;
  for (const [label, id, content] of [
    ['Network', 'network', 'Rook Mercer'], ['Feeding', 'feeding', 'People, not hunting grounds.'],
    ['Ledger', 'ledger', 'Make the city work for you.'], ['Tonight', 'tonight', 'No outstanding errand'], ['City', 'city', null]
  ]) {
    await tab(label); expectDomain(id);
    if (id === 'city') assert.ok(document.querySelector('.vb-city-map'));
    else assert.ok(document.querySelector('[role=tabpanel][data-state=active]').textContent.includes(content), content);
    assert.equal(h.step(), false); assert.equal(h.v.state.elapsed, elapsed);
  }
  assert.doesNotMatch(document.body.textContent, /undefined|NaN|\[object Object\]/);
});

test('all five number shortcuts and internal links work with the published policy and a locked world frame', async () => {
  await click(button('City'));
  h.scene.currentInputFrame.worldEnabled = false;
  for (const [i, id] of ['tonight', 'city', 'network', 'feeding', 'ledger'].entries()) {
    await press(`Digit${i + 1}`); expectDomain(id);
    assert.equal(h.scene.interactionSystem.menu.index, i);
  }
  await press('Digit1'); await click(button('Find a contact')); expectDomain('network');
  await press('Escape');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(h.ui.activeMode(), null); assert.equal(h.paused(), false);
  assert.equal(h.registry.get('uiKeyboardOwned'), false); assert.equal(document.activeElement.tagName, 'CANVAS');
  assert.ok(document.querySelector('.vb-hud'));
});

test('pause-to-city and Errand/M use the same live domain instead of reopening a generic chooser', async () => {
  await click(button('Pause')); assert.equal(h.ui.activeMode(), 'pause');
  await click(button('Your city')); expectDomain('city');
  await click(button('Close window')); await click(button('Black Book M')); expectDomain('tonight');
  await press('KeyM'); assert.equal(h.ui.activeMode(), null);
  await press('KeyM'); expectDomain('tonight');
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
  assert.equal(h.v.state.job.issuer, 'sire'); expectDomain('tonight');
  assert.match(document.querySelector('.vb-errand').textContent, /Collect the sealed supplies/);
});

// Gothic-punk redesign: verify the actual new information hierarchy and cross-
// references against the live campaign. No extra game state is invented by UI.
test('Black Book opens Tonight with one clear next step, and M closes the same book', async () => {
  const guide = h.v.state.guide;
  await click(button('Black Book M')); expectDomain('tonight');
  assert.equal(document.querySelectorAll('.nb-task').length, 1);
  assert.match(document.querySelector('.nb-task').textContent, /Meet The Sire/);
  assert.match(document.querySelector('.nb-night-margin').textContent, /No carried blood/);
  assert.equal(h.v.state.guide, guide);
  await press('KeyM'); assert.equal(h.ui.activeMode(), null); assert.equal(h.paused(), false);
});

test('legacy entry requests resolve to the five chapters without losing the compact disclosure', async () => {
  for (const [oldName, chapter] of [['overview','tonight'],['errand','tonight'],['map','city'],['contacts','network'],['herd','feeding'],['resources','ledger'],['power','ledger']]) {
    await act(async () => h.ui.openDomain(oldName)); expectDomain(chapter);
    if (oldName === 'power') assert.equal(document.querySelector('.nb-compact').open, true);
  }
  await press('Digit6'); expectDomain('ledger');
  assert.equal(h.ui.bootError, null);
});

test('city record opens the correct contact file and its donor and business links keep the selected person', async () => {
  await click(button('City'));
  await click(document.querySelector('[aria-label="contact: Vesper Vale"]'));
  await click(button('Open full file')); expectDomain('network');
  assert.match(document.querySelector('.vb-person-detail h2').textContent, /Vesper Vale/);
  const donorLink = [...document.querySelectorAll('.nb-linked-files button')].find(n=>n.textContent.includes('Iris'));
  await click(donorLink); expectDomain('feeding');
  assert.match(document.querySelector('.nb-donor-card[data-selected=true]').textContent, /Iris/);
  await click(document.querySelector('.nb-donor-card[data-selected=true] .nb-patron button')); expectDomain('network');
  const businessLink = [...document.querySelectorAll('.nb-linked-files button')].find(n=>n.textContent.includes('Club feeding rooms'));
  await click(businessLink); expectDomain('ledger');
  assert.match(document.querySelector('.nb-receipt[data-selected=true]').textContent, /Club feeding rooms/);
  await click(document.querySelector('.nb-receipt[data-selected=true] .nb-operator')); expectDomain('network');
  assert.match(document.querySelector('.vb-person-detail h2').textContent, /Vesper Vale/);
});

test('a territorial permit never invents donor consent, and Feeding leads to the actual patron', async () => {
  h.campaign.huntingLaw.grantRight({id:'book-right',districtId:'old-quarter',factionId:'first_estate'});
  await click(button('Black Book M')); await tab('Feeding'); expectDomain('feeding');
  const iris=[...document.querySelectorAll('.nb-donor-card')].find(n=>n.textContent.includes('Iris'));
  assert.match(iris.textContent,/No active agreement/);
  assert.match(document.querySelector('.nb-hunting-note').textContent,/1 of 14 districts/);
  assert.match(document.querySelector('.nb-hunting-note').textContent,/Protected prey, witnesses and personal consent/);
  const arrange=[...iris.querySelectorAll('button')].find(n=>n.textContent==='Arrange access');
  await click(arrange); expectDomain('network');
  assert.match(document.querySelector('.vb-person-detail h2').textContent,/Vesper Vale/);
  assert.match(document.querySelector('.vb-person-detail').textContent,/First, earn an introduction/);
});

test('Feeding carried-blood button uses the existing once-only resumed transaction', async () => {
  h.v.state.bloodBags=2;
  await click(button('Black Book M')); await tab('Feeding');
  assert.equal(document.querySelectorAll('.nb-bag-rack [data-full=true]').length,2);
  await click(button('Use carried blood')); assert.equal(h.v.state.bloodBags,2);
  assert.equal(h.ui.activeMode(),null); assert.ok(h.ui.pendingAction);
  await act(async()=>{h.step();});
  assert.equal(h.v.state.bloodBags,1);assert.equal(h.scene.feedingSystem.hunger,15);
  assert.equal(h.paused(),false);assert.equal(h.ui.pendingAction,null);
});

test('Tonight prioritises the current errand without hiding the urgent blood warning', async () => {
  h.v.meet('sire');h.runtime.acceptDelivery('sire');h.scene.feedingSystem.hunger=90;
  await act(async()=>h.ui.refresh());expectDomain('tonight');
  assert.equal(document.querySelectorAll('.nb-task').length,1);
  assert.match(document.querySelector('.nb-task h3').textContent,/Collect the sealed supplies/);
  assert.match(document.querySelector('.nb-condition.urgent').textContent,/Hunger is critical/);
  const before=h.v.state.guide;await click(button('Find blood'));expectDomain('feeding');
  assert.equal(h.v.state.guide,before);assert.ok(h.v.state.job);
  await press('KeyM');expectDomain('tonight');
});

test('installed playtest restrictions never advertise unavailable incident or power actions', async () => {
  assert.deepEqual(h.ui.store.getSnapshot().powers.map(p=>p.id),['whisper','beast']);
  await click(button('Black Book M'));
  assert.equal(button('Read incident file'),undefined);
  assert.match(document.querySelector('.nb-incident-slip').textContent,/Police respond to crime/);
  await press('KeyL');expectDomain('tonight');
  await click(button('Return to the streets'));
  await click(button('Pause'));
  assert.equal(button('Police & the Veil'),undefined);
  assert.doesNotMatch(document.querySelector('.vb-controls').textContent,/Dash|Blood Sense|Night Ledger|Traverse available/);
  assert.match(document.querySelector('.vb-controls').textContent,/Black Book/);
  await click(button('Resume night'));
  assert.equal(h.paused(),false);assert.equal(h.registry.get('uiPaused'),false);assert.equal(h.registry.get('uiKeyboardOwned'),false);
});

test('district selector reads the real owner, reception and separate hunting permit', async () => {
  await click(button('City'));expectDomain('city');
  assert.equal(button('Hunting rights').getAttribute('aria-pressed'),'true');
  const select=document.querySelector('[aria-label="Inspect a district"]');
  assert.equal(select.options.length,14);
  await act(async()=>{select.value='old-quarter';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.match(document.querySelector('.nb-permit').textContent,/NO GENERAL PERMIT/);
  assert.match(document.querySelector('.vb-city-detail').textContent,/How they receive you/);
  assert.equal(h.ui.store.getSnapshot().selection,'district:old-quarter');
});
