import test from 'node:test';
import assert from 'node:assert/strict';
import { attachedTurrets } from '../phaser/src/rendering/CornerTurrets.js';
import { buildingHeight, facadeHeightBands } from '../phaser/src/rendering/BuildingParallax.js';
import { createPinnacleModel } from '../phaser/src/rendering/ArchitecturalPinnacles.js';
import { architectureFor } from '../phaser/src/rendering/ArchitecturalProfiles.js';
const hospital={id:'hospital',family:'hospital',landmark:true,x:300,y:300,w:400,h:280};
test('hospital gets complete taller corner volumes, not duplicate roof ornaments',()=>{
 const height=buildingHeight(hospital),[left,right]=attachedTurrets(hospital,height);
 assert.ok(left.x<hospital.x&&right.x+right.w>hospital.x+hospital.w);
 assert.ok(left.y+left.h>hospital.y+hospital.h);
 assert.ok(buildingHeight(left)>height);
 assert.equal(createPinnacleModel(hospital).length,0);
 assert.equal(attachedTurrets(left,buildingHeight(left)).length,0);
 assert.equal(architectureFor(left).wall,architectureFor(right).wall);
 assert.equal(architectureFor(left).sign,null);
 const bands=facadeHeightBands(buildingHeight(left),[height]);
 assert.equal(bands[0].lo,0);assert.equal(bands[0].hi,height);
 assert.equal(bands[1].hi,buildingHeight(left));
});
test('width, absolute shaft height, roof height and corner overhang are configurable',()=>{
 const [tower]=attachedTurrets({...hospital,turrets:{width:60,height:310,overhang:16,capHeight:70}},170);
 assert.equal(tower.w,60);assert.equal(tower.x,284);assert.equal(buildingHeight(tower),310);
 const cap=createPinnacleModel(tower)[0];assert.equal(cap.tip.z,70);assert.equal(cap.shoulder,0);
 assert.ok(cap.ring.every(p=>p.z===0));
});
