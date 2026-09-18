import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {objectiveModel} from '../phaser/src/ui/GameUiProjection.js';

const source = await readFile(new URL('../ui/Hud.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/hud.css', import.meta.url), 'utf8');
const compactCss = await readFile(new URL('../ui/hud-survival-compact.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../ui/main.jsx', import.meta.url), 'utf8');

test('street HUD is the single mounted gameplay HUD', () => {
  assert.match(main, /import \{ Hud \} from "\.\/Hud\.jsx"/);
  assert.match(main, /<Hud s=\{s\} command=\{command\}\/>/);
  assert.equal((main.match(/function Hud\(/g) || []).length, 0);
  assert.match(main, /import "\.\/hud\.css"/);
  assert.match(main, /import "\.\/hud-survival-compact\.css"/);
});

test('street HUD keeps the existing interaction contracts', () => {
  for (const token of ['vb-hud', 'vb-objective', 'vb-prompt', 'vb-notice', 'command("blood")']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(source, /s\.vehicle \? <VehiclePanel/);
});

test('sprint 1 uses the approved mockup hierarchy', () => {
  assert.match(source, /vb-street-objective-paper/);
  assert.match(source, /vb-player-compass/);
  assert.match(source, /function SurvivalPanel/);
  assert.match(source, /vb-street-survival-row/);
  assert.match(source, />BLOOD</);
  assert.match(source, /blood-bag-small\.png/);
  assert.match(source, /vb-street-cash/);
  assert.doesNotMatch(source, /ACT NOW/);
  assert.doesNotMatch(source, /vb-street-vitals-mark/);
  assert.match(css, /SPRINT 1 — objective banner/);
  assert.match(css, /font-family:Impact/);
  assert.match(css, /min-height:104px/);
  assert.match(compactCss, /width: clamp\(285px, 23vw, 355px\)/);
  assert.match(compactCss, /\.vb-street-blood img/);
  assert.match(compactCss, /width: 17px/);
  assert.match(css, /Compact, scan-first, no decorative mascot/);
  assert.match(css, /clip-path:polygon/);
});

test('street HUD is responsive and keeps browser preferences accessible', () => {
  assert.match(css, /clamp\(/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(compactCss, /@media \(max-width: 900px\)/);
  assert.match(compactCss, /@media \(max-width: 680px\), \(max-height: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media \(forced-colors:active\)/);
});

test('street HUD uses only local artwork and no remote font request', () => {
  assert.doesNotMatch(css, /url\s*\(/i);
  assert.doesNotMatch(compactCss, /url\s*\(/i);
  assert.doesNotMatch(css, /@font-face/i);
  assert.doesNotMatch(compactCss, /@font-face/i);
  assert.match(source, /new URL\("\.\.\/assets\/ui\/blood-bag-small\.png", import\.meta\.url\)/);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test('objective projection still reports direction, distance and arrival', () => {
  const far = objectiveModel({x: 100, y: 100}, {x: 400, y: 500, label: 'Vesper', target: 'contact:vesper'});
  assert.equal(far.label, 'Vesper');
  assert.equal(far.target, 'contact:vesper');
  assert.equal(far.distance, 500);
  assert.equal(far.arrived, false);
  assert.ok(Number.isFinite(far.bearing));
  const near = objectiveModel({x: 100, y: 100}, {x: 120, y: 120, label: 'Club'});
  assert.equal(near.arrived, true);
});

test('compass projects the player through camera zoom and canvas CSS scaling', async () => {
  const {playerScreenPosition}=await import('../phaser/src/ui/GameUiProjection.js');
  const game={player:{x:120,y:80},cameras:{main:{scrollX:100,scrollY:50,rotation:0,matrix:{transformPoint:(x,y)=>({x:x*2,y:y*2})}}},game:{canvas:{getBoundingClientRect:()=>({left:10,top:20,width:800,height:600})}},scale:{gameSize:{width:400,height:300}}};
  assert.deepEqual(playerScreenPosition(game),{x:90,y:140,rotation:0});
  game.player.x+=10;
  assert.equal(playerScreenPosition(game).x,130);
  assert.equal(playerScreenPosition(null),null);
});

test('clock advances one hour per five minutes and wraps at midnight', async()=>{
 const {nightClock}=await import('../phaser/src/ui/GameUiProjection.js');
 assert.equal(nightClock(0),'22:00');assert.equal(nightClock(300),'23:00');assert.equal(nightClock(600),'00:00');assert.equal(nightClock(-1),'22:00');
});

test('quiet hints use authoritative action keys, including vehicle confirm remapping',async()=>{
 const {interactionHint}=await import('../phaser/src/ui/GameUiProjection.js');
 assert.deepEqual(interactionHint({movement:{type:'vehicleEnter'}}),{key:'INTRO',text:'Entrar en coche'});
 assert.deepEqual(interactionHint({movement:{type:'vehicleExit'},bindings:{confirm:'P'}}),{key:'P',text:'Salir del coche'});
 assert.deepEqual(interactionHint({prompt:'E: Talk',bindings:{interact:'K'}}),{key:'K',text:'Interactuar'});
 assert.equal(interactionHint(),null);
});
