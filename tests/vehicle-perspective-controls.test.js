import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installPerspectiveSlider} from '../phaser/src/rendering/VehiclePerspectiveControls.js';

test('city controls change independently of cars, isolate gameplay keys, reset and clean up',()=>{
 const dom=new JSDOM('<body></body>');
 const previous=globalThis.document;globalThis.document=dom.window.document;
 try{
  let shutdown;
  const scene={events:{once(event,fn){assert.equal(event,'shutdown');shutdown=fn;}}};
  const panel=installPerspectiveSlider(scene);
  const [front,lateral,rear,car]=panel.querySelectorAll('input');
  assert.equal(panel.querySelectorAll('input').length,4);
  const change=(input,value)=>{input.value=String(value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  assert.equal(scene.vehicleStackMagnitude,2);assert.equal(car.max,'300');
  assert.equal(scene.landmarkPerspectiveMagnitude,undefined);
  change(front,250);change(lateral,0);change(rear,140);
  assert.deepEqual([scene.cityPerspective.front,scene.cityPerspective.lateral,scene.cityPerspective.rear],[2.5,0,1.4]);
  assert.equal(scene.vehicleStackMagnitude,2);
  change(car,300);assert.equal(scene.vehicleStackMagnitude,3);
  change(car,0);assert.equal(scene.vehicleStackMagnitude,0);
  assert.deepEqual([...panel.querySelectorAll('output')].map(e=>e.textContent),['250%','0%','140%','0%']);
  panel.querySelector('button').click();
  assert.deepEqual([scene.cityPerspective.front,scene.cityPerspective.lateral,scene.cityPerspective.rear,scene.vehicleStackMagnitude],[1,1,1,2]);
  let escaped=0;
  for(const type of ['pointerdown','pointerup','keydown','keyup','wheel']){
   document.body.addEventListener(type,()=>escaped++);
   car.dispatchEvent(new dom.window.Event(type,{bubbles:true}));
  }
  assert.equal(escaped,0);
  shutdown();assert.equal(document.body.children.length,0);
 }finally{globalThis.document=previous;dom.window.close();}
});
