import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {objectiveModel} from '../phaser/src/ui/GameUiProjection.js';

const source = await readFile(new URL('../ui/Hud.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/hud.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../ui/main.jsx', import.meta.url), 'utf8');

test('street HUD is the single mounted gameplay HUD', () => {
  assert.match(main, /import \{ Hud \} from "\.\/Hud\.jsx"/);
  assert.match(main, /<Hud s=\{s\} command=\{command\}\/>/);
  assert.equal((main.match(/function Hud\(/g) || []).length, 0);
  assert.match(main, /import "\.\/hud\.css"/);
});

test('street HUD keeps the existing interaction contracts', () => {
  for (const token of ['vb-hud', 'vb-objective', 'vb-prompt', 'vb-notice', 'Black Book M', 'aria-label="City"', 'command("pause")', 'command("blood")']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /s\.powers\.map/);
  assert.match(source, /s\.vehicle \? <VehiclePanel/);
});

test('sprint 1 uses the approved mockup hierarchy', () => {
  assert.match(source, /vb-street-objective-paper/);
  assert.match(source, /vb-street-objective-pointer/);
  assert.match(source, /function SurvivalPanel/);
  assert.match(source, /vb-street-survival-row/);
  assert.match(source, /BLOOD BAGS/);
  assert.match(source, /vb-street-cash/);
  assert.match(source, /ACT NOW/);
  assert.doesNotMatch(source, /vb-street-vitals-mark/);
  assert.match(css, /SPRINT 1 — objective banner/);
  assert.match(css, /font-family:Impact/);
  assert.match(css, /min-height:104px/);
  assert.match(css, /width:clamp\(340px,27vw,430px\)/);
  assert.match(css, /grid-template-columns:86px minmax\(110px,1fr\) 30px/);
  assert.match(css, /Compact, scan-first, no decorative mascot/);
  assert.match(css, /clip-path:polygon/);
});

test('street HUD is responsive and keeps browser preferences accessible', () => {
  assert.match(css, /clamp\(/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width:1100px\)/);
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:680px\),\(max-height:520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media \(forced-colors:active\)/);
});

test('street HUD uses no external artwork, font or asset request', () => {
  assert.doesNotMatch(css, /url\s*\(/i);
  assert.doesNotMatch(css, /@font-face/i);
  assert.doesNotMatch(source, /<img\b/i);
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
