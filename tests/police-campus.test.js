import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {compilePoliceCampus} from '../tools/city-compiler/police-campus.js';
import {POLICE_CAMPUS as plan,POLICE_WALL_HEIGHT} from '../phaser/src/data/police-campus.js';
import {attachedTurrets} from '../phaser/src/rendering/CornerTurrets.js';
import {scaledBuildingHeight} from '../phaser/src/rendering/WorldScale.js';
import {vehicleDefinitions} from '../phaser/src/data/vehicles.js';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
test('perimeter is one storey with thin elevated railings rather than full-height fence planes',()=>{
 const cityPlan=compilePoliceCampus(city);
 for(const wall of cityPlan.buildings.filter(b=>b.fenceHeight)){
  assert.equal(scaledBuildingHeight(wall),POLICE_WALL_HEIGHT);
  const [fence]=attachedTurrets(wall,scaledBuildingHeight(wall));
  assert.equal(fence.renderBaseHeight,POLICE_WALL_HEIGHT);
  assert.equal(fence.renderHeight,POLICE_WALL_HEIGHT+22);
  assert.equal(Math.min(fence.w,fence.h),1.2);
 }
});
test('precinct compilation is idempotent and respects public roads and neighbouring footprints',()=>{
 const c=compilePoliceCampus(city);assert.deepEqual(compilePoliceCampus(c),c);
 const precinct=c.buildings.filter(b=>b.siteId==='police-site');
 for(const b of precinct){
  assert.ok(!city.roads.some(r=>overlap(b,r)),b.id+' overlaps road');
  assert.ok(!c.buildings.some(other=>other.siteId!=='police-site'&&overlap(b,other)),b.id+' overlaps neighbour');
 }
 assert.equal(c.buildings.find(b=>b.id==='police').storeys,6);
 assert.equal(c.buildings.find(b=>b.id==='police:west-wing').storeys,3);
});
test('pedestrian route and bays stay clear while the motor gate closes the vehicle entrance',()=>{
 const c=compilePoliceCampus(city);
 assert.ok(!c.buildings.some(b=>overlap(plan.walk,b)));
 for(const bay of plan.bays)assert.ok(!c.buildings.some(b=>overlap(bay,b)));
 assert.ok(c.buildings.some(b=>b.campusBarrier==='gate'&&overlap(plan.vehicleGate,b)));
 const r=c.roofAreas[1].find(r=>r.buildingId==='police'),p=c.roofDrops.find(d=>d.id==='drop_police_service').roof;
 assert.ok(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);
});
test('stepped crown stays inside the tower and patrol vehicles occupy separate bays',()=>{
 const main=compilePoliceCampus(city).buildings.find(b=>b.id==='police');
 const height=scaledBuildingHeight(main),tiers=attachedTurrets(main,height);
 assert.equal(tiers.length,2);
 assert.ok(tiers[0].renderHeight>height&&tiers[1].renderHeight>tiers[0].renderHeight);
 for(const t of tiers)assert.ok(t.x>main.x&&t.y>main.y&&t.x+t.w<main.x+main.w&&t.y+t.h<main.y+main.h);
 for(let i=0;i<4;i++){
  const v=vehicleDefinitions.find(v=>v.id==='precinct_cruiser_'+i),bay=plan.bays[i];
  assert.ok(v.parked&&v.x>bay.x&&v.x<bay.x+bay.w&&v.y>bay.y&&v.y<bay.y+bay.h);
 }
});

test('side railings meet both perimeter cross rails without corner gaps',()=>{
 const c=compilePoliceCampus(city);
 const rail=id=>{const b=c.buildings.find(b=>b.id==='police:'+id);return attachedTurrets(b,scaledBuildingHeight(b))[0];};
 const north=rail('north'),front=rail('front-west');
 for(const id of ['west','east']){const side=rail(id);assert.ok(side.y<=north.y);assert.ok(side.y+side.h+1e-8>=front.y+front.h);}
});
