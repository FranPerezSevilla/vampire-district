import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SCALE, metresToWorld, perspectiveLimit, viewportPerspectiveLimit } from '../phaser/src/rendering/WorldScale.js';
import {buildingHeight,roofParallaxOffset} from '../phaser/src/rendering/BuildingParallax.js';
test('human, door and floors share one conversion',()=>{
 assert.equal(metresToWorld(WORLD_SCALE.humanMetres),24);
 assert.ok(metresToWorld(WORLD_SCALE.doorMetres)>24);
 assert.equal(buildingHeight({storeys:2}),2*buildingHeight({storeys:1}));
});
test('city projection remains inside the common height envelope at extreme axis settings',()=>{
 const buildings=[{x:300,y:300,w:400,h:280,landmark:true},{x:710,y:500,w:110,h:140,id:'hospitalEmergency'},{x:290,y:546,w:44,h:44,renderHeight:195}];
 for(const pan of [-700,0,900])for(const multiplier of [1,4,20])for(const entrance of [0,.25,.5,.75,1]){
  const camera={scrollX:pan,scrollY:pan,width:1400,height:850};
  const options={eastWest:multiplier,northSouth:multiplier,entrance};options.limit=perspectiveLimit(buildings,camera,options);
  for(const b of buildings){const o=roofParallaxOffset(b,camera,options);
   for(const x of [b.x,b.x+b.w])for(const y of [b.y,b.y+b.h])
    assert.ok(Math.hypot(o.x+(x-o.cx)*o.spreadX,o.y+(y-o.cy)*o.spreadY)<=buildingHeight(b)*1.65+1e-8);
  }
 }
});

test('runtime envelope is invariant under camera travel and stale worldView updates',()=>{
 const settings={eastWest:4,northSouth:4};
 const camera={scrollX:0,scrollY:0,width:1400,height:850,zoom:1};
 const limit=viewportPerspectiveLimit(camera,settings);
 for(const scroll of [-2000,0,1000,5000]){
  assert.equal(viewportPerspectiveLimit({...camera,scrollX:scroll,scrollY:scroll,worldView:{x:scroll-30}},settings),limit);
 }
 const b={x:300,y:300,w:400,h:280,landmark:true};
 const before=roofParallaxOffset(b,camera,{...settings,limit});
 const after=roofParallaxOffset(b,{...camera,scrollX:1},{...settings,limit});
 assert.ok(Math.abs(after.x-before.x)<1);
 assert.equal(after.spreadX,before.spreadX);
 assert.equal(after.spreadY,before.spreadY);
});
