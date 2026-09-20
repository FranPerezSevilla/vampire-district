import test from 'node:test';
import assert from 'node:assert/strict';
import {scaledBuildingHeight,metresToWorld} from '../phaser/src/rendering/WorldScale.js';
import {blockFacadeRows} from '../phaser/src/rendering/OrdinaryBlockArchitecture.js';
import {blockRoofLayout,blockRoofModel,blockRoofHeightAt,blockDormerLayouts} from '../phaser/src/rendering/OrdinaryBlockRoofs.js';
import {buildings as cityBuildings} from '../phaser/src/data/generated/city-topology-v2.js';
import {WEST_MARKET_VOLUMES} from '../phaser/src/data/west-market-block.js';
import {rooftopObjects,projectRoofVertex} from '../phaser/src/rendering/RooftopObjects.js';
import {roofParallaxOffset,BuildingParallax} from '../phaser/src/rendering/BuildingParallax.js';
import {CITY_PERSPECTIVE} from '../phaser/src/rendering/CityPerspective.js';
const buildings=[{id:'tenementNorth',x:650,y:1280,w:230,h:210},{id:'marketBlock',x:260,y:1320,w:220,h:180},{id:'shops',x:900,y:1320,w:139,h:160}];

test('four/two/three floors add storeys with the same ground and window height',()=>{
 for(const [index,b]of buildings.entries()){
  const floors=[4,2,3][index],rows=blockFacadeRows(b);
  assert.equal(rows.length,floors);assert.equal(rows.filter(r=>r.ground).length,1);
  for(const row of rows)assert.ok(Math.abs(row.h-metresToWorld(3.4))<1e-9);
  assert.equal(rows[0].y+rows[0].h,scaledBuildingHeight(b));
  assert.ok(Math.abs(rows.at(-1).y)<1e-9);
 }
 assert.equal(scaledBuildingHeight({id:'other'}),metresToWorld(6.8));
 assert.equal(scaledBuildingHeight({...buildings[0],storeys:1}),metresToWorld(3.4));
 assert.equal(scaledBuildingHeight({...buildings[0],heightMetres:10}),metresToWorld(10));
});

test('every West Market roof fits its volume and its dormers face the access street or courtyard',()=>{
 for(const v of WEST_MARKET_VOLUMES){
  const b=cityBuildings.find(b=>b.id===v.id),layout=blockRoofLayout(b),model=blockRoofModel(b);
  assert.ok(model,b.id);
  for(const d of blockDormerLayouts(b,layout)){
   assert.equal(d.side,b.entrances[0].side);
   assert.ok(d.x>=0&&d.y>=0&&d.x+d.w<=b.w&&d.y+d.h<=b.h);
   assert.ok(layout.occupied.some(r=>r.x===b.x+d.x&&r.y===b.y+d.y));
  }
  for(const part of model.parts)for(const f of part.faces)for(let i=0;i<12;i+=3){
   const [x,y,z]=f.xyz.slice(i,i+3);
   assert.ok(x>=-1e-7&&x<=b.w+1e-7&&y>=-1e-7&&y<=b.h+1e-7,`${b.id}: ${x},${y}`);
   assert.ok(z>=layout.base-1e-7&&z<=part.maxHeight+1e-7);
  }
  for(const p of rooftopObjects(b))for(const r of layout.occupied){
   assert.ok(p.x+p.w/2<=r.x||p.x-p.w/2>=r.x+r.w||p.y+p.h/2<=r.y||p.y-p.h/2>=r.y+r.h);
  }
 }
});

test('roof silhouettes are bounded and all outer eaves meet the existing facade',()=>{
 for(const b of buildings){
  const model=blockRoofModel(b),roof=blockRoofLayout(b);
  assert.ok(roof.terrace.w*roof.terrace.h>b.w*b.h*.5);
  for(const part of model.parts)for(const f of part.faces){
   assert.ok(f.uv.every(Number.isFinite));assert.ok(f.uv.every(x=>x>=0&&x<=1));
   for(let i=0;i<12;i+=3){
    const [x,y,z]=f.xyz.slice(i,i+3);
    assert.ok(x>=-1e-7&&x<=b.w+1e-7&&y>=-1e-7&&y<=b.h+1e-7);
    assert.ok(z>=roof.base&&z<=part.maxHeight+1e-7);
    if(part.kind==='surface'&&(x===0||x===b.w||y===0||y===b.h))assert.equal(z,roof.base);
   }
  }
  assert.equal(blockRoofHeightAt(b,b.x,b.y),roof.base);
  assert.equal(blockRoofHeightAt(b,b.x+b.w/2,b.y+b.h/2),roof.terrace.z);
 }
 assert.deepEqual(blockRoofModel(buildings[0]).parts.map(p=>p.kind),['surface','dormer','dormer']);
 assert.ok(blockRoofModel(buildings[1]).parts.some(p=>p.kind==='skylight'));
 assert.ok(blockRoofModel(buildings[2]).parts.some(p=>p.kind==='access'));
});

test('equipment sits on the flat terrace and leaves the skylight/access clear',()=>{
 for(const b of buildings){
  const roof=blockRoofLayout(b),props=rooftopObjects(b);assert.ok(props.length>=2);
  for(const d of props){
   assert.equal(d.base,roof.terrace.z);
   assert.ok(d.x-d.w/2>=roof.terrace.x&&d.x+d.w/2<=roof.terrace.x+roof.terrace.w);
   assert.ok(d.y-d.h/2>=roof.terrace.y&&d.y+d.h/2<=roof.terrace.y+roof.terrace.h);
   for(const r of roof.occupied)assert.ok(d.x+d.w/2<=r.x||d.x-d.w/2>=r.x+r.w||d.y+d.h/2<=r.y||d.y-d.h/2>=r.y+r.h);
  }
 }
});

test('outer eave projection is identical to facade top at slider extremes',()=>{
 for(const b of buildings)for(const northSouth of [0,1,20])for(const eastWest of [0,1,20]){
  const cam={scrollX:500,scrollY:1320,width:1500,height:900,zoom:3},settings={...CITY_PERSPECTIVE,northSouth,eastWest},offset=roofParallaxOffset(b,cam,settings);
  for(const x of [b.x,b.x+b.w])for(const y of [b.y,b.y+b.h]){
   const p=projectRoofVertex(x,y,scaledBuildingHeight(b),cam,settings);
   assert.ok(Math.abs(p.x-(x+offset.x+(x-offset.cx)*offset.spreadX))<1e-8);
   assert.ok(Math.abs(p.y-(y+offset.y+(y-offset.cy)*offset.spreadY))<1e-8);
  }
 }
});

test('resident cache eviction destroys roof meshes and railings once',()=>{
 const counts=[0,0,0],make=i=>({destroy(){counts[i]++;}}),dummy={destroy(){}};
 const entry={graphic:dummy,wall:dummy,rooftopObjects:[make(0)],blockRoofParts:[make(1),make(1)],roofRails:[make(2),make(2)]};
 BuildingParallax.prototype.releaseEntry.call({materials:{destroyEntry(){}}},entry);
 assert.deepEqual(counts,[1,2,2]);
});
