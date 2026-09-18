import test from 'node:test';import assert from 'node:assert/strict';
import {buildingHeight, facadeHeightBands, roofParallaxOffset, BuildingParallax, visibleFacadeEdges, exteriorFacadeEdges} from '../phaser/src/rendering/BuildingParallax.js';
test('roof projection follows camera continuously with bounded height-dependent offset',()=>{
 const camera={scrollX:0,scrollY:0,width:800,height:600,zoom:1};const b={x:600,y:500,w:120,h:100};
 const a=roofParallaxOffset(b,camera),next=roofParallaxOffset(b,{...camera,scrollX:1});
 assert.ok(Math.abs(a.x-next.x)<.2);assert.ok(next.x<a.x);
 const tower=roofParallaxOffset({...b,skyline:true,storeys:38},camera);assert.ok(Math.abs(tower.x)>Math.abs(a.x));
 const far=roofParallaxOffset({...b,skyline:true,storeys:38},{...camera,scrollX:-100000});assert.ok(Math.abs(far.x)<=buildingHeight({...b,skyline:true,storeys:38}));assert.ok(Number.isFinite(far.y));
});
test('both wings of a tower share the same projection anchor',()=>{
 const box={x:100,y:100,w:200,h:150};const camera={scrollX:0,scrollY:0,width:800,height:600,zoom:1};
 const a={...box,w:110,skyline:true,storeys:32,towerSourceBounds:box};
 const b={...a,x:210,w:90,h:65};assert.deepEqual(roofParallaxOffset(a,camera),roofParallaxOffset(b,camera));
});
test('disabled and stationary parallax does not rebuild facade graphics',()=>{
 let refreshes=0;const roofs=new Map();roofs.values=function(){refreshes++;return Map.prototype.values.call(this);};
 const scene={cameras:{main:{scrollX:0,scrollY:0,zoom:1,width:800,height:600,worldView:{x:0,y:0,right:800,bottom:600}}}};
 const renderer=Object.assign(Object.create(BuildingParallax.prototype),{scene,lamps:{update(){}},attachmentCache:new WeakMap(),dormant:new Map(),roofs});
 renderer.update([],false);renderer.update([],false);assert.equal(refreshes,1);
 renderer.update([],true);renderer.update([],true);assert.equal(refreshes,2);
 scene.cameras.main.scrollX=1;renderer.update([],true);assert.equal(refreshes,3);
});


test('zoom does not move the projection centre and a camera pan visibly changes tower lean',()=>{
 const camera={scrollX:100,scrollY:200,width:800,height:600,zoom:1};
 const tower={x:450,y:450,w:100,h:100,skyline:true,storeys:32};
 const centred=roofParallaxOffset(tower,camera);
 assert.equal(centred.x,0);
 assert.deepEqual(centred,roofParallaxOffset(tower,{...camera,zoom:2}));
 const panned=roofParallaxOffset(tower,{...camera,scrollX:120+camera.scrollX});
 assert.ok(Math.abs(panned.x-centred.x)>25);
});

test('visible facades exclude back planes and draw front after sides',()=>{
 const b={x:0,y:0,w:100,h:80};
 const left=visibleFacadeEdges(b,{x:-40,y:-100});assert.equal(left.length,2);
 assert.deepEqual(left[0][0],{x:100,y:0});assert.deepEqual(left[1][0],{x:0,y:80});
 const right=visibleFacadeEdges(b,{x:40,y:-100});assert.deepEqual(right[0][0],{x:0,y:0});assert.deepEqual(right[1][0],{x:0,y:80});
 assert.equal(visibleFacadeEdges(b,{x:0,y:0}).length,0);
});

