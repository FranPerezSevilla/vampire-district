import test from 'node:test';
import assert from 'node:assert/strict';
import { NpcSystem } from '../phaser/src/systems/NpcSystem.js';
import { LAYERS } from '../phaser/src/data/district.js';
globalThis.Phaser={Math:{Distance:{Between:(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by)}}};
test('navigation pruning preserves exhaustive choices and tie order with obstacles',()=>{
 const npc={x:0,y:0,layer:LAYERS.STREET};
 for(let run=0;run<100;run++){
  const nodes=Array.from({length:80},(_,i)=>({x:i===0?10:(i*79+run*7)%1200-600,y:i===0?0:(i*31+run*19)%1000-500}));
  const clear=(ax,ay,bx,by)=>((Math.round(Math.abs(bx*3+by*7+run)))%11)!==0;
  const stand=(x,y)=>Math.abs(x+y+run)%13!==0;
  let checks=0;const system=Object.create(NpcSystem.prototype);
  system.scene={cityStreamSystem:{index:{queryPoint:()=>nodes}}};
  system.canNpcStandAt=(_,x,y)=>stand(x,y);
  system.lineClear=(_,ax,ay,bx,by)=>{checks++;return clear(ax,ay,bx,by)};
  let best=null,score=Infinity,referenceChecks=0;
  for(const n of nodes){if(!stand(n.x,n.y))continue;referenceChecks++;if(!clear(0,0,n.x,n.y))continue;referenceChecks++;const s=Math.hypot(n.x,n.y)+Math.hypot(n.x-30,n.y)+(clear(n.x,n.y,30,0)?0:180);if(s<score){best=n;score=s;}}
  assert.ok(best);assert.strictEqual(system.bestVisibleNavNode(npc,30,0),best);assert.ok(checks<referenceChecks);
 }
});
