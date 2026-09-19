import test from 'node:test';
import assert from 'node:assert/strict';
import {exposedWallSpans} from '../phaser/src/rendering/AttachedVolumeUnion.js';
const main={id:'main',x:0,y:0,w:100,h:100,height:100};
const tower={id:'tower',parentBuildingId:'main',x:80,y:80,w:30,h:30,height:140};
const heightOf=b=>b.height;
test('main wall is trimmed inside an attached tower without stretching its remaining UVs',()=>{
 assert.deepEqual(exposedWallSpans(main,{x:0,y:100},{x:100,y:100},100,[main,tower],heightOf),[[0,.8]]);
});
test('tower wall embedded in parent is clipped below roof but complete above it',()=>{
 const a={x:80,y:80},b={x:80,y:110};
 const spans=exposedWallSpans(tower,a,b,100,[main,tower],heightOf);
 assert.ok(Math.abs(spans[0][0]-2/3)<1e-9);assert.equal(spans[0][1],1);
 assert.deepEqual(exposedWallSpans(tower,a,b,140,[main,tower],heightOf),[[0,1]]);
});
test('unrelated buildings and exposed front surfaces are not clipped',()=>{
 assert.deepEqual(exposedWallSpans(tower,{x:80,y:110},{x:110,y:110},100,[main,tower],heightOf),[[0,1]]);
 assert.deepEqual(exposedWallSpans(main,{x:0,y:100},{x:100,y:100},100,[{...tower,parentBuildingId:'elsewhere'}],heightOf),[[0,1]]);
});
