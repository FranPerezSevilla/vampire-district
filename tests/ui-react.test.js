import test, {before, after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {uiHarness} from './helpers/ui-harness.js';
import {cityMapGeometry} from '../phaser/src/ui/GameUiProjection.js';

// jsdom validates DOM events/focus, not CSS layout or a browser's rendering.
let dom,act,mount,h,view;
before(async()=>{
 dom=new JSDOM('<!doctype html><html><body><div id="game-root"><canvas tabindex="0"></canvas></div><div id="game-ui"><div id="interface-root"></div><div id="ui-overlay-host"></div></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
   Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:typeof dom.window[key]==='function'&&['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 }
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 ({act}=await import('react'));
 await mkdir('.artifacts',{recursive:true});
 await build({entryPoints:['ui/main.jsx'],outfile:'.artifacts/ui-test.mjs',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'}});
 ({mount}=await import('../.artifacts/ui-test.mjs'));
});
beforeEach(async()=>{
 h=await uiHarness();
 await act(async()=>{view=mount(document.getElementById('interface-root'),{store:h.ui.store,command:(t,p)=>h.ui.command(t,p),geometry:cityMapGeometry,overlay:document.getElementById('ui-overlay-host'),controls:'WASD · move'});});
});
afterEach(async()=>{await act(async()=>view?.unmount());await settleFocusScope();h.destroy();});
after(()=>dom.window.close());
// Radix FocusScope restores focus in a zero-delay unmount timer. Flush that
// lifecycle boundary rather than racing React's commit or leaking it into another test.
async function settleFocusScope(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});}
const button=label=>[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===label||n.getAttribute('aria-label')===label);
async function click(node){assert.ok(node,'click target must exist');await act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));}
async function tab(name){const n=[...document.querySelectorAll('[role="tab"]')].find(n=>n.textContent.includes(name));assert.ok(n);await act(async()=>{n.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true}));n.focus();});}

test('HUD opens a real domain dialog with the compiled city map and all six native tabs',async()=>{
 assert.ok(document.querySelector('.vb-hud')); await click(button('City'));
 assert.equal(h.paused(),true); assert.ok(document.querySelector('[role="dialog"]')); assert.equal(document.querySelectorAll('[role="tab"]').length,6);
 assert.equal(document.querySelectorAll('.vb-map-district').length,14); assert.equal(document.querySelector('.vb-hud'),null);
 for(const label of ['Contacts','Herd','Resources','Errand','Your power','City']){await tab(label);assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').textContent.includes(label),true);}
 assert.doesNotMatch(document.body.textContent,/undefined|NaN|\[object Object\]/);
});
test('map inspection preserves the objective; Go here uses the real runtime and closes',async()=>{
 await click(button('City')); const before=h.v.state.guide;
 await click(document.querySelector('[aria-label="contact: Rook Mercer"]'));
 assert.equal(h.v.state.guide,before); assert.match(document.querySelector('.vb-city-detail').textContent,/Rook Mercer/);
 await click(button('Go here')); assert.equal(h.v.state.guide,'contact:rook'); assert.equal(h.paused(),false); assert.equal(document.querySelector('[role="dialog"]'),null);
 assert.match(document.querySelector('.vb-objective').textContent,/Rook Mercer/);
});
test('Radix tab keyboard navigation changes real sections once and keeps native focus',async()=>{
 await click(button('City')); const first=document.querySelector('[role="tab"]');
 await act(async()=>{first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true}));await new Promise(r=>setTimeout(r,20));});
 assert.equal(h.runtime.domain.tab,'contacts'); assert.equal(document.activeElement.getAttribute('role'),'tab');
});
test('errand locates the actual handoff and abandonment uses visible confirmation',async()=>{
 await act(async()=>{h.v.meet('sire');h.runtime.acceptDelivery('sire');h.ui.refresh();});
 assert.match(document.querySelector('.vb-errand').textContent,/Collect the sealed supplies/);
 await click(button('Locate')); assert.equal(h.runtime.domain.tab,'city'); assert.match(document.querySelector('.vb-city-detail').textContent,/Collect the sealed supplies/);
 await tab('Errand'); await click(button('Abandon errand…')); assert.ok(h.v.state.job); assert.ok(button('Keep working'));
 await click(button('Keep working')); assert.ok(h.v.state.job); await click(button('Abandon errand…'));await click(button('Abandon errand'));assert.equal(h.v.state.job,null);
});
test('notice text is escaped and does not mount executable markup',async()=>{
 await act(async()=>{h.scene.lastActionText='<img src=x onerror="bad()">';h.ui.refresh();});
 assert.equal(document.querySelector('.vb-notice img'),null);assert.match(document.querySelector('.vb-notice').textContent,/<img/);
});
test('domain close returns focus to the game canvas without a leftover modal',async()=>{
 await click(button('City'));await click(button('Close window'));await settleFocusScope();
 assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.activeElement.tagName,'CANVAS');assert.equal(h.registry.get('uiPaused'),false);
});

test('the real garage coordinator presents service quotes in the same modal root',async()=>{
 const {VehicleMaintenanceUiSystem}=await import('../phaser/src/vehicles/VehicleMaintenanceUiSystem.js');
 const {REFUGE_GARAGE}=await import('../phaser/src/data/vehicle-maintenance.js');
 Object.assign(h.scene.player,{x:REFUGE_GARAGE.x,y:REFUGE_GARAGE.y});h.scene.currentLayer=REFUGE_GARAGE.layer;
 const garage=new VehicleMaintenanceUiSystem(h.scene,h.ui,h.campaign);
 await act(async()=>{assert.equal(garage.open(),true);});
 assert.match(document.querySelector('[role="dialog"]').textContent,/Refuge garage/);
 assert.equal(document.querySelectorAll('.vb-editorial-card').length,garage.snapshot().vehicles.length);
 assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent,/undefined|NaN/);
 await click(button('Close window'));assert.equal(h.registry.get('vehicleMaintenanceOpen'),false);assert.equal(h.paused(),false);garage.destroy();
});
test('Sire dialogue remains present above a dead player and releases only its own pause',async()=>{
 h.scene.playerDamageSystem.state.vitality=0;let ended=false;
 await act(async()=>{void h.ui.presentDialogue({speaker:'The Sire',text:'Get up.',kind:'thought'}).then(()=>{ended=true;});});
 assert.equal(document.querySelector('.vb-hud'),null);assert.match(document.querySelector('.vb-narrative').textContent,/Get up/);assert.equal(h.paused(),true);
 await click(button('Continue'));assert.equal(ended,false,'opening click must not skip dialogue');
 await new Promise(resolve=>setTimeout(resolve,260));await click(button('Continue'));assert.equal(ended,true);assert.equal(h.paused(),false);
});
