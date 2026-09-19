import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VEHICLE_STACK_ATLAS, vehicleStackProjection, vehicleStackMaterials,
 stackLayerAppearance, VehicleSpriteStack, paintStackedVehicle} from '../phaser/src/rendering/VehicleSpriteStack.js';
import {vehicleStackModel,STACK_FRAME_BOUNDS} from '../phaser/src/rendering/VehicleStackModels.js';
import {MAX_VEHICLE_STACK_SHEAR,vehicleStackMagnitude} from '../phaser/src/rendering/VehicleStackSettings.js';
import {VEHICLE_ARCHETYPES,vehicleDefinitions,trafficVehicleArchetype} from '../phaser/src/data/vehicles.js';
import {HOSPITAL_LAYBY} from '../phaser/src/data/hospital-access.js';
import {installVehicleCulling,vehicleInsideCamera} from '../phaser/src/rendering/VehicleVisibility.js';
import {applyVehicleDamagePresentation} from '../phaser/src/policies/VehicleDamagePresentationPolicy.js';
import {createVehicleState,stepVehicleKinematics} from '../phaser/src/vehicles/VehicleModel.js';

test('every archetype has a cached explicit stack, bounded sections and distinct service silhouette',()=>{
 const svg=readFileSync(new URL('../phaser/assets/vehicles/fleet-stack.svg',import.meta.url),'utf8');
 assert.match(svg,/viewBox="0 0 192 280"/);
 assert.equal(STACK_FRAME_BOUNDS.length,VEHICLE_STACK_ATLAS.frames);
 for(const [x,y,w,h] of STACK_FRAME_BOUNDS){assert.ok(x>=0&&y>=0&&x+w<=48&&y+h<=28);}
 for(const archetype of Object.values(VEHICLE_ARCHETYPES)){
  const model=vehicleStackModel(archetype);assert.ok(model,archetype.id);
  assert.equal(vehicleStackModel(archetype),model,'reuse assembly on pool replacement');
  assert.ok(model.slices.length<=37,`${archetype.id}: ${model.slices.length} sections`);
  for(const [index,layer] of model.slices.entries()){
   assert.ok(layer.frame>=0&&layer.frame<VEHICLE_STACK_ATLAS.frames);
   assert.ok(layer.z>=0&&layer.z<=model.maxHeight);
   if(index)assert.ok(layer.z>=model.slices[index-1].z,'back to front section order');
   assert.ok(layer.x>=-model.width/2&&layer.x+layer.w<=model.width/2+.00001);
   assert.ok(layer.y>=-model.height/2&&layer.y+layer.h<=model.height/2+.00001);
   for(const [x,y,z]of layer.corners||[]){assert.ok(Math.abs(x)<=model.width/2&&Math.abs(y)<=model.height/2&&z<=model.maxHeight);}
  }
 }
 const frames=id=>vehicleStackModel(VEHICLE_ARCHETYPES[id]).slices.map(s=>s.frame);
 for(const [id,frame] of [['ambulance',22],['police',20],['taxi',19],['pickup',18],['bus',39],['hearse',24],['sports',25]])assert.ok(frames(id).includes(frame),id);
 assert.ok(vehicleStackModel(VEHICLE_ARCHETYPES.ambulance).maxHeight>vehicleStackModel(VEHICLE_ARCHETYPES.sedan).maxHeight);
 assert.ok(vehicleStackModel(VEHICLE_ARCHETYPES.bus).badge);
});

test('car-only magnitude is smooth, flat at zero and bounded at every camera position',()=>{
 assert.equal(vehicleStackMagnitude(undefined),2);assert.equal(vehicleStackMagnitude(NaN),2);
 assert.equal(vehicleStackMagnitude(-2),0);assert.equal(vehicleStackMagnitude(100),3);
 for(const zoom of [.5,1,2])for(const gain of [0,.01,1,1.01,2,3,999]){
  const camera={scrollX:300,scrollY:200,width:960,height:640,zoom};
  for(const [x,y] of [[780,520],[-1e6,-1e6],[1e6,1e6],[700,600]]){
   const a=vehicleStackProjection(x,y,camera,{},gain),b=vehicleStackProjection(x,y,{...camera,scrollX:300.001},{},gain);
   assert.ok(Math.hypot(a.x,a.y)<=MAX_VEHICLE_STACK_SHEAR);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.0001);
   if(gain===0)assert.equal(Math.hypot(a.x,a.y),0);
  }
 }
 assert.ok(vehicleStackProjection(480,320,{scrollX:0,scrollY:0,width:960,height:640,zoom:1},{},2).y<-.4);
});

