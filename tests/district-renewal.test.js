import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {DISTRICT_BLOCK_PLANS as plans,DISTRICT_URBAN_VOLUMES as volumes,DISTRICT_URBAN_SPACES as spaces,DISTRICT_URBAN_DECOR as decor} from '../phaser/src/data/district-blocks.js';
import {compileDistrictBlocks} from '../tools/city-compiler/district-blocks.js';
import {compileWestMarketBlock} from '../tools/city-compiler/west-market-block.js';
import {entrancePosition} from '../phaser/src/rendering/BuildingEntrances.js';
import {ordinaryArchitecture,blockFacadeSlices,blockFacadeRows} from '../phaser/src/rendering/OrdinaryBlockArchitecture.js';
import {blockRoofModel,blockRoofLayout} from '../phaser/src/rendering/OrdinaryBlockRoofs.js';
import {rooftopObjects} from '../phaser/src/rendering/RooftopObjects.js';
import {ordinaryBuilding} from '../phaser/src/rendering/OrdinaryBuildingMaterials.js';

const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const contains=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const clear=p=>!city.buildings.some(b=>overlaps({x:p.x-5,y:p.y-7,w:10,h:14},b));

test('every district has an explicit composition and renewal is idempotent',()=>{
 assert.deepEqual(plans.map(p=>p.id).sort(),city.districtZones.map(d=>d.id).sort());
 const once=compileDistrictBlocks(compileWestMarketBlock(city));
 assert.deepEqual(compileDistrictBlocks(once),once);
 assert.deepEqual(once.roads,city.roads);
 assert.deepEqual(once.landmarkSites,city.landmarkSites);
 assert.equal(city.buildings.some(b=>b.id.startsWith('infill:')),false);
 const ids=city.buildings.map(b=>b.id);assert.equal(new Set(ids).size,ids.length);
 for(const v of volumes){const b=city.buildings.find(b=>b.id===v.id);for(const key of Object.keys(v))assert.deepEqual(b[key],v[key],v.id+' '+key);}
});

test('all authored buildings, public spaces and sparse furniture leave the roads clear',()=>{
 for(const b of volumes){
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=city.CITY_WORLD.width&&b.y+b.h<=city.CITY_WORLD.height);
  for(const r of city.roads)assert.equal(overlaps(b,{x:r.x-26,y:r.y-26,w:r.w+52,h:r.h+52}),false,b.id+' '+r.id);
  for(const n of city.buildings)if(n.id!==b.id)assert.equal(overlaps(b,n),false,b.id+' '+n.id);
  for(const s of spaces)assert.equal(overlaps(b,s),false,b.id+' '+s.id);
 }
 for(const s of spaces)for(const r of city.roads)assert.equal(overlaps(s,r),false,s.id+' '+r.id);
 for(const d of decor){
  const w=d.vertical?d.h:d.w,h=d.vertical?d.w:d.h,box={x:d.x-w/2,y:d.y-h/2,w,h};
  for(const b of [...city.roads,...city.buildings])assert.equal(overlaps(box,b),false,d.id+' '+b.id);
 }
});

test('new doors face paved, body-clear space; retained street accesses remain reachable',()=>{
 for(const b of volumes)for(const door of b.entrances){
  const e=entrancePosition(b,door),p={x:e.x+e.nx*14,y:e.y+e.ny*14};
  assert.ok(clear(p),b.id+' door blocked');assert.ok(city.sidewalks.some(s=>contains(p,s)),b.id+' door unpaved');
 }
 for(const e of [...city.fireEscapes,...city.roofDrops])assert.ok(clear(e.street),e.id+' blocked');
 const escape=city.fireEscapes.find(e=>e.id==='universityFireEscape');
 assert.ok(city.roofAreas[1].some(r=>contains(escape.roof,r)));
});

test('public courts connect to the street through body-width paths, not diagonal corner gaps',()=>{
 // Flood a 4-unit grid with expanded solid footprints. Cardinal movement only;
 // this catches sealed courts even when their centre and entrance are clear.
 const step=4,w=city.CITY_WORLD.width/step,h=city.CITY_WORLD.height/step,blocked=new Uint8Array(w*h),seen=new Uint8Array(w*h);
 for(const b of city.buildings){
  const x0=Math.max(0,Math.ceil((b.x-5)/step)),x1=Math.min(w-1,Math.floor((b.x+b.w+5)/step));
  const y0=Math.max(0,Math.ceil((b.y-7)/step)),y1=Math.min(h-1,Math.floor((b.y+b.h+7)/step));
  for(let y=y0;y<=y1;y++)blocked.fill(1,y*w+x0,y*w+x1+1);
 }
 const queue=new Int32Array(w*h);let head=0,tail=1;queue[0]=Math.round(1140/step)+Math.round(40/step)*w;seen[queue[0]]=1;
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(n>=0&&!blocked[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
 for(const s of spaces.filter(s=>s.w>=30&&s.h>=30)){
  const x=Math.round((s.x+s.w/2)/step),y=Math.round((s.y+s.h/2)/step);
  assert.equal(seen[y*w+x],1,s.id+' isolated');
 }
});

test('all district volumes have physical storeys, a bounded roof and attached shared-atlas equipment',()=>{
 for(const v of volumes){
  const b=city.buildings.find(b=>b.id===v.id),recipe=ordinaryArchitecture(b),roof=blockRoofLayout(b),model=blockRoofModel(b);
  assert.ok(recipe&&ordinaryBuilding(b)&&model,b.id);
  assert.equal(blockFacadeRows(b).length,b.storeys,b.id);
  const length=['north','south'].includes(b.entrances[0].side)?b.w:b.h,slices=blockFacadeSlices(b,length);
  assert.equal(slices.filter(s=>s.u0<=.5&&s.u1>.5).length,1,b.id+' repeated doorway');
  for(const part of model.parts)for(const face of part.faces){
   assert.ok(face.uv.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
   for(let i=0;i<12;i+=3){const [x,y,z]=face.xyz.slice(i,i+3);assert.ok(x>=-1e-6&&y>=-1e-6&&x<=b.w+1e-6&&y<=b.h+1e-6&&z>=roof.base-1e-6&&z<=part.maxHeight+1e-6,b.id);}
  }
  for(const p of rooftopObjects(b)){
   assert.equal(p.base,roof.terrace.z);
   const box={x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h};
   for(const r of roof.occupied)assert.equal(overlaps(box,r),false,b.id+' equipment overlap');
  }
 }
});

test('streamed copies retain the architecture, entrances and collision dimensions',()=>{
 for(const b of volumes){
  const chunk=JSON.parse(readFileSync(new URL(`../phaser/assets/city/current/chunks/${Math.floor(b.x/512)}-${Math.floor(b.y/512)}.json`,import.meta.url),'utf8'));
  // Chunk file schema keeps the same explicit runtime building definition.
  const copy=chunk.collections.buildings.find(copy=>copy.id===b.id);
  assert.ok(copy,b.id+' missing chunk');
  for(const key of ['x','y','w','h','storeys','architectureKit','entrances'])assert.deepEqual(copy[key],b[key],b.id+' '+key);
 }
});
