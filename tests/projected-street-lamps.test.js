import test from 'node:test';import assert from 'node:assert/strict';
import {ProjectedStreetLamps} from '../phaser/src/rendering/ProjectedStreetLamps.js';
import {roofParallaxOffset} from '../phaser/src/rendering/BuildingParallax.js';
test('street lamp bases stay fixed while elevated heads follow camera projection',()=>{
 const image=(x,y)=>({x,y,setPosition(x,y){this.x=x;this.y=y;return this;},setDisplaySize(){return this;},setDepth(){return this;},setOrigin(){return this;},setRotation(){return this;},setVisible(){return this;},destroy(){}});
 const scene={textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:128,height:204}),has:()=>true})},add:{image}};
 const lamps=new ProjectedStreetLamps(scene),camera={scrollX:1200,scrollY:200,width:800,height:600,zoom:1,worldView:{x:1200,y:200,right:2200,bottom:900}};
 lamps.update(camera,true,roofParallaxOffset);const l=lamps.items[0],head=l.head.x;
 camera.scrollX+=50;lamps.update(camera,true,roofParallaxOffset);
 assert.equal(l.base.x,l.x);assert.equal(l.base.y,l.y);assert.notEqual(l.head.x,head);assert.ok(l.model.renderHeight>40);lamps.destroy();assert.equal(lamps.items.length,0);
});
