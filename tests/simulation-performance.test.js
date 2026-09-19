import test from 'node:test';import assert from 'node:assert/strict';
import {EntityStreamSystem} from '../phaser/src/streaming/EntityStreamSystem.js';
import {projectJourney} from '../phaser/src/streaming/TrafficJourneyPlanner.js';
import {NpcSystem} from '../phaser/src/systems/NpcSystem.js';
import {SpatialHash} from '../phaser/src/utils/SpatialHash.js';

test('NPC spatial batches coalesce requests but queries, visibility and frame exit see current bodies',()=>{
 const system=Object.create(NpcSystem.prototype),a={x:20,y:20,layer:0},b={x:30,y:30,layer:0};
 system.scene={currentLayer:0};system.spatial=new SpatialHash(32);system.npcs=[a];
 let builds=0;const rebuild=system.rebuildSpatialIndexNow;
 system.rebuildSpatialIndexNow=function(){builds++;return rebuild.call(this);};
 system.rebuildSpatialIndex();assert.equal(builds,1);
 system.withSpatialBatch(()=>{
   a.x=90;system.npcs.push(b);system.rebuildSpatialIndex();system.rebuildSpatialIndex();
   assert.equal(builds,1);
   assert.deepEqual(system.queryRadius(90,20,1),[a]);assert.equal(builds,2);
   system.withSpatialBatch(()=>{system.npcs=[b];system.rebuildSpatialIndex();});
   assert.equal(builds,2);
   assert.deepEqual(system.queryRect({x:0,y:0,w:100,h:100,layer:0}),[b]);assert.equal(builds,3);
   b.x=200;system.rebuildSpatialIndex();system.rebuildSpatialIndex();
 });
 assert.equal(builds,4);assert.deepEqual(system.queryRadius(200,30,1),[b]);
 assert.throws(()=>system.withSpatialBatch(()=>{system.npcs=[];system.rebuildSpatialIndex();throw Error('interrupt');}));
 assert.equal(system.spatialBatchDepth,0);assert.equal(system.spatial.size(),0);
 system.npcs=[a];system.rebuildSpatialIndex();assert.equal(system.spatial.size(),1);
});

test('zero-time NPC refresh preserves live pinning, chunk changes and restores visibility flags',()=>{
 let active=false,transitions=0,dormantSteps=0;
 const stream=Object.create(EntityStreamSystem.prototype);
 stream.npcRecords=new Map();stream.vehicleRecords=new Map();stream.transitionLog=[];stream.tick=0;
 stream.scene={cityStreamSystem:{manifest:{chunkSize:512},isChunkActive:()=>active,prefetchedChunkIds:new Set(),stateOf:()=>active?'active':'unloaded'}};
 const transition=stream.transition,advance=stream.advanceDormantNpc;
 stream.transition=function(...args){transitions++;return transition.apply(this,args);};
 stream.advanceDormantNpc=function(...args){dormantSteps++;return advance.apply(this,args);};
 const npc={id:'walker',x:20,y:20,stunnedTimer:2,container:{active:true,visible:true,setActive(v){this.active=v;return this;},setVisible(v){this.visible=v;return this;}}};
 stream.applyNpcState(npc,.2);
 for(let i=0;i<6;i++)stream.applyNpcState(npc,0);
 assert.equal(transitions,1);assert.equal(dormantSteps,1);assert.equal(npc.stunnedTimer,1.8);
 npc.container.active=true;npc.container.visible=true;stream.applyNpcState(npc,0);
 assert.equal(npc.container.active,false);assert.equal(npc.container.visible,false);
 npc.alarmed=true;assert.equal(stream.applyNpcState(npc,0).state,'pinned');assert.equal(npc.container.active,true);
 npc.alarmed=false;active=true;assert.equal(stream.applyNpcState(npc,0).state,'active');
 active=false;stream.applyNpcState(npc,.3);assert.equal(npc.stunnedTimer,1.5);
});

