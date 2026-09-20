import test from 'node:test';
import assert from 'node:assert/strict';
import {ordinaryBuilding,ordinaryFacadeLayout} from '../phaser/src/rendering/OrdinaryBuildingMaterials.js';
import {rooftopObjects,projectRoofVertex,rooftopObjectFaces} from '../phaser/src/rendering/RooftopObjects.js';
import {roofParallaxOffset,BuildingParallax} from '../phaser/src/rendering/BuildingParallax.js';
import {CITY_PERSPECTIVE} from '../phaser/src/rendering/CityPerspective.js';

const building={id:'test-tenement',x:100,y:200,w:230,h:210,family:'housing'};
test('ordinary art respects landmarks, annexes and custom roofs',()=>{
 assert.ok(ordinaryBuilding(building));
 assert.equal(ordinaryBuilding({...building,landmark:true,architectureKit:'civic'}),true);
 assert.equal(ordinaryBuilding({...building,landmark:true,architectureKit:'civic',family:'police-campus'}),false);
 for(const extra of [{landmark:true},{skyline:true},{cornerTurret:true},{dormer:true},{roofTier:true},{cathedralKind:'nave'},{id:'hospital'},{id:'hospitalEmergency'},{family:'police-campus'},{siteId:'club-site'},{campusBarrier:'railing'}])
  assert.equal(ordinaryBuilding({...building,...extra}),false);
});
test('window bays stay within walls, keep storey proportions and never overlap doors',()=>{
 for(const length of [24,32,54,68,110,230,500])for(const storeys of [1,2,4])for(const facadeSide of ['south','north','east','west']){
  const {height,modules}=ordinaryFacadeLayout({...building,storeys,facadeSide},length);
  for(const m of modules){
   assert.ok(m.x>=0&&m.y>=0&&m.x+m.w<=length+.001&&m.y+m.h<=height+.001);
   if(m.half!==undefined)assert.ok(m.w/m.h<=1.001&&m.w/m.h>=.5);
   for(const n of modules)if(n!==m)assert.ok(m.x+m.w<=n.x+.001||n.x+n.w<=m.x+.001||m.y+m.h<=n.y+.001||n.y+n.h<=m.y+.001);
  }
  assert.ok(modules.filter(m=>m.half===undefined).length<=(facadeSide==='south'?1:0));
 }
});
test('roof equipment keeps stable identities, scale, spacing and a roof-relative base',()=>{
 const defs=rooftopObjects(building);assert.equal(defs.length,3);
 assert.deepEqual(defs,rooftopObjects({...building}));
 for(const d of defs){
  assert.ok(d.base>80&&d.base<100);
  assert.ok(d.x-d.w/2>=building.x+8&&d.x+d.w/2<=building.x+building.w-8);
  assert.ok(d.y-d.h/2>=building.y+8&&d.y+d.h/2<=building.y+building.h-8);
  const faces=rooftopObjectFaces(d);assert.equal(faces.length,5);
  for(const f of faces)for(const z of f.z)assert.ok(Math.abs(z-d.base)<.001||Math.abs(z-(d.base+d.height))<.001);
 }
 assert.equal(rooftopObjects({...building,w:24,h:24}).length,0);
 assert.equal(rooftopObjects({...building,roofObjects:[]}).length,0);
});
test('object feet coincide with the host roof throughout pans, zooms and slider extremes',()=>{
 for(const zoom of [.5,1,3])for(const northSouth of [0,1,20])for(const eastWest of [0,1,20]){
  const camera={scrollX:70,scrollY:110,width:1500,height:900,zoom},settings={...CITY_PERSPECTIVE,northSouth,eastWest};
  const roof=roofParallaxOffset(building,camera,settings);
  for(const d of rooftopObjects(building))for(const x of [d.x-d.w/2,d.x+d.w/2])for(const y of [d.y-d.h/2,d.y+d.h/2]){
   const p=projectRoofVertex(x,y,d.base,camera,settings);
   assert.ok(Math.abs(p.x-(x+roof.x+(x-roof.cx)*roof.spreadX))<1e-8);
   assert.ok(Math.abs(p.y-(y+roof.y+(y-roof.cy)*roof.spreadY))<1e-8);
   const top=projectRoofVertex(x,y,d.base+d.height,camera,settings);
   const next=projectRoofVertex(x,y,d.base+d.height,{...camera,scrollX:70.01,scrollY:110.01},settings);
   // Even 20x remains continuous: movement equals the linear camera derivative.
   assert.ok(Math.abs(top.x-next.x-.01*roof.spreadX*(d.base+d.height)/d.base)<1e-8);
   assert.ok(Math.abs(top.y-next.y-.01*roof.spreadY*(d.base+d.height)/d.base)<1e-8);
  }
 }
});
test('evicting a building releases rooftop objects with its existing material owner',()=>{
 let props=0,objects=0,materials=0;
 const object=()=>({destroy(){objects++;}});
 const e={graphic:object(),wall:object(),pinnacles:object(),pinnacleCaps:object(),rooftopObjects:[{destroy(){props++;}},{destroy(){props++;}}]};
 BuildingParallax.prototype.releaseEntry.call({materials:{destroyEntry(entry){assert.equal(entry,e);materials++;}}},e);
 assert.deepEqual([props,objects,materials],[2,4,1]);
});
