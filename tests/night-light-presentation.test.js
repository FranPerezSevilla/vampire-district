import test from 'node:test';
import assert from 'node:assert/strict';
import {nightMaterialPixel,gradeNightCanvas} from '../phaser/src/rendering/NightPalette.js';
import {NightStreetLights,nightLightVisible,vehicleLampAnchors,NIGHT_LIGHT_BUDGET} from '../phaser/src/rendering/NightStreetLights.js';
import {vehicleStackModel} from '../phaser/src/rendering/VehicleStackModels.js';
import {VEHICLE_ARCHETYPES} from '../phaser/src/data/vehicles.js';

test('night exposure subdues neutral masonry, retains lit panes and leaves alpha unchanged',()=>{
 assert.deepEqual(nightMaterialPixel(255,196,85),[255,196,85]);
 const grey=nightMaterialPixel(120,120,120);
 assert.ok(grey.every(x=>x<80));assert.ok(grey[2]>grey[0]);
 const d=new Uint8ClampedArray([120,120,120,127,255,196,85,231,0,0,0,0]);
 const canvas={width:3,height:1,getContext:()=>({getImageData:()=>({data:d}),putImageData(){}})};
 gradeNightCanvas(canvas);assert.deepEqual([...d],[...grey,127,255,196,85,231,0,0,0,0]);
});

test('headlamps and rear lamps rotate with the authored body, independent of shadow bounds',()=>{
 for(const a of Object.values(VEHICLE_ARCHETYPES)){
  const {lamps}=vehicleStackModel(a);
  for(const angle of [0,.5,Math.PI/2,Math.PI,4.7]){
   const p=vehicleLampAnchors(100,200,angle,lamps);
   assert.ok(Math.abs(Math.hypot(p.fx-100,p.fy-200)-lamps.front)<1e-8);
   assert.ok(Math.abs(Math.hypot(p.rx-100,p.ry-200)+lamps.rear)<1e-8);
   assert.ok(Math.abs(p.c*p.lx+p.s*p.ly)<1e-8);
  }
 }
});

test('light work is capped; broken lamps, wrecks, distant and hidden cars contribute no stamps',()=>{
 const batch=()=>({count:0,items:[],setVisible(x){this.visible=x;},stamp(...args){this.items[this.count++]=args;}});
 const camera={scrollX:0,scrollY:0,width:960,height:640,zoom:1,worldView:{x:0,y:0,width:960,height:640}};
 const model=vehicleStackModel(VEHICLE_ARCHETYPES.sedan);
 const cars=Array.from({length:70},()=>({engineRunning:true,health:10,container:{visible:true,x:300,y:300,rotation:.5},visual:{stack:{model}}}));
 const scene={brokenLights:new Set(['broken']),vehicleStackMagnitude:2,vehicleSystem:{vehicles:cars}};
 const view=Object.assign(Object.create(NightStreetLights.prototype),{scene,ground:batch(),sources:batch(),lamps:[{id:'broken',x:300,y:300,radius:60}],doors:[],anchors:{},projection:{}});
 view.update(camera,true);assert.equal(view.visibleVehicleCount,NIGHT_LIGHT_BUDGET.vehicles);
 assert.ok(view.ground.count<NIGHT_LIGHT_BUDGET.quads&&view.sources.count<NIGHT_LIGHT_BUDGET.quads);
 for(const c of cars)c.health=0;
 view.update(camera,true);assert.equal(view.ground.count,0);
 scene.brokenLights.clear();view.update(camera,true);assert.equal(view.ground.count,2);
 view.update(camera,false);assert.equal(view.ground.count,0);assert.equal(view.sources.visible,false);
 const car=cars[0];car.health=10;car.container.visible=false;view.lamps=[];
 view.update(camera,true);assert.equal(view.visibleVehicleCount,0);
 car.container.visible=true;car.container.x=300;car.engineRunning=false;
 view.update(camera,true);assert.equal(view.visibleVehicleCount,0);assert.equal(view.sources.count,0);
 car.engineRunning=true;car.parked=true;
 view.update(camera,true);assert.equal(view.visibleVehicleCount,1,'unoccupied running cars retain headlamps');
 assert.ok(view.sources.count>0);
 car.disabled=true;
 view.update(camera,true);assert.equal(view.visibleVehicleCount,0);
 car.container.visible=true;car.container.x=1500;
 view.update(camera,true);assert.equal(view.visibleVehicleCount,0);
 assert.equal(nightLightVisible(1000,200,60,camera),true,'edge spill survives centre culling');
});
