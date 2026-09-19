import test from 'node:test';
import assert from 'node:assert/strict';
import {CachedWarmLights} from '../phaser/src/rendering/CachedWarmLights.js';

test('repeated lights share stamps and bake no new gradients after preparation',()=>{
 let allocations=0,gradients=0;
 const gradient=()=>{gradients++;return {addColorStop(){}};};
 const lights=new CachedWarmLights(()=>{allocations++;return {getContext:()=>({createLinearGradient:gradient,createRadialGradient:gradient,fillRect(){}})};});
 const calls=[],ctx={save(){},restore(){},drawImage(...args){calls.push(args);}};
 lights.draw(ctx,'beam',10,20,8,40,.3);
 lights.draw(ctx,'halo',10,20,8,4,.2);
 const prepared=gradients;
 for(let i=0;i<100;i++)lights.draw(ctx,'beam',10,20,8,40,.3);
 assert.equal(allocations,2);assert.equal(gradients,prepared);
 assert.deepEqual(calls[0].slice(1),[2,20,16,40]);
 assert.deepEqual(calls[1].slice(1),[2,16,16,8]);
 assert.equal(calls[0][0],calls[2][0]);
 lights.destroy();assert.equal(lights.stamps.size,0);
});
