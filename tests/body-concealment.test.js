import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceSystem } from '../phaser/src/systems/EvidenceSystem.js';
import { LAYERS } from '../phaser/src/data/district.js';
globalThis.Phaser ||= {};
globalThis.Phaser.Math = {Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}};
test('body concealment requires a usable dumpster or the sewer layer',()=>{
 const scene={currentLayer:LAYERS.STREET,player:{x:10,y:10},streetFurnitureSystem:{dumpsters:[]}};
 const system={scene,shadowAt:()=>({id:'shadow',name:'Dark alley'})};
 const spot=()=>EvidenceSystem.prototype.currentHideSpot.call(system);
 assert.equal(spot(),null);
 for(const layer of [LAYERS.ROOF_HIGH,LAYERS.ROOF_LOW]){scene.currentLayer=layer;assert.equal(spot(),null);}
 scene.currentLayer=LAYERS.SEWER;assert.equal(spot().id,'sewers');
 scene.currentLayer=LAYERS.STREET;const dumpster={id:'bin',x:12,y:10,radius:30};scene.streetFurnitureSystem.dumpsters=[dumpster];assert.equal(spot().id,'bin');
 dumpster.broken=true;assert.equal(spot(),null);dumpster.broken=false;dumpster.x=500;assert.equal(spot(),null);
});
