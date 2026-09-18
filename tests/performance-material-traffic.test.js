import test from 'node:test';import assert from 'node:assert/strict';
import {TrafficLocalBehaviorSystem} from '../phaser/src/streaming/TrafficLocalBehaviorSystem.js';
import {BuildingMaterialImages} from '../phaser/src/rendering/BuildingMaterialImages.js';
test('lane junction candidates preserve order and null exclusion without repeated projections',()=>{
 let calls=0;const system=Object.create(TrafficLocalBehaviorSystem.prototype);system.junctions=[{id:'a'},{id:'b'},{id:'c'}];system.junctionProjection=j=>{calls++;return j.id==='b'?null:{progress:j.id==='a'?.2:.8};};const lane={};
 const first=system.junctionsForLane(lane);assert.deepEqual(first.map(c=>c.junction.id),['a','c']);assert.equal(calls,3);
 assert.equal(system.junctionsForLane(lane),first);assert.equal(calls,3);system.junctionsForLane({});assert.equal(calls,6);
 system.laneJunctionCandidates=new WeakMap();system.junctionsForLane(lane);assert.equal(calls,9);
});
test('static front glow is composited once; side glow keeps its independent tint',()=>{
 let uploads=0,draws=0,removes=0;const ctx={save(){},restore(){},setTransform(){},drawImage(){draws++;}};
 const texture={getSourceImage:()=>({width:100,height:200,getContext:()=>ctx}),source:[{update(){uploads++;}}]};
 const owner=Object.create(BuildingMaterialImages.prototype);owner.bakeFacade=()=>({key:'wall',lightKey:'light'});owner.scene={textures:{get:()=>texture,remove(){removes++;}}};
 assert.equal(owner.facade({},50,true).lightKey,null);assert.deepEqual([uploads,draws,removes],[1,1,1]);
 assert.equal(owner.facade({},50,false).lightKey,'light');assert.deepEqual([uploads,draws,removes],[1,1,1]);
});