test('offscreen character animation resumes from current time without delaying simulation',()=>{
 const updates=[];
 const npc={container:{visible:false,active:true},characterView:{update(value){updates.push(value.timeMs);}},vx:10,vy:0};
 const system={npcs:[npc],scene:{}};
 NpcSystem.prototype.updateCharacterPresentation.call(system,100);
 npc.container.visible=true;NpcSystem.prototype.updateCharacterPresentation.call(system,200);
 npc.container.active=false;NpcSystem.prototype.updateCharacterPresentation.call(system,300);
 npc.container.active=true;NpcSystem.prototype.updateCharacterPresentation.call(system,400);
 assert.deepEqual(updates,[200,400]);assert.equal(npc.vx,10);
});
test('decision batch shares chunk reads, but alerts and later chunk changes stay immediate',()=>{
 let reads=0,active=true,heat=0;const stream=Object.create(EntityStreamSystem.prototype);
 stream.scene={cityStreamSystem:{manifest:{chunkSize:512},isChunkActive(){reads++;return active;},prefetchedChunkIds:new Set(),stateOf:()=>active?'active':'unloaded'},heatSystem:{level:()=>heat}};
 const npc={x:20,y:20};stream.withDecisionBatch(()=>{assert.equal(stream.npcDecision(npc).state,'active');assert.equal(stream.npcDecision({...npc,x:30}).state,'active');npc.alarmed=true;assert.equal(stream.npcDecision(npc).state,'pinned');});assert.equal(reads,1);
 active=false;npc.alarmed=false;assert.equal(stream.npcDecision(npc).state,'dormant');assert.equal(reads,2);
 assert.throws(()=>stream.withDecisionBatch(()=>{throw Error('test');}));assert.equal(stream.decisionBatch,null);
});
test('route projection preserves exhaustive reference including segment ties',()=>{
 const segments=Array.from({length:60},(_,i)=>({a:{x:i*10,y:(i%3)*3},dx:10,dy:i%2?3:-3,length:Math.hypot(10,3),start:i*11,end:(i+1)*11}));
 const ref=(pose,previous)=>{let best={distance:Infinity,progress:previous};for(const s of segments){if(s.end<previous-70||s.start>previous+160)continue;const t=Math.max(0,Math.min(1,((pose.x-s.a.x)*s.dx+(pose.y-s.a.y)*s.dy)/s.length**2));const distance=Math.hypot(pose.x-s.a.x-s.dx*t,pose.y-s.a.y-s.dy*t);if(distance<best.distance)best={distance,progress:s.start+t*s.length};}return best;};
 for(let i=0;i<1000;i++){const pose={x:(i*37)%700-40,y:(i*17)%120-60},previous=(i*13)%660;assert.deepEqual(projectJourney({segments},pose,previous),ref(pose,previous));}
});

import { sidewalkPatrolRoutesForZone } from '../phaser/src/systems/PoliceSystem.js';
import { pedestrianRoutes, districtZones, districtZoneAt, LAYERS } from '../phaser/src/data/district.js';
test('cached police patrols preserve route order and points in every district', () => {
  for (const zone of districtZones) {
    const expected = pedestrianRoutes.map(route => {
      const seen = new Set();
      const points = route.points.filter(point => {
        if ((point.layer ?? LAYERS.STREET) !== LAYERS.STREET) return false;
        const key = `${Math.round(Number(point.x) || 0)}:${Math.round(Number(point.y) || 0)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(point => ({x:Number(point.x)||0,y:Number(point.y)||0,layer:LAYERS.STREET,crosswalk:Boolean(point.crosswalk)}));
      return {id:route.id,points,surface:'pedestrian'};
    }).filter(route => route.points.length >= 2 && route.points.some(point => districtZoneAt(point.x,point.y).id === zone.id));
    assert.deepEqual(sidewalkPatrolRoutesForZone(zone.id), expected);
    assert.strictEqual(sidewalkPatrolRoutesForZone(zone.id), sidewalkPatrolRoutesForZone(zone.id));
  }
});
