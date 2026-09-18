import { HOSPITAL_LAYBY } from '../phaser/src/data/hospital-access.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {compileHospitalCampus} from '../tools/city-compiler/hospital-campus.js';
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
test('hospital retains its original footprint and only a narrow approach occupies the pavement',()=>{
 const a=compileHospitalCampus(city),b=compileHospitalCampus(a);assert.deepEqual(a,b);
 assert.equal(a.buildings.find(b=>b.id==='hospital').h,280);
 assert.equal(a.buildings.find(b=>b.id==='hospitalEmergency').y,500);
 const walk={x:484,y:580,w:32,h:110};
 assert.ok(!a.buildings.some(b=>overlap(walk,b)));
 assert.ok(!city.roads.some(b=>overlap(walk,b)));
 const {parking,bounds,points}=HOSPITAL_LAYBY;
 assert.ok(inside(parking,bounds)&&inside({x:parking.x+parking.w,y:parking.y+parking.h},bounds));
 assert.ok(!a.buildings.some(b=>overlap(bounds,b)));
 assert.ok(!city.roads.some(r=>overlap(parking,r)));
 assert.ok(points.filter(p=>p.y===691).every(p=>city.roads.some(r=>inside(p,r))));
});
test('hospital roof travel remains on the resized roofs',()=>{
 const c=compileHospitalCampus(city),roofs=c.roofAreas[1];
 const main=roofs.find(r=>r.buildingId==='hospital'),annex=roofs.find(r=>r.buildingId==='hospitalEmergency');
 const jump=c.rooftopRoutes.find(r=>r.id==='jumpHospitalEmergency');
 assert.ok(inside({x:jump.ax,y:jump.ay},main));assert.ok(inside({x:jump.bx,y:jump.by},annex));
 assert.ok(inside(c.roofDrops.find(d=>d.id==='drop_hospital_courtyard').roof,main));
 assert.ok(inside(c.fireEscapes.find(d=>d.id==='hospitalFireEscape').roof,main));
});
