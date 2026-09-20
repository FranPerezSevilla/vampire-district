import test from 'node:test';import assert from 'node:assert/strict';
import * as c from '../phaser/src/data/generated/city-topology-v2.js';
import {buildingMaterial} from '../phaser/src/rendering/BuildingIdentity.js';
import {compileInfill} from '../tools/city-compiler/infill.js';
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
test('infill increases density without solid or road overlaps and remains deterministic',()=>{
 const added=c.buildings.filter(b=>b.id.startsWith('infill:'));assert.equal(added.length,18);
 for(const b of added){assert.ok(!c.roads.some(r=>overlaps(b,r)));assert.ok(!c.buildings.some(o=>o.id!==b.id&&overlaps(b,o)));}
 const result=compileInfill(c,c.roads,c);assert.deepEqual(result.buildings,c.buildings);
});
test('landmarks and ordinary buildings have distinct stable material identities',()=>{
 assert.notDeepEqual(buildingMaterial({id:'cathedral'}),buildingMaterial({id:'police'}));
 assert.deepEqual(buildingMaterial({id:'tower'}),buildingMaterial({id:'tower:tower-wing'}));
 assert.ok(new Set(c.buildings.map(b=>buildingMaterial(b).roof)).size>=6);
});
