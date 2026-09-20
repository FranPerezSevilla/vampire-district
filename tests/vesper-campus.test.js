import {fitBuildingToSidewalks} from '../phaser/src/data/BuildingSidewalkClearance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {compileVesperCampus} from '../tools/city-compiler/vesper-campus.js';
import {VESPER_CAMPUS as plan} from '../phaser/src/data/vesper-campus.js';
import {npcDefinitions} from '../phaser/src/data/npcs.js';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
test('Vesper site compiles repeatedly without invading roads or neighbours',()=>{
 const c=compileVesperCampus(city);assert.deepEqual(compileVesperCampus(c),c);
 const own=c.buildings.filter(b=>b.siteId==='club-site');assert.equal(own.filter(b=>!b.campusBarrier).length,5);
 for(const b of own){assert.ok(!c.roads.some(r=>overlap(b,r)),b.id);assert.ok(!c.buildings.some(n=>n.siteId!=='club-site'&&overlap(b,n)),b.id);}
});
test('both alleys connect the forecourt to the rear yard and doors stay accessible',()=>{
 const c=compileVesperCampus(city);
 for(const route of [plan.westAlley,plan.eastAlley,plan.rearYard,plan.forecourt])assert.ok(!c.buildings.some(b=>overlap(b,route)));
 const main=c.buildings.find(b=>b.id==='club'),stage=c.buildings.find(b=>b.id==='club:stage-house');
 assert.equal(main.y+main.h,plan.mainDoor.y);assert.equal(stage.y,plan.backDoor.y);assert.ok(stage.storeys>main.storeys);
 for(const n of npcDefinitions.filter(n=>n.ambientActivity==='club-queue'))assert.ok(!c.buildings.some(b=>overlap(b,{x:n.x-5,y:n.y-5,w:10,h:10})));
});
test('fire escape still targets the real club roof',()=>{
 const c=compileVesperCampus(city),f=c.fireEscapes.find(f=>f.id==='clubFireEscape'),r=c.roofAreas[1].find(r=>r.buildingId==='club:west-wing');
 assert.ok(f.roof.x>=r.x&&f.roof.x<=r.x+r.w&&f.roof.y>=r.y&&f.roof.y<=r.y+r.h);
 assert.ok(!c.buildings.some(b=>overlap(b,{x:f.street.x-5,y:f.street.y-5,w:10,h:10})));
});

test('authored volumes keep the same footprint at runtime',()=>{for(const b of compileVesperCampus(city).buildings.filter(b=>b.siteId==='club-site'))assert.equal(fitBuildingToSidewalks(b,city.sidewalks),b);});

test('rear neighbourhood stays low and obsolete tower links are removed',()=>{
 for(const id of ['old-quarter:block:05','old-quarter:block:02']){
  const b=city.buildings.find(b=>b.id===id);assert.ok(!b.skyline&&b.storeys<=3);assert.ok(!city.buildings.some(b=>b.id===id+':tower-wing'));
  assert.ok(!city.fireEscapes.some(e=>e.id.includes('skyline:'+id)));
  assert.ok(!city.roofAreas[2].some(r=>r.buildingId===id));
 }
 const fences=city.buildings.filter(b=>b.id.startsWith('club:yard-fence'));
 assert.equal(fences.length,3);assert.ok(fences.every(b=>b.renderHeight===29&&b.fenceMaterial==='vesper-fence'));
});


test('fence encloses both flanks up to the frontage without closing the front',()=>{
 const c=compileVesperCampus(city),f=id=>c.buildings.find(b=>b.id==='club:yard-fence-'+id);
 for(const id of ['west','east']){assert.equal(f(id).y,f('north').y+f('north').h);assert.equal(f(id).y+f(id).h,plan.forecourt.y);}
 assert.equal(f('west').x+f('west').w,plan.westAlley.x);
 assert.equal(f('east').x,plan.eastAlley.x+plan.eastAlley.w);
 assert.ok(!c.buildings.filter(b=>b.campusBarrier).some(b=>overlap(b,plan.forecourt)));
});


test('theatre has a taller projecting centre and matching separated wing footprints',()=>{
 const c=compileVesperCampus(city),main=c.buildings.find(b=>b.id==='club');
 const west=c.buildings.find(b=>b.id==='club:west-wing'),east=c.buildings.find(b=>b.id==='club:east-wing');
 assert.equal(west.x+west.w,main.x);assert.equal(main.x+main.w,east.x);
 for(const wing of [west,east]){assert.ok(wing.y+wing.h<main.y+main.h);assert.ok(wing.storeyMetres<main.storeyMetres);assert.equal(wing.roofForm,'mansard');}
 assert.equal(west.theatreFront[1],main.theatreFront[0]);assert.equal(main.theatreFront[1],east.theatreFront[0]);
});
