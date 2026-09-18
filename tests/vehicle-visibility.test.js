import test from 'node:test';
import assert from 'node:assert/strict';
import {installVehicleCulling, vehicleInsideCamera} from '../phaser/src/rendering/VehicleVisibility.js';

const part = (x, y, width, height) => ({x,y,displayWidth:width,displayHeight:height,originX:.5,originY:.5});
function car() {
  return {x:0,y:0,scaleX:1,scaleY:1,scrollFactorX:1,scrollFactorY:1,visible:true,active:true,
    list:[part(0,0,40,18),part(22,0,6,5),part(-12,10,8,3)],
    willRender(camera){return this.visible && camera.id !== 2;}};
}
test('offscreen vehicle skips rendering without changing simulation flags or camera filters',()=>{
  const vehicle=car(),camera={id:1,worldView:{x:100,y:100,width:300,height:200}};
  installVehicleCulling(vehicle);
  assert.equal(vehicle.willRender(camera),false);
  assert.equal(vehicle.active,true);assert.equal(vehicle.visible,true);
  vehicle.x=200;vehicle.y=200;assert.equal(vehicle.willRender(camera),true);
  assert.equal(vehicle.willRender({...camera,id:2}),false);
  vehicle.visible=false;assert.equal(vehicle.willRender(camera),false);
});
test('all rotated and scaled body corners touching the viewport survive the conservative test',()=>{
  const vehicle=car();installVehicleCulling(vehicle);
  for(const zoom of [.5,1,2]) for(const scale of [.7,1,2]) for(let i=0;i<72;i++) {
    const view={x:120,y:-30,width:500/zoom,height:300/zoom},camera={worldView:view};
    const angle=i*Math.PI/36;vehicle.scaleX=-scale;vehicle.scaleY=scale*.8;
    // Put a rotated nose corner exactly on each viewport edge, including when
    // the body centre is beyond that edge.
    const px=(22+3)*vehicle.scaleX,py=2.5*vehicle.scaleY;
    const dx=px*Math.cos(angle)-py*Math.sin(angle),dy=px*Math.sin(angle)+py*Math.cos(angle);
    for(const [x,y] of [[view.x,view.y+50],[view.x+view.width,view.y+50],[view.x+50,view.y],[view.x+50,view.y+view.height]]){
      vehicle.x=x-dx;vehicle.y=y-dy;assert.equal(vehicleInsideCamera(vehicle,camera),true);
    }
  }
});
test('pooled repaint refreshes bounds without stacking render hooks; unusual transforms fall back',()=>{
  const vehicle=car(),camera={worldView:{x:100,y:0,width:100,height:100}};
  installVehicleCulling(vehicle);const hook=vehicle.willRender;
  assert.equal(vehicle.willRender(camera),false);
  vehicle.list=[part(0,0,220,40)];installVehicleCulling(vehicle);
  assert.equal(vehicle.willRender,hook);assert.equal(vehicle.willRender(camera),true);
  vehicle.x=-1000;
  assert.equal(vehicle.willRender({...camera,rotation:.5}),true);
  vehicle.parentContainer={};assert.equal(vehicle.willRender(camera),true);
  vehicle.parentContainer=null;vehicle.scrollFactorX=0;assert.equal(vehicle.willRender(camera),true);
});
