import { perspectiveLimit } from '../phaser/src/rendering/WorldScale.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { entranceInfluence, approachInfluence, updateEntranceState } from '../phaser/src/rendering/LandmarkPerspective.js';
import { roofParallaxOffset } from '../phaser/src/rendering/BuildingParallax.js';

const hospital={id:'hospital',x:100,y:100,w:400,h:250,landmark:true};
test('only standing outside the authored access door triggers perspective',()=>{
 assert.equal(entranceInfluence({x:300,y:370},hospital),1);
 for(const p of [{x:300,y:349},{x:350,y:370},{x:300,y:450},{x:300,y:650}])assert.equal(entranceInfluence(p,hospital),0);
 assert.equal(entranceInfluence({x:300,y:370},{...hospital,id:'unconfigured'}),0);
 const two={...hospital,entrances:[{id:'a',side:'south',at:.25},{id:'b',side:'east',at:.5}]};
 assert.equal(entranceInfluence({x:200,y:370},two),1);
 assert.equal(entranceInfluence({x:520,y:225},two),1);
 assert.equal(entranceInfluence({x:480,y:225},two),0);
});
test('transition is time based, reversible, and never overshoots',()=>{
 let a=0,b=0;for(let i=0;i<60;i++)a=approachInfluence(a,1,1000/60);for(let i=0;i<30;i++)b=approachInfluence(b,1,1000/30);
 assert.ok(Math.abs(a-b)<1e-9);assert.ok(a>.94&&a<1);
 for(let i=0;i<300;i++)a=approachInfluence(a,0,1000/60);assert.equal(a,0);
});
test('frontal projection is shared per unit height and independent of debug controls',()=>{
 const camera={scrollX:0,scrollY:0,width:800,height:600};
 const options={entrance:1,northSouth:2,eastWest:2};
 const neighbour={...hospital,x:500,w:100};
 options.limit=perspectiveLimit([hospital,neighbour],camera,options);
 const project=(b,p)=>{const o=roofParallaxOffset(b,camera,options);return {x:p.x+o.x+(p.x-o.cx)*o.spreadX,y:p.y+o.y+(p.y-o.cy)*o.spreadY};};
 assert.deepEqual(project(hospital,{x:500,y:350}),project(neighbour,{x:500,y:350}));
 assert.deepEqual(roofParallaxOffset(hospital,camera,{...options,northSouth:0,eastWest:4}),roofParallaxOffset(hospital,camera,options));
});


test('door mode stays latched through threshold jitter and exits beyond a larger zone',()=>{
 let state=updateEntranceState({x:300,y:370},hospital);
 for(const p of [{x:330,y:370},{x:300,y:345},{x:340,y:400}]){
  state=updateEntranceState(p,hospital,state);assert.ok(state.door);
 }
 state=updateEntranceState({x:365,y:370},hospital,state);assert.equal(state.door,null);
 state=updateEntranceState({x:340,y:370},hospital,state);assert.equal(state.door,null);
 state=updateEntranceState({x:300,y:370},hospital,state);assert.ok(state.door);
 state=updateEntranceState({x:300,y:460},hospital,state);assert.equal(state.door,null);
});
test('frontal pose is stable under camera movement and respects doorway orientation',()=>{
 const a={scrollX:0,scrollY:0,width:800,height:600};
 const first=roofParallaxOffset(hospital,a,{entrance:1,northSouth:4,eastWest:4});
 const second=roofParallaxOffset(hospital,{...a,scrollX:200,scrollY:100},{entrance:1,northSouth:1,eastWest:1});
 assert.ok(first.x===second.x);assert.equal(first.y,second.y);
 assert.equal(first.spreadX,0);assert.equal(first.spreadY,0);
 const east=roofParallaxOffset(hospital,a,{entrance:1,direction:{nx:1,ny:0}});
 assert.ok(east.x<0);assert.ok(east.y===0);
 const annex={...hospital,id:'hospitalEmergency'};
 assert.equal(updateEntranceState({x:300,y:370},annex).amount,0);
});

