import test from 'node:test';
import assert from 'node:assert/strict';
import {ordinaryArchitecture,blockFacadeSections,clipFacadeSections,reliefFacadePoint,blockFacadeSlices,blockPrimarySide} from '../phaser/src/rendering/OrdinaryBlockArchitecture.js';
import {buildings} from '../phaser/src/data/generated/city-topology-v2.js';
import {WEST_MARKET_VOLUMES} from '../phaser/src/data/west-market-block.js';
import {roofParallaxOffset} from '../phaser/src/rendering/BuildingParallax.js';
import {scaledBuildingHeight} from '../phaser/src/rendering/WorldScale.js';
import {MaterialQuad} from '../phaser/src/rendering/BuildingMaterialImages.js';

test('architectural trial is opt-in, scoped to the review block and front relief only',()=>{
 for(const id of ['tenementNorth','marketBlock','shops'])assert.ok(ordinaryArchitecture({id}));
 for(const id of ['hospital','police','generic-tenement','other-shop'])assert.equal(ordinaryArchitecture({id}),null);
 assert.ok(ordinaryArchitecture({id:'reusable',architectureKit:'arcade'}));
 assert.equal(ordinaryArchitecture({id:'shops',architectureKit:false}),null);
 for(const facadeSide of ['east','west','north'])assert.equal(blockFacadeSections({id:'shops',facadeSide},139),null);
});

test('all eleven West Market volumes use the kit and preserve their authored access side',()=>{
 assert.equal(WEST_MARKET_VOLUMES.length,11);
 for(const v of WEST_MARKET_VOLUMES){
  const b=buildings.find(b=>b.id===v.id);assert.ok(b);
  assert.ok(ordinaryArchitecture(b),b.id);
  assert.equal(blockPrimarySide(b),b.entrances[0].side);
 }
});

test('modular wide facades keep one centered entrance and contiguous uncompressed bays',()=>{
 for(const length of [56,80,120,166,196,220,399]){
  const slices=blockFacadeSlices({id:'west-market:block:02'},length);
  assert.equal(slices[0].x,0);
  assert.ok(Math.abs(slices.at(-1).x+slices.at(-1).w-length)<1e-8);
  const center=slices.filter(s=>s.u0<=.5&&s.u1>.5);assert.equal(center.length,1);
  assert.ok(Math.abs(center[0].x+center[0].w/2-length/2)<1e-8);
  for(let i=1;i<slices.length;i++)assert.ok(Math.abs(slices[i].x-slices[i-1].x-slices[i-1].w)<1e-8);
  if(length>=180)assert.equal(center[0].w,112);
 }
});

test('pilasters form a continuous surface with bounded physical relief and clipped UV spans',()=>{
 for(const id of ['tenementNorth','marketBlock','shops']){
  const sections=blockFacadeSections({id},230);
  assert.equal(sections[0].u0,0);assert.equal(sections.at(-1).u1,1);
  for(let i=0;i<sections.length;i++){
   const s=sections[i];assert.ok(s.u1>s.u0&&s.d0>=0&&s.d1>=0&&s.d0<3.3&&s.d1<3.3);
   if(i){assert.equal(sections[i-1].u1,s.u0);assert.equal(sections[i-1].d1,s.d0);}
  }
  const clipped=clipFacadeSections(sections,.155,.835);
  assert.equal(clipped[0].u0,.155);assert.equal(clipped.at(-1).u1,.835);
  for(let i=1;i<clipped.length;i++){assert.equal(clipped[i-1].u1,clipped[i].u0);assert.equal(clipped[i-1].d1,clipped[i].d0);}
 }
});

test('relief is watertight at ground, roof and neighboring strips under perspective extremes',()=>{
 const b={id:'tenementNorth',x:650,y:1280,w:230,h:210},h=scaledBuildingHeight(b),a={x:b.x,y:b.y+b.h},c={x:b.x+b.w,y:a.y};
 const sections=blockFacadeSections(b,b.w);
 for(const zoom of [.5,1,3])for(const northSouth of [0,1,20])for(const eastWest of [0,1,20]){
  const cam={scrollX:510,scrollY:1320,width:1500,height:900,zoom},o=roofParallaxOffset(b,cam,{northSouth,eastWest});
  for(const s of sections)for(const [u,d]of [[s.u0,s.d0],[s.u1,s.d1]]){
   const p=reliefFacadePoint(a,c,u,0,h,d,o),roof=reliefFacadePoint(a,c,u,h,h,d,o),x=a.x+b.w*u;
   assert.equal(p.x,x);assert.equal(p.y,a.y);
   assert.ok(Math.abs(roof.x-(x+o.x+(x-o.cx)*o.spreadX))<1e-9);
   assert.ok(Math.abs(roof.y-(a.y+o.y+(a.y-o.cy)*o.spreadY))<1e-9);
   const mid=reliefFacadePoint(a,c,u,h*.5,h,d,o),next=reliefFacadePoint(a,c,u,h*.5,h,d,roofParallaxOffset(b,{...cam,scrollX:cam.scrollX+.01},{northSouth,eastWest}));
   assert.ok(Math.hypot(mid.x-next.x,mid.y-next.y)<.03);
  }
  for(let i=1;i<sections.length;i++)for(const z of [1,h*.4,h-1]){
   assert.deepEqual(reliefFacadePoint(a,c,sections[i-1].u1,z,h,sections[i-1].d1,o),reliefFacadePoint(a,c,sections[i].u0,z,h,sections[i].d0,o));
  }
 }
});

test('folded facade batches one shared texture, keeps each UV span and skips offscreen geometry',()=>{
 const previous=globalThis.Phaser,calls=[],events=[];
 globalThis.Phaser={GameObjects:{GetCalcMatrix:()=>({calc:{getX:x=>x,getY:(x,y)=>y}})},Renderer:{WebGL:{Utils:{getTintAppendFloatAlpha:()=>0}}}};
 const corners=(x)=>[{x,y:0},{x,y:50},{x:x+20,y:50},{x:x+20,y:0}];
 const src={corners:corners(0),panels:[{corners:corners(-100),uStart:0,uEnd:.2},{corners:corners(10),uStart:.2,uEnd:.5},{corners:corners(30),uStart:.5,uEnd:1}],vStart:.25,vEnd:.75,adaptiveMesh:true,alpha:1,frame:{glTexture:'shared'}};
 const pipe={setGameObject(){events.push('texture');return 0;},manager:{preBatch(){events.push('begin');},postBatch(){events.push('end');}},batchQuad(...args){calls.push(args);}};
 const renderer={pipelines:{set:()=>pipe}},camera={width:100,height:100,alpha:1,addToRenderList(){events.push('visible');}};
 try{
  MaterialQuad.prototype.renderWebGL(renderer,src,camera);
  assert.deepEqual(events,['visible','texture','begin','end']);assert.equal(calls.length,2);
  assert.deepEqual(calls.map(c=>c.slice(9,13)),[[.2,.25,.5,.75],[.5,.25,1,.75]]);
  calls.length=0;events.length=0;src.panels=[{corners:corners(-100),uStart:0,uEnd:1}];
  MaterialQuad.prototype.renderWebGL(renderer,src,camera);assert.equal(calls.length,0);assert.equal(events.length,0);
  src.panels=null;src.uStart=.3;src.uEnd=.7;
  MaterialQuad.prototype.renderWebGL(renderer,src,camera);assert.deepEqual(calls[0].slice(9,13),[.3,.25,.7,.75]);
 }finally{globalThis.Phaser=previous;}
});
