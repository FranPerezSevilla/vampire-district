import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { coverSize, installResponsiveLayout } from '../phaser/src/responsive-layout.js';

// Load the pinned engine's actual camera math, not an emulation. Only device
// detection is isolated; no browser, canvas renderer or WebGL context is created.
const require = createRequire(import.meta.url);
const device = require.resolve('phaser/src/device');
require.cache[device] = { id: device, filename: device, loaded: true, exports: { os: {}, features: {}, browser: {} } };
const Camera = require('phaser/src/cameras/2d/Camera');
globalThis.Phaser = { Scene: class {}, Math: require('phaser/src/math') };
globalThis.document = { getElementById: () => null };
globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { hostname: 'localhost' } };
const { MainMenuScene } = await import('../phaser/src/scenes/MainMenuScene.js');
const { GameScene } = await import('../phaser/src/scenes/GameScene.js');
const { CAMERA } = await import('../phaser/src/data/balance.js');
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} should equal ${expected}`);

function framing(width, height, renderScale) {
  const layout = coverSize(width, height, 960 * renderScale, 640 * renderScale);
  document.getElementById = id => id === 'game-root' ? { getBoundingClientRect: () => ({ width, height }) } : null;
  window.NBD_RESOLUTION_PRESET = { renderScale };
  const game = new GameScene();
  game.player = { x: 1540, y: 1575 };
  const camera = new Camera(0, 0, 960 * renderScale, 640 * renderScale).setBounds(0, 0, 4800, 3600);
  camera.setZoom(game.cameraZoomForLayer());
  game.cameras = { main: camera };
  game.game = { canvas: { getBoundingClientRect: () => layout } };
  const menu = new MainMenuScene(); menu.previewScene = game;
  const projected = () => {
    camera.preRender();
    const point = camera.matrix.transformPoint(game.player.x - camera.scrollX, game.player.y - camera.scrollY);
    return { x: (layout.left + point.x * layout.width / camera.width) / width,
      y: (layout.top + point.y * layout.height / camera.height) / height };
  };
  return { game, menu, camera, projected };
}

test('real Phaser camera keeps the player at 72% in the menu and 50% after New Night, across quality and crop', () => {
  for (const [width, height] of [[1920,1080],[1366,768],[3440,1440],[800,1000],[8192,4196]]) {
    for (const scale of [1.5,2,2.25,3]) {
      const h = framing(width,height,scale);
      h.menu.composeMenuCamera();
      closeTo(h.projected().x, .72); closeTo(h.projected().y, .5);
      // The visible camera region remains inside the existing drawing window.
      assert.ok(h.camera.worldView.x >= h.game.player.x - 680);
      assert.ok(h.camera.worldView.right <= h.game.player.x + 680);
      const frame = h.menu.cameraFrame();
      h.menu.cameraTransitionFrom = { x: h.camera.scrollX, y: h.camera.scrollY };
      h.menu.cameraTransitionStartedAt = performance.now() - 500;
      h.menu.updateCameraTransition();
      closeTo(h.projected().x, .5); closeTo(h.projected().y, .5);
      closeTo(h.camera.scrollX, frame.centeredX);
      h.camera.destroy();
    }
  }
});

test('layer zoom is initialized before composing the preview, not deferred until the first gameplay frame', () => {
  const h = framing(1920,1080,2.25); h.camera.setZoom(1);
  h.menu.sys = { isActive: () => true };
  h.menu.scene = { bringToTop() {} };
  h.menu.lockPreviewControl = () => true;
  h.menu.publishReadiness = () => {};
  h.menu.assetsReady = new Promise(() => {});
  h.menu.waitForPreviewGeometry = () => new Promise(() => {});
  h.game.registry = new Map();
  h.menu.activateWorldPreview(h.game);
  assert.equal(h.camera.zoom, CAMERA.streetZoom * 2.25);
  closeTo(h.projected().x,.72);
  assert.equal(h.game.registry.get('mainMenuActive'),true);
  h.camera.destroy();
});

test('600 title frames hydrate chunks but never advance gameplay, traffic, character movement or radio', () => {
  const game = new GameScene(); game.registry = new Map([['mainMenuActive',true]]);
  let chunks=0,packs=0,simulation=0,radio=0,presentation=0;
  game.cityStreamSystem={update(){chunks++;}};
  game.districtPackSystem={update(){packs++;}};
  game.gameplayRuntime={update(){simulation++;}};
  game.radioSystem={update(){radio++;}};
  game.updateCharacterPresentation=()=>{presentation++;};
  for(let i=0;i<600;i++) game.update(i*16,16);
  assert.deepEqual({chunks,packs,simulation,radio,presentation},{chunks:600,packs:600,simulation:0,radio:0,presentation:0});
  game.registry.set('mainMenuActive',false); game.update(9600,16);
  assert.deepEqual({simulation,radio,presentation},{simulation:1,radio:1,presentation:1});
});

test('preview readiness waits for resident geometry and surfaces a load failure instead of displaying holes', async () => {
  const menu=new MainMenuScene();menu.sys={isActive:()=>true};
  const manifest=deferred(),chunks=deferred();const calls=[];
  const game={cityStreamSystem:{initialization:manifest.promise,waitUntilReady(){calls.push('wait');return chunks.promise;}},
    entityStreamSystem:{update(dt){assert.equal(dt,0);calls.push('entities');}},redrawLayer(){calls.push('draw');}};
  let finished=false;const ready=menu.waitForPreviewGeometry(game).then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);assert.deepEqual(calls,[]);
  manifest.resolve();await Promise.resolve();assert.deepEqual(calls,['wait']);assert.equal(finished,false);
  chunks.resolve();await ready;assert.deepEqual(calls,['wait','entities','draw']);
  await assert.rejects(menu.waitForPreviewGeometry({cityStreamSystem:{initialization:Promise.resolve(),waitUntilReady:()=>Promise.reject(new Error('chunk unavailable'))}}),/chunk unavailable/);
});

test('canvas cover resize synchronizes Phaser pointer bounds and display scale without resizing DOM UI', () => {
  let callback,rect={width:1920,height:1080},bounds=0,mapping;
  const listeners=new Map(),canvas={width:2700,height:1800,style:{}};
  const app={getBoundingClientRect:()=>rect};
  const doc={getElementById:id=>id==='viceblood-app'?app:id==='game-root'?{querySelector:()=>canvas}:null};
  const win={NBD_PHASER_GAME:{scale:{gameSize:{width:2160,height:1440},baseSize:{width:2160,height:1440},
    updateBounds(){bounds++;},displayScale:{set(x,y){mapping={x,y};}}}},
    requestAnimationFrame(fn){callback=fn;return 1;},cancelAnimationFrame(){},
    addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}};
  const dispose=installResponsiveLayout(doc,win);callback();
  assert.equal(bounds,1);closeTo(mapping.x,2160/1920);closeTo(mapping.y,1440/1280);
  rect={width:800,height:1000};listeners.get('resize')();callback();
  assert.equal(canvas.style.left,'-350px');closeTo(mapping.x,2160/1500);assert.equal(win.NBD_VIEWPORT_LAYOUT.uiScale,1);
  dispose();assert.equal(listeners.size,0);
});

test('title and HUD typography follow viewport-relative CSS without the old fixed logo ceiling or root transform', () => {
  const viewport=source('phaser/viewport.css'),title=source('phaser/title-screen.css'),ui=source('ui/interface.css');
  assert.match(viewport,/html\{font-size:max\(100%,min\(1vw,1\.8vh\)\)\}/);
  assert.match(title,/width: min\(32vw, 38rem\)/);
  assert.match(ui,/font-size:0\.9375rem/);
  for (const css of [title,ui]) assert.doesNotMatch(css,/font(?:-size)?\s*:[^;{}]*\dpx/);
  assert.doesNotMatch(viewport,/transform:.*scale|zoom:/);
  // A 4x CSS viewport (e.g. zoomed-out tab) does not retain a 430 CSS-pixel cap.
  const unit=(w,h)=>Math.max(16,Math.min(w*.01,h*.018));
  const logo=(w,h)=>Math.min(w*.32,38*unit(w,h));
  closeTo(logo(8192,4196)/4,logo(2048,1049));
});
