import test from 'node:test';
import assert from 'node:assert/strict';
import {propStackModel,canStackProps,PROP_STACK_BOUNDS} from '../phaser/src/rendering/PropSpriteStack.js';
import {packStackFrames} from '../phaser/src/rendering/StackMaterialAtlas.js';
import {idleCharacterGesture,characterFallPose} from '../phaser/src/rendering/CharacterGestures.js';
import {CharacterStackRig,CHARACTER_STACK_BOUNDS} from '../phaser/src/rendering/CharacterSpriteStack.js';
import {STACK_FRAME_BOUNDS} from '../phaser/src/rendering/VehicleStackModels.js';
import {MODULAR_CHARACTER_STYLES,modularCharacterPose} from '../phaser/src/rendering/ModularCharacterView.js';

test('mip-ready packing preserves native pixels and separates all frames with transparent gutters',()=>{
 for(const rects of [PROP_STACK_BOUNDS,CHARACTER_STACK_BOUNDS.map(r=>r.map(v=>v*8)),STACK_FRAME_BOUNDS.map(r=>r.map(v=>v*8))]){
  const p=packStackFrames(rects);assert.equal(p.width&(p.width-1),0);assert.equal(p.height&(p.height-1),0);
  assert.ok(p.width*p.height<=2048*1024);assert.equal(p.placements.length,rects.length);
  for(const a of p.placements){
   assert.deepEqual([a.w,a.h],rects[a.index].slice(2));
   assert.ok(a.dx>=8&&a.dy>=8&&a.dx+a.w+8<=p.width&&a.dy+a.h+8<=p.height);
   for(const b of p.placements)if(a!==b)assert.ok(a.dx+a.w+8<=b.dx||b.dx+b.w+8<=a.dx||a.dy+a.h+8<=b.dy||b.dy+b.h+8<=a.dy);
  }
 }
});

test('prop assemblies have finite, bounded reusable geometry; raised fences retain their ground footprint',()=>{
 for(const kind of ['lamp','bench','dumpster','pier','pew','altar','candle','fence']){
  const m=propStackModel(kind,{w:60,h:14,height:kind==='lamp'?50:20});
  assert.ok(m.layers.length>0&&m.layers.length<100);
  for(const l of m.layers){assert.equal(l.q.length,8);assert.equal(l.z.length,4);assert.ok([...l.q,...l.z].every(Number.isFinite));assert.ok(Math.min(...l.z)>=0);}
 }
 const flat=propStackModel('fence',{w:90,height:20,base:60});
 const side=propStackModel('fence',{w:90,height:20,base:60,vertical:true});
 for(let i=0;i<flat.layers.length;i++)for(let p=0;p<8;p+=2){assert.equal(side.layers[i].q[p],-flat.layers[i].q[p+1]);assert.equal(side.layers[i].q[p+1],flat.layers[i].q[p]);}
 assert.ok(flat.layers.every(l=>Math.min(...l.z)>=60));
 const broken=propStackModel('dumpster',{broken:true}),intact=propStackModel('dumpster');
 assert.ok(broken.layers.some(l=>l.frame===8));assert.ok(intact.layers.some(l=>l.frame===6));
 assert.equal(canStackProps({game:{renderer:{}}}),false);
});

test('idle gestures stay bounded; a temporary stumble recovers but a fatal fall stays down',()=>{
 assert.equal(idleCharacterGesture(2000),null);
 assert.equal(idleCharacterGesture(5700,0,false).kind,'smoke');
 assert.equal(idleCharacterGesture(5700,0,true).kind,'radio');
 for(let t=0;t<40000;t+=50){const g=idleCharacterGesture(t);if(g){assert.ok(g.raise>=0&&g.raise<=1);assert.ok(g.exhale>=0&&g.exhale<=1);}}
 assert.equal(characterFallPose(0,'shot',true),0);
 assert.equal(characterFallPose(1500,'shot',true),1);
 assert.ok(characterFallPose(400,'trip')>.5);
 assert.equal(characterFallPose(2000,'trip'),0);
 assert.equal(characterFallPose(3000,'vehicle',false,4200),1);
 assert.equal(characterFallPose(6000,'vehicle',false,4200),0);
});

test('surface details retain vertical geometry and distinct fall silhouettes without sinking below the floor',()=>{
 const rig=new CharacterStackRig(MODULAR_CHARACTER_STYLES.protagonist),pose=modularCharacterPose({});
 rig.update(pose,{});assert.ok(rig.face.heights[0]>rig.face.heights[1]+4);
 rig.update(pose,{fallProgress:1,fallKind:'shot'});const shot=[...rig.head[2].corners];
 for(const l of rig.layers)assert.ok([...l.heights].every(z=>z>=0));
 assert.ok(Math.max(...rig.head[2].heights)<2);
 rig.update(pose,{fallProgress:1,fallKind:'vehicle'});assert.notDeepEqual([...rig.head[2].corners],shot);
 rig.update(pose,{gesture:{kind:'smoke',raise:1,exhale:.5}});assert.equal(rig.cigarette.alpha,1);assert.ok(rig.smoke.alpha>0);
 rig.update(pose,{});assert.equal(rig.cigarette.alpha,0);assert.equal(rig.smoke.alpha,0);
});
