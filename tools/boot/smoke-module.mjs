import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { projectRoot } from './assets.mjs';

if (!vm.SourceTextModule) {
  const result=spawnSync(process.execPath,['--experimental-vm-modules',...process.argv.slice(1)],{stdio:'inherit',timeout:30000});
  process.exit(result.status ?? 1);
}
const require=createRequire(import.meta.url);
const device=require.resolve('phaser/src/device');
require.cache[device]={id:device,filename:device,loaded:true,exports:{os:{},features:{},browser:{}}};
const math=require('phaser/src/math');
const PluginManager=require('phaser/src/plugins/PluginManager');
const SceneManager=require('phaser/src/scene/SceneManager');
const InjectionMap=require('phaser/src/scene/InjectionMap');
const boot=JSON.parse(await readFile(resolve(projectRoot,'dist/boot-assets.json')));
const jsPath=boot.paths.find(p=>/\/game\..*\.js$/.test(p));
const code=await readFile(resolve(projectRoot,'dist',jsPath),'utf8');
for (const entry of ['index.html','phaser/index.html']) {
  const dom=new JSDOM(await readFile(resolve(projectRoot,'dist',entry),'utf8'),{url:`https://example.test/vampire-district/${entry}`,runScripts:'outside-only'});
  const win=dom.window, scripts=[], pending=[], observers=[], errors=[]; let configuration,requests=0;
  const Observer=win.MutationObserver;
  win.MutationObserver=class extends Observer {constructor(fn){super(fn);observers.push(this);}};
  win.addEventListener('error',event=>errors.push(event.error));
  class Scene {constructor(name){this.sys={settings:{key:name}};}}
  class Game {constructor(config){configuration=config;this.scene={getScene:()=>null,isActive:()=>false};this.events=new EventEmitter();}}
  const engine={VERSION:'3.90.0',Scene,Game,AUTO:0,Math:math,Scale:{NONE:0,NO_CENTER:0},Scenes:{Events:{SHUTDOWN:'shutdown',POST_UPDATE:'postupdate',CREATE:'create'}}};
  win.setTimeout=(fn,ms)=>{pending.push([fn,ms]);return pending.length;}; win.clearTimeout=()=>{};
  win.requestAnimationFrame=()=>1;win.cancelAnimationFrame=()=>{};
  win.matchMedia=()=>({matches:false});
  win.TextEncoder=TextEncoder;win.TextDecoder=TextDecoder;win.AbortController=AbortController;
  win.fetch=()=>{requests++;return Promise.reject(new Error('Network not used by module composition smoke'));};
  const append=win.document.head.appendChild.bind(win.document.head);
  win.document.head.appendChild=node=>{const result=append(node);if(node.tagName==='SCRIPT'){
    scripts.push(node.src);win.Phaser=engine;queueMicrotask(()=>node.dispatchEvent(new win.Event('load')));
  }return result;};
  const context=dom.getInternalVMContext();
  const module=new vm.SourceTextModule(code,{context,identifier:`https://example.test/vampire-district/${jsPath}`,
    initializeImportMeta(meta){meta.url=`https://example.test/vampire-district/${jsPath}`;},
    importModuleDynamically(){throw new Error('Production normal boot must not request another JS module');}});
  try {
    await module.link(()=>{throw new Error('Unbundled static dependency');});await module.evaluate({timeout:10000});
    assert.equal(win.NBD_APP_ERROR,undefined,String(win.NBD_APP_ERROR?.stack||''));
    assert.equal(win.NBD_APP_READY,true);
    assert.deepEqual(scripts,['https://example.test/vampire-district/node_modules/phaser/dist/phaser.min.js']);
    assert.equal(configuration.scene.length,4);
    assert.equal(typeof win.NBD_INTERFACE_VIEW?.mount,'function');
    assert.equal(requests,0);
    assert.equal(win.NBD_MAIN_MENU_THEME.audio.src,'https://example.test/vampire-district/phaser/assets/audio/music/main-menu-theme-01.mp3');
    // Continue beyond Game construction: this boundary previously missed a
    // helper named game() being overwritten by real Phaser Scene injection.
    const ui=new configuration.scene[3](), app=win.NBD_PHASER_GAME;
    // Use the current source's real campaign/runtime and interaction system
    // behind the actual compiled UI, not invented DTOs for the five chapters.
    globalThis.Phaser=engine;
    const {uiHarness}=await import('../../tests/helpers/ui-harness.js');
    const h=await uiHarness();
    app.registry=h.registry;
    const scene=h.scene; scene.game=app;
    ui.events=new EventEmitter();
    ui.sys={scene:ui,settings:{map:InjectionMap,isTransition:false},events:ui.events};
    ui.time={now:0};
    let paused=false;
    ui.scene={get:key=>key==='GameScene'?scene:ui,isPaused:()=>paused,pause(){paused=true;},resume(){paused=false;}};
    PluginManager.prototype.addToScene.call({game:app,plugins:[]},ui.sys,['game','registry'],[]);
    try {
      SceneManager.prototype.create.call({},ui);
      assert.equal(ui.game,app,'Phaser retains its engine field');
      assert.equal(ui.bootError,null,String(ui.bootError?.stack||''));
      assert.ok(ui.renderUi,'compiled UIScene must mount its real React view');
      assert.ok(win.document.querySelector('.vb-hud'),'real initial HUD was committed');
      ui.command('pause'); assert.equal(ui.store.getSnapshot().mode,'pause');
      ui.command('close'); assert.equal(ui.store.getSnapshot().mode,null);
      const settle=async predicate=>{
        for(let i=0;i<20;i++) {if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}
        assert.ok(predicate(),'compiled React state must reach the real DOM');
      };
      ui.command('open',{tab:'tonight'});
      await settle(()=>win.document.querySelectorAll('[role=tab]').length===5);
      assert.ok(win.document.querySelector('.nb-task'),'Tonight must have one dominant task');
      const before=h.v.state.guide;
      for(const [label,chapter,selector] of [['City','city','.vb-city-map'],['Network','network','.nb-person-head'],['Feeding','feeding','.nb-donor-grid'],['Ledger','ledger','.nb-receipt-grid'],['Tonight','tonight','.nb-task']]) {
        const tab=win.document.querySelector(`[role=tab][aria-label="${label}"]`);
        tab.dispatchEvent(new win.MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true}));
        await settle(()=>ui.store.getSnapshot().tab===chapter && win.document.querySelector(selector));
        assert.equal(paused,true);assert.equal(h.v.state.guide,before);
        assert.equal(win.document.querySelector('.vb-choices'),null);
      }
      ui.command('close');await settle(()=>Boolean(win.document.querySelector('.vb-hud')));
      assert.equal(paused,false);assert.equal(app.registry.get('uiKeyboardOwned'),false);
    } finally {ui.cleanup();h.destroy();}
    console.log(`${entry}: packed UI passes real Phaser injection/CREATE and mounts HUD/five Black Book chapters with real campaign data; asset roots preserved. No renderer/browser executed.`);
  } finally {for(const observer of observers) observer.disconnect();await Promise.resolve();assert.equal(errors.length,0,String(errors[0]));dom.window.close();}
}
