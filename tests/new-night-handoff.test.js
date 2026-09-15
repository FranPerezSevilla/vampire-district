import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { uiHarness } from './helpers/ui-harness.js';
import { InputSystem } from '../phaser/src/input/InputSystem.js';
import { createMenuThemePlayback } from '../phaser/src/audio/MenuThemePlayback.js';

const require = createRequire(import.meta.url);
const device = require.resolve('phaser/src/device');
require.cache[device] = { id: device, filename: device, loaded: true, exports: { os: {}, features: {}, browser: {} } };
const SceneManager = require('phaser/src/scene/SceneManager');
const InjectionMap = require('phaser/src/scene/InjectionMap');
let dom, MainMenuScene, GameSceneCore, controller, gate, mount;
before(async () => {
  dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/', pretendToBeVisual: true });
  for (const key of ['window','document','navigator','HTMLElement','Node','NodeFilter','MutationObserver','Event','MouseEvent','KeyboardEvent','getComputedStyle']) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  globalThis.Phaser = { Scene: class {}, Scenes: { Events: { CREATE: 'create', SHUTDOWN: 'shutdown', POST_UPDATE: 'postupdate' } },
    Math: require('phaser/src/math'), Input: { Keyboard: { JustDown: require('phaser/src/input/keyboard/keys/JustDown') } } };
  ({ MainMenuScene } = await import('../phaser/src/scenes/MainMenuScene.js'));
  ({ GameScene: GameSceneCore } = await import('../phaser/src/scenes/GameSceneCore.js'));
  ({ titleScreenController: controller } = await import('../phaser/src/ui/TitleScreenController.js'));
  ({ titleScreenAudioGate: gate } = await import('../phaser/src/ui/TitleScreenAudioGate.js'));
  await build({entryPoints:['ui/main.jsx'],outfile:'.artifacts/handoff-ui.mjs',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
  ({ mount } = await import('../.artifacts/handoff-ui.mjs'));
});
after(() => { gate.dispose(); dom.window.close(); });

async function harness(t, { launchDelay = 0, failMount = false } = {}) {
  const h = await uiHarness();
  const canvas = document.getElementById('game-root').appendChild(document.createElement('canvas'));
  canvas.tabIndex = 0; h.engine.canvas = canvas;
  h.scene.input = { enabled: true, keyboard: { resetKeys() { for(const key of Object.values(keys)) { key.isDown=false; key._justDown=false; } } } };
  const keys = { s: { enabled: true, isDown: false, _justDown: false } };
  const input = new InputSystem(h.scene, { keys: new Proxy(keys, { get: (target,key) => target[key] || { enabled: false } }), storage: null });
  h.scene.inputSystem = input; h.scene.playerSpeed = 80;
  const media = { paused: true, volume: .28, currentTime: 10, loop: true,
    play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  window.NBD_MAIN_MENU_THEME = createMenuThemePlayback(media);
  await window.NBD_MAIN_MENU_THEME.start();
  const menu = new MainMenuScene();
  let active = true, uiActive = false, launchCount = 0, queued = null;
  menu.sys = { isActive: () => active };
  h.ui.sys = { settings: { isTransition: false }, events: h.ui.events };
  const plugin = { get: key => key === 'GameScene' ? h.scene : key === 'UIScene' ? h.ui : menu,
    isActive: key => key === 'MainMenuScene' ? active : key === 'UIScene' ? uiActive : true,
    isPaused: () => h.paused(), pause: h.ui.scene.pause, resume: h.ui.scene.resume,
    bringToTop() {}, launch(key) {
      assert.equal(key,'UIScene'); launchCount++;
      queued = setTimeout(() => {
        queued = null; uiActive = true;
        // Real Phaser CREATE ordering, including injection already performed by uiHarness.
        SceneManager.prototype.create.call({}, h.ui);
      }, launchDelay);
    }, stop(key) { assert.equal(key,'MainMenuScene'); active = false; menu.cleanup(); }
  };
  menu.scene = plugin; h.ui.scene = plugin; menu.previewScene = h.scene;
  globalThis.NBD_INTERFACE_VIEW = { mount: failMount ? () => { throw new Error('Mount rejected for regression'); } : mount };
  h.registry.set('mainMenuActive',true); menu.lockPreviewControl(h.scene);
  menu.cameraFrame = () => null; // Framing math has its own real-Camera regressions.
  controller.resetToBoot();
  let completion;
  await controller.present({onNewNight: () => { completion = menu.beginNight(); }});
  t.after(() => {
    if (queued !== null) clearTimeout(queued);
    active = false; menu.cleanup(); h.ui.cleanup(); input.destroy(); h.destroy(); canvas.remove();
    controller.resetToBoot(); globalThis.NBD_INTERFACE_VIEW = { mount };
  });
  return { ...h, menu, media, input, keys, launchCount: () => launchCount,
    start: async () => { controller.activateSelected(); return completion; } };
}

test('Phaser global injection cannot replace any UIScene helper with an engine object', async t => {
  const h = await harness(t);
  assert.equal(h.ui.game, h.engine);
  for (const field of Object.values(InjectionMap)) {
    assert.notEqual(typeof Object.getPrototypeOf(h.ui)[field], 'function', `reserved Phaser property: ${field}`);
  }
  assert.doesNotThrow(() => h.ui.refresh());
});

test('New Night boots the actual React HUD through queued Phaser CREATE, stops music, focuses canvas and enables movement', async t => {
  const h = await harness(t);
  assert.equal(h.input.worldEnabled, false);
  assert.equal(document.querySelector('.vb-hud'), null);
  await h.start();
  await delay(25); // React external-store notification; not a fake HUD.
  assert.equal(h.menu.handoffComplete, true);
  assert.equal(h.ui.game, h.engine);
  assert.equal(h.launchCount(),1);
  assert.equal(h.registry.get('mainMenuActive'),false);
  assert.equal(h.registry.get('uiPaused'),false);
  assert.equal(h.scene.input.enabled,true);
  assert.equal(h.input.worldEnabled,true);
  assert.equal(document.activeElement, h.engine.canvas);
  assert.ok(document.querySelector('.vb-hud'));
  assert.equal(controller.root.hidden,true);
  assert.equal(h.media.paused,true);
  assert.equal(window.NBD_MAIN_MENU_READINESS.state,'in-game');
  h.keys.s.isDown = true;
  const frame = h.input.beginFrame();
  assert.equal(frame.worldEnabled,true); assert.equal(frame.move.y,1);
  const y = h.scene.player.y;
  GameSceneCore.prototype.updatePlayerMovement.call(h.scene,.01,frame);
  assert.ok(h.scene.player.y > y, 'real movement method consumes the unlocked input frame');
  h.ui.openDomain('city'); assert.equal(h.paused(),true);
  h.ui.closeActive(); assert.equal(h.paused(),false);
});

test('the title remains visible and input locked until a delayed UI scene has actually created', async t => {
  const h = await harness(t,{launchDelay:80});
  const start = h.start();
  await delay(20);
  assert.equal(controller.state,'menu');assert.equal(controller.root.hidden,false);
  assert.equal(h.input.worldEnabled,false);assert.equal(h.menu.handoffComplete,false);
  await start;assert.equal(h.menu.handoffComplete,true);
});

test('repeated Start requests launch the interface only once', async t => {
  const h = await harness(t,{launchDelay:20});const pending=h.menu.beginNight();
  await h.menu.beginNight();await pending;
  assert.equal(h.launchCount(),1);assert.equal(h.menu.handoffComplete,true);
});

test('a queued UI creation exception leaves a visible failure rather than a hidden menu and dead controls', async t => {
  const h = await harness(t,{failMount:true});
  await h.start();
  assert.equal(h.menu.handoffComplete,false);
  assert.equal(h.input.worldEnabled,false);
  assert.equal(controller.root.hidden,false);
  assert.match(controller.bootMessage.textContent,/Mount rejected for regression/);
  assert.equal(window.NBD_MAIN_MENU_READINESS.state,'failure');
  assert.equal(h.media.paused,true);
  assert.doesNotThrow(()=>h.ui.update());
});

test('pending scene startup is bounded and shutdown removes listeners', async t => {
  const h=await harness(t);h.menu.scene.launch=()=>{};
  await assert.rejects(h.menu.prepareGameplayInterface(15),/startup timed out/);
  assert.equal(h.ui.events.listenerCount('create'),0);
  const pending=h.menu.prepareGameplayInterface();h.menu.cancelUiPreparation();
  await assert.rejects(pending,/cancelled/);assert.equal(h.ui.events.listenerCount('create'),0);
});
