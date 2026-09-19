import test from 'node:test';
import assert from 'node:assert/strict';
import {vesperCampusVolumes} from '../phaser/src/data/vesper-campus.js';
import {attachedTurrets} from '../phaser/src/rendering/CornerTurrets.js';
import {scaledBuildingHeight} from '../phaser/src/rendering/WorldScale.js';
const volumes=vesperCampusVolumes();
test('dormers start at their own roof elevation and rise independently',()=>{
 for(const b of volumes.filter(b=>b.roofForm==='mansard')){
  const h=scaledBuildingHeight(b),ds=attachedTurrets(b,h);assert.equal(ds.length,2);
  for(const d of ds){assert.equal(d.renderBaseHeight,h);assert.equal(d.renderHeight,h+16);assert.equal(d.parentBuildingId,b.id);assert.ok(d.x>=b.x&&d.x+d.w<=b.x+b.w);assert.deepEqual(attachedTurrets(d,d.renderHeight),[]);}
 }
});
