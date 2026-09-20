import test from 'node:test';
import assert from 'node:assert/strict';
import {CharacterMotion,characterAngleDelta} from '../phaser/src/rendering/CharacterMotion.js';
import {CharacterStackRig,projectCharacterLimb} from '../phaser/src/rendering/CharacterSpriteStack.js';
import {MODULAR_CHARACTER_STYLES,modularCharacterPose} from '../phaser/src/rendering/ModularCharacterView.js';

test('locomotion owns facing; passive aim cannot turn a moving or idle character',()=>{
 const m=new CharacterMotion();
 for(let timeMs=0;timeMs<500;timeMs+=16)m.update({timeMs,moving:true,movementDirection:{x:1,y:0},aimDirection:{x:-1,y:0}});
 assert.ok(Math.abs(m.rotation-Math.PI/2)<.001);
 const angle=m.rotation;
 for(let timeMs=500;timeMs<1000;timeMs+=16)m.update({timeMs,aimDirection:{x:0,y:-1}});
 assert.ok(Math.abs(m.rotation-angle)<.001);assert.equal(m.feetRotation,m.rotation);
});

test('accepted attacks own exact aim but never disconnect hips; movement resumes on release',()=>{
 const m=new CharacterMotion();
 m.update({timeMs:0,moving:true,movementDirection:{x:0,y:-1}});
 m.update({timeMs:16,moving:true,movementDirection:{x:0,y:-1},actionFacing:true,aimDirection:{x:0,y:1}});
 assert.ok(Math.abs(Math.cos(m.rotation)+1)<.001);
 assert.ok(Math.abs(characterAngleDelta(m.rotation,m.feetRotation))<=.45);
 for(let timeMs=32;timeMs<600;timeMs+=16)m.update({timeMs,moving:true,movementDirection:{x:0,y:-1}});
 assert.ok(Math.abs(characterAngleDelta(m.rotation,0))<.001);
 const last=m.rotation;
 m.update({timeMs:616,moving:true,actionFacing:true,aimDirection:{x:1,y:0},incapacitated:true});
 assert.equal(m.rotation,last);
});

test('starts, stops and running changes blend without resetting stride phase; long sleeps are bounded',()=>{
 const m=new CharacterMotion(.6);m.update({timeMs:0});
 m.update({timeMs:16,moving:true});const phase=m.phase;
 assert.ok(m.moveBlend>0&&m.moveBlend<.5);
 m.update({timeMs:32,moving:true,running:true});assert.ok(m.phase>phase&&m.phase-phase<.4);
 m.update({timeMs:48});assert.ok(m.moveBlend>0);
 for(let timeMs=64;timeMs<2000;timeMs+=16)m.update({timeMs});
 const resting=m.phase;m.update({timeMs:100000});assert.ok(Math.abs(m.phase-resting)<.001);
 const stopped=m.phase;m.update({timeMs:100016,moving:true});assert.ok(Math.abs(m.phase-stopped)<.4);
});

test('rounded limbs share joints throughout locomotion, gestures and falls, with cap overlap after projection',()=>{
 const rig=new CharacterStackRig(MODULAR_CHARACTER_STYLES.protagonist);
 const joint=(p,top)=>top?[p.corners[0],p.corners[1],p.heights[0]]:[p.corners[2],p.corners[3],p.heights[1]];
 const m={a:1,b:0,getX:(x)=>x,getY:(_,y)=>y},quad=new Float32Array(8);
 const check=p=>{
  assert.equal(projectCharacterLimb(p,m,0,-.48,quad),quad);
  assert.ok([...quad].every(Number.isFinite));
  const t=joint(p,true),b=joint(p,false),length=Math.hypot(b[0]-t[0],b[1]-.48*b[2]-t[1]+.48*t[2]);
  const capLength=Math.hypot((quad[2]+quad[4]-quad[0]-quad[6])/2,(quad[3]+quad[5]-quad[1]-quad[7])/2);
  assert.ok(capLength>length+.7*(p.widthTop+p.widthBottom),'caps overlap shared joint');
 };
 for(let step=0;step<100;step++){
  const pose=modularCharacterPose({timeMs:step*17,moving:true,running:step>50,weaponId:step%2?'pistol':'unarmed'});
  rig.update(pose,{timeMs:step*17,moving:true,upperRotation:step*.1,feetRotation:step*.1-.2,gesture:step>80?{kind:'smoke',raise:.7}:null,fallProgress:step>90?(step-90)/10:0});
  for(const l of rig.legs){assert.deepEqual(joint(l.leg[0],true),joint(l.leg[1],false));l.leg.forEach(check);}
  for(const a of rig.arms){assert.deepEqual(joint(a.sleeve[0],false),joint(a.sleeve[1],true));a.sleeve.forEach(check);}
 }
 const neutral=modularCharacterPose({});
 assert.equal((neutral.feet.left.y+neutral.feet.right.y)/2,0,'feet centered at pelvis');
 assert.ok(rig.layers.length<=54,'fewer records than the previous box-based rig');
});
