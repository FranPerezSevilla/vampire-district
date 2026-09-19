import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignState} from '../phaser/src/campaign/CampaignState.js';
import {CampaignVehicleSystem} from '../phaser/src/vehicles/CampaignVehicleSystem.js';
import {VEHICLE_ARCHETYPES,VEHICLE_OWNERSHIP} from '../phaser/src/data/vehicles.js';
import {LAYERS} from '../phaser/src/data/district.js';
import {createVehicleState} from '../phaser/src/vehicles/VehicleModel.js';
import {enterVehicle,exitVehicle} from '../phaser/src/vehicles/VehicleInteractions.js';
import {updateUnoccupiedVehicleEngines} from '../phaser/src/vehicles/VehicleDriving.js';
import {VehicleSystem} from '../phaser/src/vehicles/VehicleSystem.js';
import {TrafficMaterializationSystem} from '../phaser/src/streaming/TrafficMaterializationSystem.js';
import {RawAudio} from '../phaser/src/systems/RawAudioSystem.js';

function fixture(running=false){
 const state=createCampaignState(),campaign={vehicles:new CampaignVehicleSystem(state)};
 const definition={id:'ignition-test',archetypeId:'sedan',x:100,y:100,angle:0,parked:true,layer:LAYERS.STREET,engineRunning:running};
 campaign.vehicles.markOwned(definition.id);
 const archetype=VEHICLE_ARCHETYPES.sedan,initial=createVehicleState(definition,archetype,campaign.vehicles.condition(definition));
 const car={...definition,...initial,archetype,container:{},lastPersisted:{...initial}};
 const player={x:100,y:100,setPosition(x,y){this.x=x;this.y=y;return this;},setVisible(){return this;}};
 const scene={player,currentLayer:LAYERS.STREET,canStandAt:()=>true,cameras:{main:{startFollow(){},setFollowOffset(){}}}};
 const system={scene,campaign,vehicles:[car],currentVehicleId:null,vehicle:()=>car,
  currentVehicle(){return this.currentVehicleId?car:null;},persistVehicle:VehicleSystem.prototype.persistVehicle,updateHud(){},publish(){}};
 return {state,definition,car,system};
}

test('entry starts an off engine once; exiting, saving and reentering retain ignition',t=>{
 const {state,definition,car,system}=fixture();
 const starter=t.mock.method(RawAudio,'beginVehicleEngineStart',()=>true);
 t.mock.method(RawAudio,'play',()=>true);
 const stop=t.mock.method(RawAudio,'stopVehicleEngine',()=>true);
 assert.equal(car.engineRunning,false);
 assert.equal(enterVehicle(system,car.id,{force:true}),true);
 assert.equal(car.engineRunning,true);assert.equal(starter.mock.callCount(),1);
 assert.equal(exitVehicle(system,{force:true}),true);
 assert.equal(car.engineRunning,true);assert.equal(car.parked,true);assert.equal(stop.mock.callCount(),0);
 const loaded=new CampaignVehicleSystem(JSON.parse(JSON.stringify(state)));
 const restored=createVehicleState(definition,car.archetype,loaded.condition(definition));
 assert.equal(restored.engineRunning,true);assert.equal(restored.parked,true);
 assert.equal(enterVehicle(system,car.id,{force:true}),true);
 assert.equal(starter.mock.callCount(),1);
});

test('already running empty cars need no starter, disabled cars cannot restart',t=>{
 const {car,system}=fixture(true);
 t.mock.method(RawAudio,'play',()=>true);
 const starter=t.mock.method(RawAudio,'beginVehicleEngineStart',()=>true);
 assert.equal(enterVehicle(system,car.id,{force:true}),true);assert.equal(starter.mock.callCount(),0);
 exitVehicle(system,{force:true});car.disabled=true;car.engineRunning=false;
 assert.equal(enterVehicle(system,car.id,{force:true}),false);assert.equal(starter.mock.callCount(),0);
});

test('legacy saves default off and stored ignition cannot restart a wreck',()=>{
 const {state,car,system,definition}=fixture();
 delete definition.engineRunning;
 assert.equal(system.campaign.vehicles.condition(definition).engineRunning,false);
 system.campaign.vehicles.updateCondition(car.id,{health:0,engineRunning:true});
 const restored=new CampaignVehicleSystem(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.condition(definition).engineRunning,false);
 assert.equal(createVehicleState({...definition,engineRunning:true},car.archetype,{disabled:true}).engineRunning,false);
});

test('unoccupied idling shares the existing spatial voice budget and excludes distant/off/occupied cars',t=>{
 const {car,system}=fixture(true);
 const audio=t.mock.method(RawAudio,'updateVehicleEngine',()=>true);
 system.vehicles=[car,{...car,id:'off',engineRunning:false},{...car,id:'wreck',disabled:true},{...car,id:'far',x:2000}];
 updateUnoccupiedVehicleEngines(system);
 assert.equal(audio.mock.callCount(),1);assert.equal(audio.mock.calls[0].arguments[0],`player:${car.id}`);
 assert.equal(audio.mock.calls[0].arguments[1].priority,0);
 system.currentVehicleId=car.id;updateUnoccupiedVehicleEngines(system);assert.equal(audio.mock.callCount(),1);
 system.currentVehicleId=null;system.scene.currentLayer=1;updateUnoccupiedVehicleEngines(system);assert.equal(audio.mock.callCount(),1);
});

test('traffic pool reuse and hijacking transfer running ignition before slot release',()=>{
 const container={setActive(){return this;},setVisible(){return this;}};
 const slot={container,x:100,y:100,angle:0,radius:18,archetype:VEHICLE_ARCHETYPES.sedan,archetypeId:'sedan'};
 let adopted;
 const materializer=Object.assign(Object.create(TrafficMaterializationSystem.prototype),{
  assignments:new Map(),hijackSequence:0,configureSlotArchetype(){},updateSlot(){},spawnOccupants:()=>[],publish(){},
  scene:{player:{x:100,y:100},lastActionText:'',vehicleSystem:{isDriving:()=>false,
   addTransientVehicle(definition){adopted=definition;return definition;},enterVehicle:()=>true,pruneTransientVehicles(){}}}
 });
 materializer.assign(slot,{tokenId:'traffic-test'});assert.equal(slot.engineRunning,true);
 assert.equal(materializer.hijack('traffic-test'),true);
 assert.equal(adopted.engineRunning,true);assert.equal(slot.engineRunning,false);assert.equal(slot.tokenId,null);
 materializer.assign(slot,{tokenId:'next'});assert.equal(slot.engineRunning,true);
});
