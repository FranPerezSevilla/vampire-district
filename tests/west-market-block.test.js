import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../phaser/src/data/generated/city-topology-v2.js';
import {pedestrianRoutes, streetNavigationPoints} from '../phaser/src/data/district.js';
import {npcDefinitions} from '../phaser/src/data/npcs.js';
import {WEST_MARKET_VOLUMES as volumes, WEST_MARKET_SPACES as spaces, WEST_MARKET_ESCAPES as escapes, WEST_MARKET_ROOF_ROUTES as routes, WEST_MARKET_PEDESTRIANS as pedestrians} from '../phaser/src/data/west-market-block.js';
import {compileWestMarketBlock, ownsWestMarketVolume as owns} from '../tools/city-compiler/west-market-block.js';
import {entrancePosition} from '../phaser/src/rendering/BuildingEntrances.js';
import {ordinaryFacadeLayout} from '../phaser/src/rendering/OrdinaryBuildingMaterials.js';
import {exposedWallSpans} from '../phaser/src/rendering/AttachedVolumeUnion.js';
import {buildingHeight} from '../phaser/src/rendering/BuildingParallax.js';
import {compileInfill} from '../tools/city-compiler/infill.js';
import {WEST_MARKET_SITES} from '../phaser/src/data/west-market-block.js';

const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const contains=(r,p)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const clear=(x,y)=>!city.buildings.some(b=>overlaps({x:x-5,y:y-7,w:10,h:14},b));
function walk(points){
  for(let i=1;i<points.length;i++){
    const [a,b]=[points[i-1],points[i]],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
    for(let n=0;n<=steps;n++){
      const x=a[0]+(b[0]-a[0])*n/steps,y=a[1]+(b[1]-a[1])*n/steps;
      assert.ok(clear(x,y),`walk blocked at ${x}, ${y}`);
    }
  }
}

test('West Market compiler is idempotent and changes only the owned building set',()=>{
  const result=compileWestMarketBlock(city);
  assert.deepEqual(compileWestMarketBlock(result),result);
  assert.deepEqual(result.roads,city.roads);
  assert.deepEqual(result.landmarkSites,city.landmarkSites);
  assert.deepEqual(result.buildings.filter(b=>!owns(b.id)),city.buildings.filter(b=>!owns(b.id)));
  assert.equal(result.buildings.filter(b=>owns(b.id)).length,11);
  for(const b of volumes){
    assert.ok(!city.roads.some(r=>overlaps(r,b)),b.id+' road');
    assert.ok(!city.sidewalks.some(r=>overlaps(r,b)),b.id+' pavement');
    assert.ok(!city.buildings.some(r=>r.id!==b.id&&overlaps(r,b)),b.id+' neighbour');
    assert.deepEqual(city.buildings.find(r=>r.id===b.id),b);
  }
});

test('future generic infill preserves public space, even without its surrounding buildings',()=>{
  const empty={buildings:[],landmarkSites:[],fireEscapes:[],roofDrops:[]};
  const source={districtZones:WEST_MARKET_SITES.map((s,i)=>({...s,id:'test-'+i}))};
  assert.ok(compileInfill(empty,[],source).buildings.length>0);
  assert.equal(compileInfill(empty,[],source,{reservedSites:WEST_MARKET_SITES}).buildings.length,0);
});

test('market square and residential court each have two body-clear exits',()=>{
  walk([[499,1540],[350,1540],[234,1540],[234,1810],[234,1834]]);
  walk([[350,1540],[230,1540],[230,1485],[62,1485],[62,1269],[62,1247]]);
  walk([[610,1520],[839,1520],[839,1630],[752,1630],[628,1630],[610,1630]]);
  walk([[610,1520],[1054,1520]]);
  walk([[610,1630],[628,1630],[628,1812],[1030,1812]]);
  for(const e of escapes)assert.ok(clear(e.street.x,e.street.y),e.id);
});

test('every courtyard-facing entrance is on an open pedestrian surface',()=>{
  for(const b of volumes)for(const door of b.entrances){
    const p=entrancePosition(b,door),standing={x:p.x+p.nx*12,y:p.y+p.ny*12};
    assert.ok(clear(standing.x,standing.y),b.id);
    assert.ok(spaces.some(r=>contains(r,standing)),b.id+' pedestrian entrance');
    for(const facadeSide of ['north','south','east','west']){
      const length=['north','south'].includes(facadeSide)?b.w:b.h;
      const ground=ordinaryFacadeLayout({...b,facadeSide},length).modules.filter(m=>m.half===undefined);
      assert.equal(ground.length,facadeSide===door.side?1:0,b.id+' '+facadeSide);
    }
  }
});

test('new roof routes and stairs terminate inside walkable roof insets',()=>{
  const roofs=city.roofAreas[1];
  for(const p of [...escapes.map(e=>e.roof),...routes.flatMap(r=>[{x:r.ax,y:r.ay},{x:r.bx,y:r.by}])])
    assert.ok(roofs.some(r=>contains(r,{x:p.x-5,y:p.y-7})&&contains(r,{x:p.x+5,y:p.y+7})),JSON.stringify(p));
});

test('local pedestrians reuse their identities and walk the authored public spaces',()=>{
  for(const route of pedestrians){
    assert.equal(pedestrianRoutes.filter(r=>r.id===route.id).length,1);
    assert.equal(npcDefinitions.filter(n=>n.pedestrianRouteId===route.id).length,4);
    assert.equal(streetNavigationPoints.filter(n=>n.routeId===route.id).length,4);
    walk([...route.points,route.points[0]].map(p=>[p.x,p.y]));
    for(const point of route.points)assert.ok(spaces.some(s=>contains(s,point)));
  }
});

test('attached frontage clips only the shared wall and retains the taller upper wall',()=>{
  const a=volumes.find(b=>b.id==='tenementNorth'),b=volumes.find(b=>b.id==='shops');
  const start={x:870,y:1280},end={x:870,y:1490};
  const lower=exposedWallSpans(a,start,end,buildingHeight(b),volumes,buildingHeight);
  assert.equal(lower.length,1);assert.equal(lower[0][0],0);assert.equal(lower[0][1],50/210);
  assert.deepEqual(exposedWallSpans(a,start,end,buildingHeight(a),volumes,buildingHeight),[[0,1]]);
  assert.deepEqual(exposedWallSpans(a,{x:640,y:1490},end,buildingHeight(b),volumes,buildingHeight),[[0,1]]);
});
