import test from 'node:test';
import assert from 'node:assert/strict';
import {createUiStore} from '../phaser/src/ui/UiStore.js';
import {objectiveModel} from '../phaser/src/ui/GameUiProjection.js';
import {coverSize} from '../phaser/src/responsive-layout.js';

test('React snapshots are detached, deeply frozen and cached across unchanged projections',()=>{
 const original={ready:true,domain:{cash:80}}; const s=createUiStore(original);
 assert.equal(Object.isFrozen(original),false); assert.equal(Object.isFrozen(s.getSnapshot().domain),true);
 original.domain.cash=100; assert.equal(s.getSnapshot().domain.cash,80); let notices=0;
 const stop=s.subscribe(()=>notices++), prior=s.getSnapshot();
 assert.equal(s.publish({ready:true,domain:{cash:80}}),false); assert.equal(s.getSnapshot(),prior);
 s.publish(original); assert.equal(notices,1); assert.equal(Object.isFrozen(original.domain),false); stop(); s.publish({cash:2}); assert.equal(notices,1); s.destroy();
});
test('north-facing objective arrow tracks all cardinal directions and arrival',()=>{
 for(const [target,bearing] of [[{x:0,y:-80},0],[{x:80,y:0},90],[{x:0,y:80},180],[{x:-80,y:0},270]]){const m=objectiveModel({x:0,y:0},target); assert.equal(m.bearing,bearing); assert.equal(m.distance,80); assert.equal(m.arrived,false);}
 assert.equal(objectiveModel({x:0,y:0},{x:5,y:10}).arrived,true); assert.equal(objectiveModel(null,{x:0,y:0}),null);
});
test('canvas cover geometry responds to landscape portrait and ultrawide without changing UI size',()=>{
 for(const [width,height] of [[1920,1080],[800,1000],[3440,1440],[360,740]]){const a=coverSize(width,height,2160,1440),b=coverSize(width,height,960,640); assert.deepEqual(a,b); assert.ok(a.width>=width); assert.ok(a.height>=height); assert.ok(Math.abs(a.width/a.height-1.5)<1e-10);}
});

test('the responsive installer measures the app and changes only canvas styles',async()=>{
 const {installResponsiveLayout}=await import('../phaser/src/responsive-layout.js');
 let callback, rect={width:1920,height:1080}; const listeners=new Map(),canvas={width:2160,height:1440,style:{}};
 const app={getBoundingClientRect:()=>rect},host={querySelector:()=>canvas};
 const doc={getElementById(id){assert.ok(['viceblood-app','game-root'].includes(id));return id==='viceblood-app'?app:host;}};
 const win={requestAnimationFrame(fn){callback=fn;return 1;},cancelAnimationFrame(){},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}};
 const dispose=installResponsiveLayout(doc,win); callback(); assert.equal(canvas.style.width,'1920px'); assert.equal(canvas.style.height,'1280px'); assert.equal(win.NBD_VIEWPORT_LAYOUT.uiScale,1);
 rect={width:800,height:1000};listeners.get('resize')();callback(); assert.equal(canvas.style.width,'1500px');assert.equal(canvas.style.left,'-350px');
 canvas.width=960;canvas.height=640;listeners.get('resize')();callback();assert.equal(canvas.style.width,'1500px');dispose();assert.equal(listeners.size,0);
});
