import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {compileSkyline} from '../tools/city-compiler/skyline.js';
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
test('skyline rebuild is idempotent and courtyards are open collision space',()=>{
 const a=compileSkyline(city),b=compileSkyline(a);assert.deepEqual(a,b);
 assert.equal(a.buildings.filter(b=>b.skyline).length,2);
 for(const e of a.fireEscapes.filter(e=>e.id.startsWith('skyline:'))){
  assert.ok(!a.buildings.some(b=>inside(e.street,b)));
  assert.ok(a.roofAreas[2].some(r=>inside(e.roof,r)));
 }
});
test('skyline jumps retain the refuge tower route and exclude the low Vesper neighbourhood',()=>{
 const routes=city.rooftopRoutes.filter(r=>r.id.startsWith('skyline:'));
 assert.equal(routes.length,2);assert.ok(routes.every(r=>r.id.includes("old-quarter:block:06")&&!r.id.includes("old-quarter:block:05")&&!r.id.includes("old-quarter:block:02")));assert.ok(routes.some(r=>r.id.includes('refugeHighRoof')));
 for(const r of routes){for(const [x,y] of [[r.ax,r.ay],[r.bx,r.by]]) assert.ok(city.roofAreas[2].some(roof=>inside({x,y},roof)));}
 for(const d of city.roofDrops.filter(d=>d.id.startsWith('skyline:'))){assert.equal(d.roof.layer,2);assert.ok(d.height>=26);assert.ok(!city.buildings.some(b=>inside(d.street,b)));}
});
