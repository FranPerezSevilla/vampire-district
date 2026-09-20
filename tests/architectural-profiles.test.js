import {createPinnacleModel,projectPinnaclePoint,paintRoofPinnacles} from '../phaser/src/rendering/ArchitecturalPinnacles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {architectureFor,architectureBays,ARCHITECTURAL_PROFILES} from '../phaser/src/rendering/ArchitecturalProfiles.js';
import {paintFacadeDetail} from '../phaser/src/rendering/UrbanMaterialDetail.js';
test('landmarks share profiles, authored overrides win and tower wings keep identity',()=>{
 assert.equal(architectureFor({id:'hospital'}).key,architectureFor({id:'cathedral'}).key);
 assert.equal(architectureFor({id:'police'}).key,'deco');
 assert.equal(architectureFor({id:'x',architecture:'industrial'}).key,'industrial');
 assert.deepEqual(architectureFor({id:'x',skyline:true}),architectureFor({id:'x:tower-wing',skyline:true}));
 assert.equal(architectureFor({id:'x',architecture:'invalid'}).key,architectureFor({id:'x'}).key);
});
test('every grammar bounds windows and cell count across building sizes',()=>{
 for(const architecture of Object.keys(ARCHITECTURAL_PROFILES))for(const length of [12,24,80,400,4000]){
  const {bays,cols}=architectureBays({architecture,skyline:true},length);
  assert.ok(cols<=32);assert.ok(bays.length<=192);
  for(const q of bays){assert.ok(q.u>0&&q.u+q.w<1&&q.v>.32&&q.v+q.h<.92);}
 }
});
test('profiles produce distinct finite deterministic facade modules',()=>{
 const draw=architecture=>{
  const calls=[],g={fillStyle(...a){calls.push(a);return this;},fillPoints(p){for(const v of p){assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));}calls.push(p);return this;}};
  paintFacadeDetail(g,{id:'same',architecture},{x:0,y:0},{x:180,y:0},{x:0,y:-80},{trim:0x999999});return JSON.stringify(calls);
 };
 const results=Object.keys(ARCHITECTURAL_PROFILES).map(k=>{assert.equal(draw(k),draw(k));return draw(k);});
 assert.equal(new Set(results).size,5);
});

test('annex has no sign and window rhythm contains solid bays',()=>{
 assert.equal(architectureFor({id:'hospitalEmergency'}).sign,null);
 const {bays,cols,rows}=architectureBays({id:'hospital',landmark:true},500);
 assert.ok(bays.length<cols*rows);
 assert.ok(bays.length<=14);
 assert.ok(bays.every(q=>typeof q.lit==='boolean'));
});

test('institutional corner bays stay solid and upper floors have masonry between them',()=>{
 const {cols,rows,bays}=architectureBays({id:'hospital'},500);
 for(const q of bays){assert.notEqual(q.index%cols,0);assert.notEqual(q.index%cols,cols-1);}
 assert.ok(.52/rows-.29/rows>=.11);
 assert.equal(architectureFor({id:'cathedral'}).cornerButtresses,true);
 assert.equal(architectureFor({architecture:'industrial'}).cornerButtresses,undefined);
});

test('pinnacle volumes are cached with elevated tips and excluded from service blocks',()=>{
 const b={id:'cathedral',x:100,y:100,w:400,h:200};
 const model=createPinnacleModel(b);assert.equal(model.length,2);
 assert.ok(model.every(t=>t.tip.z===89&&t.ring.length===4&&t.ring.every(p=>p.z===0)));
 assert.equal(createPinnacleModel({...b,w:100}).length,0);
 assert.equal(createPinnacleModel({...b,architecture:'industrial'}).length,0);
});
test('pinnacle base matches roof while elevated tip leans further in all quadrants',()=>{
 for(const [x,y] of [[40,30],[-40,30],[40,-30],[-40,-30],[0,0]]){
  const o={x,y,cx:200,cy:300,spread:.1};
  const base=projectPinnaclePoint({x:200,y:300,z:0},o,160);
  const tip=projectPinnaclePoint({x:200,y:300,z:89},o,160);
  assert.deepEqual(base,{x:200+x,y:300+y});
  assert.ok(Math.abs(tip.x-(200+x*(1+89/160)))<1e-9);
  assert.ok(Math.abs(tip.y-(300+y*(1+89/160)))<1e-9);
 }
});

test('square pinnacles align exactly to institutional buttress bays and front wall',()=>{
 const b={id:'cathedral',x:100,y:200,w:440,h:260};
 const {cols}=architectureBays(b,b.w),width=b.w*Math.min(.14,.64/cols);
 const [left,right]=createPinnacleModel(b);
 assert.ok(Math.abs(Math.min(...left.ring.map(p=>p.x))-(b.x+b.w*.018))<1e-9);
 assert.ok(Math.abs(Math.max(...right.ring.map(p=>p.x))-(b.x+b.w*(1-.018)))<1e-9);
 for(const t of [left,right]){
  assert.equal(Math.max(...t.ring.map(p=>p.y)),b.y+b.h);
  assert.ok(Math.abs(Math.max(...t.ring.map(p=>p.x))-Math.min(...t.ring.map(p=>p.x))-width)<1e-9);
 }
});
