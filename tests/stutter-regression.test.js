import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Phaser={Scene:class{}};globalThis.window={addEventListener(){},location:{hostname:'localhost'}};globalThis.document={getElementById:()=>null};
const {GameScene}=await import('../phaser/src/scenes/GameScene.js');
test('streaming redraw keeps ground bounds stable until sector changes',()=>{
 let sector='street:1:1',x=500,calls=0;const scene={urbanRenderBounds:null,renderSectorKey:()=>sector,calculateUrbanRenderBounds:()=>{calls++;return{x,y:0,w:100,h:100}}};
 const first=GameScene.prototype.prepareUrbanRenderWindow.call(scene);x=540;assert.strictEqual(GameScene.prototype.prepareUrbanRenderWindow.call(scene),first);assert.equal(calls,1);sector='street:2:1';assert.equal(GameScene.prototype.prepareUrbanRenderWindow.call(scene).x,540);assert.equal(calls,2);
});
