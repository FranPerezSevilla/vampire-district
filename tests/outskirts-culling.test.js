import test from 'node:test';
import assert from 'node:assert/strict';
import {outskirtsPieceVisible} from '../phaser/src/systems/OutskirtsSystem.js';
test('outskirts culling keeps offscreen shadows and halos until padded bounds leave view',()=>{
 const view={x:100,y:100,width:200,height:100};
 assert.equal(outskirtsPieceVisible({x:70,y:130,width:1,height:1},view),true);
 assert.equal(outskirtsPieceVisible({x:60,y:130,width:1,height:1},view),false);
 assert.equal(outskirtsPieceVisible({x:331,y:130,width:1,height:1},view),true);
 assert.equal(outskirtsPieceVisible({x:333,y:130,width:1,height:1},view),false);
 assert.equal(outskirtsPieceVisible({x:120,y:233,width:1,height:1},view),false);
 assert.equal(outskirtsPieceVisible({x:120,y:60,width:1,height:1},view),false);
 assert.equal(outskirtsPieceVisible({x:-100,y:-100,width:1000,height:1000},view),true);
 assert.equal(outskirtsPieceVisible({x:0,y:0,width:1,height:1},null),true);
});
