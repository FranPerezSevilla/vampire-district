import test from 'node:test';
import assert from 'node:assert/strict';
import { BuildingMaterialImages } from '../phaser/src/rendering/BuildingMaterialImages.js';

test('leaving the resident set releases both facade and separate light layer',()=>{
 const removed=[],disposed=[];
 const materials=new BuildingMaterialImages({textures:{remove:key=>removed.push(key)}});
 const object=name=>({destroy:()=>disposed.push(name)});
 materials.destroyEntry({roofKey:'roof',groundKey:'contact',groundImage:object('contact'),pinnacleQuads:[object('tower')],faces:[{key:'wall',lightKey:'light',quads:[object('wall')],lightQuads:[object('light')]}]});
 assert.deepEqual(removed,['contact','wall','light','roof']);
 assert.deepEqual(disposed,['contact','tower','wall','light']);
});
