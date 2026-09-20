import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {CATHEDRAL_CAMPUS as plan,cathedralCollisionVolumes,cathedralVisualVolumes,cathedralInteriorAt,cathedralCutaway} from '../phaser/src/data/cathedral-campus.js';
import {compileCathedralCampus} from '../tools/city-compiler/cathedral-campus.js';
import {fitBuildingToSidewalks} from '../phaser/src/data/BuildingSidewalkClearance.js';
import {cathedralRoofPlanes} from '../phaser/src/rendering/CathedralArchitecture.js';
import {roofParallaxOffset,buildingHeight} from '../phaser/src/rendering/BuildingParallax.js';
import {npcDefinitions} from '../phaser/src/data/npcs.js';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const clear=(x,y)=>!city.buildings.some(b=>overlap({x:x-5,y:y-7,w:10,h:14},b));
function walk(from,to){
 const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.ceil(distance/2);
 for(let i=0;i<=steps;i++){const t=i/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;assert.ok(clear(x,y),`blocked at ${x},${y}`);}
}
test('cathedral fits its block without changing roads and compiles idempotently',()=>{
 const result=compileCathedralCampus(city);assert.deepEqual(compileCathedralCampus(result),result);
 assert.deepEqual(result.roads,city.roads);
 for(const b of result.buildings.filter(b=>b.cathedralCollider)){
  assert.ok(!city.roads.some(r=>overlap(r,b)),b.id);
  assert.ok(!city.sidewalks.some(r=>overlap(r,b)),b.id);
  assert.ok(!result.buildings.some(other=>!other.cathedralCollider&&overlap(other,b)),b.id);
  assert.equal(fitBuildingToSidewalks(b,city.sidewalks),b);
  assert.ok(b.x>=plan.site.x&&b.y>=plan.site.y&&b.x+b.w<=plan.site.x+plan.site.w&&b.y+b.h<=plan.site.y+plan.site.h);
 }
});
test('a player-sized body can walk from street to altar, both side exits and chapels',()=>{
 walk({x:3916,y:730},{x:3916,y:324});
 walk({x:3700,y:400},{x:4120,y:400});
 walk({x:3808,y:400},{x:3808,y:508});
 walk({x:4024,y:400},{x:4024,y:508});
 walk({x:3916,y:425},{x:3808,y:425});
 walk({x:3916,y:425},{x:4024,y:425});
});
test('all wall, furniture and pier footprints block movement',()=>{
 for(const b of cathedralCollisionVolumes())assert.equal(clear(b.x+b.w/2,b.y+b.h/2),false,b.id);
 assert.equal(city.buildings.find(b=>b.id==='cathedral').cathedralCollider,true);
 // The nave volume is deliberately absent from collision; its floor is walkable.
 assert.ok(clear(3916,550));
 for(const npc of npcDefinitions.filter(n=>n.ambientActivity==='church-prayer'))assert.ok(clear(npc.x,npc.y),npc.id);
});
test('cutaway opens only inside street-level rooms, retains threshold hysteresis and restores',()=>{
 assert.equal(cathedralInteriorAt({x:3800,y:560,layer:0}),false,'solid tower');
 assert.equal(cathedralInteriorAt({x:3916,y:550,layer:1}),false,'rooftop');
 let state=cathedralCutaway(null,{x:3916,y:580,layer:0},16);assert.ok(state.amount>0&&state.amount<1);
 for(let i=0;i<60;i++)state=cathedralCutaway(state,{x:3916,y:580,layer:0},16);
 assert.equal(state.amount,1);
 assert.equal(cathedralCutaway(state,{x:3916,y:607,layer:0},16).inside,true);
 for(let i=0;i<60;i++)state=cathedralCutaway(state,{x:3916,y:630,layer:0},16);
 assert.equal(state.amount,0);assert.equal(state.inside,false);
});
test('maintenance stair, connected roofs and twin towers use the same authored dimensions',()=>{
 const stair=city.fireEscapes.find(f=>f.id==='cathedralFireEscape');assert.ok(clear(stair.street.x,stair.street.y));
 const roofs=city.roofAreas[1].filter(r=>r.buildingId==='cathedral');
 assert.ok(roofs.some(r=>stair.roof.x>=r.x&&stair.roof.x<=r.x+r.w&&stair.roof.y>=r.y&&stair.roof.y<=r.y+r.h));
 const visual=cathedralVisualVolumes(),nave=visual.find(b=>b.id==='cathedral'),towers=visual.filter(b=>b.cathedralKind==='tower');
 assert.equal(towers.length,2);assert.ok(towers.every(b=>buildingHeight(b)>buildingHeight(nave)));
 for(const b of visual.filter(b=>b.cathedralKind!=='buttress')){const r=roofs.find(r=>r.x===b.x&&r.y===b.y);assert.ok(r);assert.equal(r.w,b.w);assert.equal(r.h,b.h);}
});
test('pitched roof eaves exactly meet projected walls and the ridge reacts continuously',()=>{
 const b=cathedralVisualVolumes()[0],cam={scrollX:3400,scrollY:150,width:960,height:640,zoom:1};
 const o=roofParallaxOffset(b,cam),p=cathedralRoofPlanes(b,o,buildingHeight(b));
 assert.equal(p.length,4);
 // Equivalent projection formulas may round their final additions differently.
 const wall={x:b.x+o.x+(b.x-o.cx)*o.spreadX,y:b.y+o.y+(b.y-o.cy)*o.spreadY};
 assert.ok(Math.hypot(p[0].points[0].x-wall.x,p[0].points[0].y-wall.y)<1e-8);
 assert.deepEqual(p[0].points[2],p[1].points[1]);
 const next=cathedralRoofPlanes(b,roofParallaxOffset(b,{...cam,scrollX:cam.scrollX+1}),buildingHeight(b));
 assert.ok(Math.abs(next[0].points[2].x-p[0].points[2].x)<1);
});
