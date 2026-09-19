import test from 'node:test';
import assert from 'node:assert/strict';
import {cityPerspectiveAt} from '../phaser/src/rendering/CityPerspective.js';
import {roofParallaxOffset} from '../phaser/src/rendering/BuildingParallax.js';
import {vehicleStackProjection} from '../phaser/src/rendering/VehicleSpriteStack.js';
const camera={scrollX:30,scrollY:80,width:1280,height:720,zoom:1};

test('buildings, free-standing props and raised attachments share identical vertex projections',()=>{
 for(const height of [14,50,140,400]){
  const b={x:100,y:150,w:210,h:140,renderHeight:height};
  const roof=roofParallaxOffset(b,camera);
  for(const [x,y]of [[100,150],[310,290],[230,230]]){
   const p=cityPerspectiveAt(x,y,camera);
   assert.ok(Math.abs(p.x*height-roof.x-(x-roof.cx)*roof.spreadX)<1e-9);
   assert.ok(Math.abs(p.y*height-roof.y-(y-roof.cy)*roof.spreadY)<1e-9);
  }
 }
});

test('the active viewport height envelope remains bounded at all game zooms',()=>{
 for(const zoom of [.5,.75,1,1.5,2]){
  const c={...camera,zoom};
  // Phaser zooms around the screen centre; include the renderer guard band.
  const cx=c.scrollX+c.width/2,cy=c.scrollY+c.height/2;
  for(const x of [cx-c.width/zoom/2-160,cx+c.width/zoom/2+160])
   for(const y of [cy-c.height/zoom/2-160,cy+c.height/zoom/2+160]){
    const p=cityPerspectiveAt(x,y,c);assert.ok(Math.hypot(p.x,p.y)<=1.65+1e-9);
   }
 }
});

test('car projection remains independent of the stronger city frontage',()=>{
 const x=camera.scrollX+camera.width/2,y=camera.scrollY+camera.height/2;
 assert.equal(vehicleStackProjection(x,y,camera,{},1).y,0);
 assert.equal(cityPerspectiveAt(x,y,camera).y,-.55);
 assert.deepEqual(vehicleStackProjection(x,y,camera,{},2),{x:0,y:-.45});
});

test('opposite controls reveal opposite faces without folding tall roofs at close zoom',()=>{
 for(const zoom of [.5,1,3,5]){
  const c={...camera,zoom},x=c.scrollX+c.width/2,y=c.scrollY+c.height/2;
  const front=cityPerspectiveAt(x,y,c,{}, {front:2.5,rear:0,lateral:1});
  const rear=cityPerspectiveAt(x,y,c,{}, {front:0,rear:2.5,lateral:1});
  assert.ok(front.y<0&&rear.y>0);
  assert.ok(front.spreadY>=0&&rear.spreadY>=0);
  const zero=cityPerspectiveAt(x+30,y+80,c,{}, {front:0,rear:0,lateral:0});
  assert.equal(zero.x,0);assert.equal(zero.y,0);
 }
});
