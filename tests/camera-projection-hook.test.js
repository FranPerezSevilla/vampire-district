import test from 'node:test';
import assert from 'node:assert/strict';
import {afterCameraProjection} from '../phaser/src/rendering/CameraProjectionHook.js';
test('projection receives same-frame follow position exactly once and restores camera lifecycle',()=>{
 const camera={scrollX:0,preRender(step){this.scrollX+=step;return this.scrollX;}};
 const original=camera.preRender,positions=[];
 const remove=afterCameraProjection(camera,()=>positions.push(camera.scrollX));
 assert.equal(camera.preRender(2),2);assert.equal(camera.preRender(3),5);
 assert.deepEqual(positions,[2,5]);remove();assert.equal(camera.preRender,original);
 camera.preRender(1);assert.deepEqual(positions,[2,5]);
});
