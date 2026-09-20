import test from 'node:test';
import assert from 'node:assert/strict';
import {facadeMeshDivisions} from '../phaser/src/rendering/BuildingMaterialImages.js';
import {bakePoliceFacade} from '../phaser/src/rendering/PoliceArchitecture.js';
import {scaledBuildingHeight} from '../phaser/src/rendering/WorldScale.js';
test('facade mesh keeps interpolation error below a screen pixel and affine faces need one cell',()=>{
 assert.equal(facadeMeshDivisions(0,0),1);
 for(const x of [0,1,5,30,120])for(const y of [0,2,20,200]){
  const n=facadeMeshDivisions(x,y);assert.ok(Math.hypot(x,y)/(4*n*n)<=.35+1e-9);
 }
 assert.ok(facadeMeshDivisions(3,0)**2<8);
});
test('additional floors repeat the facade without enlarging its physical module',()=>{
 const bake=(storeys,storeyMetres)=>{
  const draws=[];
  const owner={pattern:()=>({}),canvas:(w,h)=>({width:w,height:h,getContext:()=>({drawImage(...a){draws.push(a);},scale(){},createPattern(){},fillRect(){}})}),scene:{textures:{get:()=>({getSourceImage:()=>({})})}},warmLights:{draw(){}},register:()=>''};
  bakePoliceFacade(owner,{id:'police',facadeSide:'north',storeys,storeyMetres},110);
  const pixelsPerWorld=Math.min(1024,Math.ceil(scaledBuildingHeight({storeys,storeyMetres})*2))/scaledBuildingHeight({storeys,storeyMetres});
  return {rows:draws.length,worldPanelHeight:draws[0][8]/pixelsPerWorld};
 };
 const before=bake(8),after=bake(12,4.7);
 assert.ok(after.rows>before.rows);
 assert.ok(Math.abs(after.worldPanelHeight-before.worldPanelHeight)<1e-8);
});
