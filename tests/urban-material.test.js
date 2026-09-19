import { facadePoint, MaterialQuad } from '../phaser/src/rendering/BuildingMaterialImages.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {facadeLayout,pavementSlabs,facadePanel,paintFacadeDetail,paintPavementWear,paintAsphaltWear} from '../phaser/src/rendering/UrbanMaterialDetail.js';
test('facade panels follow the same roof/base projection including reversed lean',()=>{
 for(const o of [{x:40,y:-100},{x:-40,y:-100}]){
 const p=facadePanel({x:0,y:0},{x:100,y:0},o,0,0,1,1);
 assert.deepEqual(p,[{x:0,y:0},{x:100,y:0},{x:100+o.x,y:o.y},{x:o.x,y:o.y}]);}
});
test('architectural and ground details are deterministic and finite',()=>{
 const draw=()=>{const calls=[];const g=new Proxy({}, {get:(_,key)=>(...args)=>{calls.push([key,args]);return g;}});
 paintFacadeDetail(g,{id:'house',family:'housing'},{x:0,y:0},{x:200,y:0},{x:-20,y:-60},{trim:0x888888});paintPavementWear(g,{x:0,y:0,w:300,h:24});paintAsphaltWear(g,{x:0,y:0,w:300,h:90});return calls;};
 assert.deepEqual(draw(),draw());assert.ok(draw().length>50);assert.ok(!JSON.stringify(draw()).includes('null'));
});

test('paving slabs keep world-space identities across clipped render windows',()=>{
 const full=pavementSlabs({x:-100,y:-90,w:350,h:240});
 for(const bounds of [{x:-35,y:-29,w:70,h:90},{x:0,y:0,w:110,h:60}]){
  for(const tile of pavementSlabs(bounds)){
   assert.ok(tile.x>=bounds.x&&tile.y>=bounds.y);
   assert.ok(tile.x+tile.w<=bounds.x+bounds.w&&tile.y+tile.h<=bounds.y+bounds.h);
   const source=full.find(t=>t.dx===tile.dx&&t.dy===tile.dy);
   assert.ok(source);assert.equal(source.seed,tile.seed);
  }
 }
});

test('facade windows fit separate floor bays above the ground-floor cornice',()=>{
 for(const length of [16,48,110,400])for(const height of [6,20,46,78,190]){
  const {bays}=facadeLayout(length,height,true);
  for(const q of bays){
   assert.ok(q.u>0&&q.u+q.w<.977&&q.v>.338&&q.v+q.h<.94);
   for(const other of bays)if(q!==other)assert.ok(!(q.u<other.u+other.w&&q.u+q.w>other.u&&q.v<other.v+other.h&&q.v+q.h>other.v));
  }
 }
});

test('facade roof vertices follow roof scale as well as parallax displacement',()=>{
 const a={x:100,y:500},b={x:500,y:500},o={x:10,y:-45,spread:.1,cx:300,cy:400};
 const corners=facadePanel(a,b,o,0,0,1,1);
 assert.deepEqual(corners,[a,b,{x:530,y:465},{x:90,y:465}]);
});

test('textured facade grid keeps window columns straight',()=>{
 const q=[{x:-20,y:0},{x:0,y:100},{x:200,y:100},{x:220,y:0}];
 for(const u of [0,.25,.5,.75,1]){
  const a=facadePoint(q,u,0),b=facadePoint(q,u,1);
  for(let row=0;row<=16;row++){
   const t=row/16,p=facadePoint(q,u,t);
   assert.ok(Math.abs(p.x-(a.x+(b.x-a.x)*t))<1e-9);
   assert.ok(Math.abs(p.y-(a.y+(b.y-a.y)*t))<1e-9);
  }
 }
});

test('rendered facade cells map shared UV edges to identical screen positions',()=>{
 const original=globalThis.Phaser,calls=[];
 globalThis.Phaser={GameObjects:{GetCalcMatrix:()=>({calc:{getX:(x)=>x,getY:(x,y)=>y}})},Renderer:{WebGL:{Utils:{getTintAppendFloatAlpha:()=>0}}}};
 try {
  const pipeline={setGameObject:()=>0,manager:{preBatch(){},postBatch(){}},batchQuad:(...args)=>calls.push(args)};
  const corners=[{x:-35,y:-30},{x:0,y:100},{x:220,y:100},{x:265,y:-30}];
  MaterialQuad.prototype.renderWebGL({pipelines:{set:()=>pipeline}}, {corners,frame:{glTexture:{}},alpha:1}, {alpha:1,addToRenderList(){}});
  assert.equal(calls.length,64);
  for(const c of calls){
   const [u0,v0,u1,v1]=c.slice(9,13);
   const expected=[facadePoint(corners,u0,v0),facadePoint(corners,u0,v1),facadePoint(corners,u1,v1),facadePoint(corners,u1,v0)];
   expected.forEach((p,i)=>{assert.ok(Math.abs(c[1+i*2]-p.x)<1e-9);assert.ok(Math.abs(c[2+i*2]-p.y)<1e-9);});
  }
 } finally {globalThis.Phaser=original;}
});

test('slate alpha triangle maps its apex and both eaves without pinched UVs',async()=>{
 const {triangleMaterialCorners,facadePoint}=await import('../phaser/src/rendering/BuildingMaterialImages.js');
 for(const shape of [[{x:0,y:50},{x:40,y:50},{x:20,y:0}],[{x:80,y:70},{x:20,y:40},{x:65,y:10}]]){
  const q=triangleMaterialCorners(shape);
  assert.deepEqual(facadePoint(q,.5,0),shape[2]);
  assert.deepEqual(facadePoint(q,0,1),shape[0]);assert.deepEqual(facadePoint(q,1,1),shape[1]);
 }
});
