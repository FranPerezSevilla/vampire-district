import test from 'node:test';
import assert from 'node:assert/strict';
import {frontageInfluence,landmarkGroups,updateFrontage} from '../phaser/src/rendering/LandmarkFrontage.js';
import {vesperCampusVolumes} from '../phaser/src/data/vesper-campus.js';
import {attachedTurrets} from '../phaser/src/rendering/CornerTurrets.js';
import {scaledBuildingHeight} from '../phaser/src/rendering/WorldScale.js';
const volumes=vesperCampusVolumes(),group=landmarkGroups(volumes).find(g=>g.root.id==='club');
test('entire close frontage and wings trigger one shared landmark influence',()=>{
 for(const x of [1885,1930,1980,2030,2100,2175])assert.ok(frontageInfluence({x,y:1500},group.members)>0);
 for(const p of [{x:2030,y:1560},{x:1800,y:1500},{x:2030,y:1400}])assert.equal(frontageInfluence(p,group.members),0);
 assert.ok(group.members.some(b=>b.id==='club:service'));assert.ok(!group.members.some(b=>b.campusBarrier));
});
test('magnitude fades smoothly instead of snapping at proximity threshold',()=>{
 const near={x:2030,y:1498};let s;
 for(let i=0;i<200;i++)s=updateFrontage(near,group.members,s,16.67,.75);
 assert.ok(Math.abs(s.amount-.75)<.001);
 const next=updateFrontage(null,group.members,s,16.67,0);assert.ok(next.amount>0&&next.amount<s.amount);
});
test('dormers start at their own roof elevation and rise independently',()=>{
 for(const b of volumes.filter(b=>b.roofForm==='mansard')){
  const h=scaledBuildingHeight(b),ds=attachedTurrets(b,h);assert.equal(ds.length,2);
  for(const d of ds){assert.equal(d.renderBaseHeight,h);assert.equal(d.renderHeight,h+16);assert.equal(d.parentBuildingId,b.id);assert.ok(d.x>=b.x&&d.x+d.w<=b.x+b.w);assert.deepEqual(attachedTurrets(d,d.renderHeight),[]);}
 }
});