test('all fleet roof corners survive viewport culling at maximum volume and every heading',()=>{
 for(const archetype of Object.values(VEHICLE_ARCHETYPES)){
  const model=vehicleStackModel(archetype),padding=model.maxHeight*MAX_VEHICLE_STACK_SHEAR;
  const part={x:0,y:0,displayWidth:model.width,displayHeight:model.height,originX:.5,originY:.5,vehicleCullPadding:padding};
  const car={x:0,y:0,scaleX:1,scaleY:1,scrollFactorX:1,scrollFactorY:1,list:[part]};
  installVehicleCulling(car);
  const camera={worldView:{x:100,y:100,width:400,height:300}};
  for(let heading=0;heading<Math.PI*2;heading+=.13){
   const dx=model.width/2*Math.cos(heading)-model.height/2*Math.sin(heading),dy=model.width/2*Math.sin(heading)+model.height/2*Math.cos(heading);
   for(const [x,y,sx,sy]of [[100,200,padding,0],[500,200,-padding,0],[200,100,0,padding],[200,400,0,-padding]]){
    car.x=x-dx-sx;car.y=y-dy-sy;assert.equal(vehicleInsideCamera(car,camera),true,archetype.id);
   }
  }
  car.x=-1000;car.y=-1000;assert.equal(vehicleInsideCamera(car,camera),false);
 }
});