test('L-shaped tower keeps its courtyard wall but removes shared internal wall',()=>{
 const box={x:0,y:0,w:180,h:120};
 const a={x:0,y:0,w:100,h:120,skyline:true,towerSourceBounds:box};
 const b={x:100,y:0,w:80,h:50,skyline:true,towerSourceBounds:box};
 const edges=exteriorFacadeEdges(a,{x:-30,y:-50},[a,b]);
 assert.deepEqual(edges[0][0],{x:100,y:50});assert.deepEqual(edges[0][1],{x:100,y:120});
 const other=exteriorFacadeEdges(b,{x:30,y:-50},[a,b]);
 assert.equal(other.length,1);assert.equal(other[0][0].y,50);
});

test('equal-height neighbouring roofs project a shared vertex identically regardless of width',()=>{
 const camera={scrollX:100,scrollY:200,width:800,height:600};
 const a={x:100,y:300,w:400,h:200},b={x:500,y:300,w:100,h:200};
 const project=(building,p)=>{const o=roofParallaxOffset(building,camera);return {x:p.x+o.x+(p.x-o.cx)*o.spread,y:p.y+o.y+(p.y-o.cy)*o.spread};};
 const pa=project(a,{x:500,y:500}),pb=project(b,{x:500,y:500});
 assert.ok(Math.abs(pa.x-pb.x)<1e-9&&Math.abs(pa.y-pb.y)<1e-9);
});

test('tall facade is split around the annex roof without changing texture continuity',()=>{
 const bands=facadeHeightBands(78,[42,46,78]);
 assert.equal(bands[0].lo,0);assert.equal(bands.at(-1).hi,78);
 for(let i=1;i<bands.length;i++)assert.equal(bands[i-1].v0,bands[i].v1);
 const roofDepth=60+42*2;
 assert.ok(bands[0].depth<roofDepth);
 assert.ok(bands[1].depth>roofDepth);
 assert.equal(bands[0].v1,1);assert.equal(bands.at(-1).v0,0);
});

test('storeys use a shared physical scale with explicit height overrides',()=>{
 const one=buildingHeight({storeys:1}),two=buildingHeight({storeys:2});
 assert.equal(two,one*2);assert.equal(buildingHeight({renderHeight:150}),150);
 assert.equal(buildingHeight({id:'hospitalEmergency'}),one);
});

test('radial projection reveals north and south facades symmetrically without simultaneous opposites',()=>{
 const b={x:450,y:450,w:100,h:100,landmark:true};
 const cameraAt=(x,y)=>({scrollX:x-400,scrollY:y-300,width:800,height:600});
 const centre=roofParallaxOffset(b,cameraAt(500,500));
 assert.equal(centre.x,0);assert.equal(centre.y,0);
 assert.equal(visibleFacadeEdges(b,centre).length,0);
 const north=roofParallaxOffset(b,cameraAt(500,300)),south=roofParallaxOffset(b,cameraAt(500,700));
 assert.equal(north.y,-south.y);
 assert.equal(visibleFacadeEdges(b,north)[0][0].y,450);
 assert.equal(visibleFacadeEdges(b,south)[0][0].y,550);
 for(let y=350;y<=650;y++){
  const o=roofParallaxOffset(b,cameraAt(500,y));
  const horizontal=visibleFacadeEdges(b,o).filter(([a,c])=>a.y===c.y);
  assert.ok(horizontal.length<=1);
  const next=roofParallaxOffset(b,cameraAt(500,y+1));
  assert.ok(Math.abs(next.y-o.y)<.2);
 }
});

test('debug axis multipliers affect only their own axis and zero removes its facade',()=>{
 const b={x:700,y:600,w:100,h:100},camera={scrollX:0,scrollY:0,width:800,height:600};
 const base=roofParallaxOffset(b,camera);
 const tuned=roofParallaxOffset(b,camera,{eastWest:3,northSouth:0});
 assert.ok(Math.abs(tuned.x-base.x*3)<1e-9);assert.equal(tuned.y,0);
 assert.equal(tuned.spreadY,0);assert.equal(tuned.spreadX,base.spreadX*3);
 assert.ok(visibleFacadeEdges(b,tuned).every(([a,c])=>a.x===c.x));
});
