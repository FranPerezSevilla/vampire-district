import test from 'node:test';
import assert from 'node:assert/strict';
import {projectedQuadVisible, MaterialQuad} from '../phaser/src/rendering/BuildingMaterialImages.js';
test('projected facade bounds retain viewport crossings and padded edges',()=>{
 const c={x:100,y:50,width:400,height:300};
 assert.equal(projectedQuadVisible(c,90,100,90,200,95,200,95,100),false);
 assert.equal(projectedQuadVisible(c,90,100,90,200,96,200,96,100),true);
 assert.equal(projectedQuadVisible(c,0,0,0,500,600,500,600,0),true);
 assert.equal(projectedQuadVisible(c,505,50,505,300,600,300,600,50),false);
 assert.equal(projectedQuadVisible(c,200,355,200,400,300,400,300,355),false);
});
test('offscreen material bypasses pipeline and draw calls after transform',()=>{
 const old=globalThis.Phaser;globalThis.Phaser={GameObjects:{GetCalcMatrix:()=>({calc:{getX:x=>x+2000,getY:(_x,y)=>y}})}};
 try{MaterialQuad.prototype.renderWebGL({pipelines:{set(){assert.fail('offscreen pipeline binding')}}},{corners:[{x:0,y:0},{x:0,y:10},{x:10,y:10},{x:10,y:0}]},{x:0,y:0,width:800,height:600,addToRenderList(){assert.fail('offscreen render list')}})}finally{globalThis.Phaser=old}
});