test('renderer never reads landmark state; every model rotates about its fixed ground contact',()=>{
 const saved=globalThis.Phaser;let m;
 globalThis.Phaser={GameObjects:{GetCalcMatrix:()=>({calc:m})},Renderer:{WebGL:{Utils:{getTintAppendFloatAlpha:(color,alpha)=>({color,alpha})}}}};
 try{
  const camera={scrollX:0,scrollY:0,width:960,height:640,zoom:1,alpha:.8,matrix:{a:1,b:0,c:0,d:1},addToRenderList(){}};
  const frame={u0:0,v0:0,u1:.25,v1:.125,glTexture:{}};
  const output=[],p={setGameObject:()=>0,manager:{preBatch(){},postBatch(){}},batchQuad:(...args)=>output.push(args)},renderer={pipelines:{set:()=>p}};
  for(const archetype of Object.values(VEHICLE_ARCHETYPES)){
   const model=vehicleStackModel(archetype),visual=vehicleStackMaterials(0x663a3b,0x9a8a6c);
   if(model.badge)visual.routeBadge={setPosition(x,y){this.x=x;this.y=y;}};
   const scene={vehicleStackMagnitude:1,get buildingParallax(){throw new Error('Cars must not read landmark state');}};
   const src={x:0,y:0,visual,model,alpha:.5,frame,projection:{},scene,slices:model.slices.map(s=>({...s,image:frame}))};
   for(scene.vehicleStackMagnitude of [0,1,3])for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const a=Math.cos(heading),b=Math.sin(heading),c=-b,d=a;
    m={a,b,c,d,getX:(x,y)=>700+x*a+y*c,getY:(x,y)=>600+x*b+y*d};
    const expected=vehicleStackProjection(700,600,camera,{},scene.vehicleStackMagnitude);
    output.length=0;VehicleSpriteStack.prototype.renderWebGL(renderer,src,camera,m);
    let emitted=0;
    for(const layer of model.slices){
     if(stackLayerAppearance(layer,visual).visible===false)continue;
     const world=(layer.corners||[[layer.x,layer.y,layer.z],[layer.x,layer.y+layer.h,layer.z],[layer.x+layer.w,layer.y+layer.h,layer.z],[layer.x+layer.w,layer.y,layer.z]])
       .map(([x,y,z])=>[m.getX(x,y)+expected.x*z,m.getY(x,y)+expected.y*z]);
     const [a,b,c]=world;
     if(layer.corners&&((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>=-1e-6)continue;
     const q=output[emitted++];assert.ok(q,'visible surface submitted');
     for(let j=0;j<4;j++){assert.ok(Math.abs(q[1+j*2]-world[j][0])<1e-8);assert.ok(Math.abs(q[2+j*2]-world[j][1])<1e-8);}
    }
    assert.equal(output.length,emitted,'hidden sides must not paint over visible surfaces');
    if(model.badge){
     const badge=visual.routeBadge,anchor=model.badge;
     assert.ok(Math.abs(m.getX(badge.x,badge.y)-m.getX(anchor.x,anchor.y)-expected.x*anchor.z)<1e-8);
     assert.ok(Math.abs(m.getY(badge.x,badge.y)-m.getY(anchor.x,anchor.y)-expected.y*anchor.z)<1e-8);
    }
   }
  }
 }finally{globalThis.Phaser=saved;}
});

test('damage and repair retain shared atlas materials for every model',()=>{
 for(const archetype of Object.values(VEHICLE_ARCHETYPES)){
  const visual=vehicleStackMaterials(archetype.color,archetype.trim),vehicle={visual,archetype,health:archetype.maxHealth,exploded:false,__viceBloodDamageFx:{smoke:[],fire:[]},container:{setAlpha(a){this.alpha=a;}}};
  const system={scene:{}};vehicle.exploded=true;applyVehicleDamagePresentation(system,vehicle);
  assert.equal(visual.body.fillColor,0x171416);assert.equal(stackLayerAppearance({material:'glass'},visual),0x34343a);
  vehicle.exploded=false;applyVehicleDamagePresentation(system,vehicle);assert.equal(visual.body.fillColor,archetype.color);
  assert.equal(stackLayerAppearance({material:'hood'},visual).visible,false,'healthy bonnet has no damage decal');
  visual.hood.setFillStyle(0x3f2027,.96);assert.equal(stackLayerAppearance({material:'hood'},visual),visual.hood);
  assert.equal(stackLayerAppearance({material:'trim'},visual),0x697687);
 }
});

test('two driveable ambulances fit the existing hospital bays and appear rarely in ambient selection',()=>{
 const ambulances=vehicleDefinitions.filter(v=>v.archetypeId==='ambulance'),a=VEHICLE_ARCHETYPES.ambulance,bay=HOSPITAL_LAYBY.parking;
 assert.equal(ambulances.length,2);assert.equal(new Set(ambulances.map(v=>v.id)).size,2);
 for(const v of ambulances){
  assert.equal(v.ownership,'parked');assert.equal(v.angle,-Math.PI/2);
  assert.ok(v.x-a.height/2>bay.x&&v.x+a.height/2<bay.x+bay.w);
  assert.ok(v.y-a.width/2>bay.y&&v.y+a.width/2<bay.y+bay.h);
 }
 const count=Array.from({length:5000},(_,i)=>trafficVehicleArchetype('fleet-'+i)).filter(a=>a.id==='ambulance').length;
 assert.ok(count>0&&count<150);assert.equal(a.emergencyService,'medical');
});

test('medical traffic shares the delivery van footprint and complete driving trajectory',()=>{
 const a=VEHICLE_ARCHETYPES.ambulance,b=VEHICLE_ARCHETYPES.delivery_van;
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.mass,b.mass);assert.equal(a.collisionPush,b.collisionPush);
 let left=createVehicleState({id:'medical',x:100,y:100,angle:0},a),right=createVehicleState({id:'delivery',x:100,y:100,angle:0},b);
 for(let i=0;i<1800;i++){
  const controls={move:{x:Math.sin(i/73)*.6,y:i<900?-1:1},handbrakeHeld:i>500&&i<520};
  left=stepVehicleKinematics(left,controls,1/60,a);right=stepVehicleKinematics(right,controls,1/60,b);
  for(const key of ['x','y','angle','speed','velocityX','velocityY','gear'])assert.equal(left[key],right[key],key);
 }
});

test('unknown archetypes, missing atlas and Canvas keep the existing fallback',()=>{
 assert.equal(paintStackedVehicle({}, {}, VEHICLE_ARCHETYPES.sedan),null);
 assert.equal(paintStackedVehicle({game:{renderer:{gl:{}}},textures:{exists:()=>false}}, {}, VEHICLE_ARCHETYPES.sedan),null);
 assert.equal(paintStackedVehicle({game:{renderer:{gl:{}}},textures:{exists:()=>true}}, {}, {id:'unknown',width:40,height:20}),null);
});
