import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CharacterStackRig,CHARACTER_STACK_ATLAS,CHARACTER_STACK_BOUNDS,characterStackProjection,characterInsideCamera,canStackCharacter} from '../phaser/src/rendering/CharacterSpriteStack.js';
import {MODULAR_CHARACTER_STYLES,modularCharacterPose} from '../phaser/src/rendering/ModularCharacterView.js';
import {characterAttackProgress,npcCharacterAction} from '../phaser/src/rendering/CharacterActionPresentation.js';
import {ENEMY_MELEE_BY_TYPE,POLICE_FIREARM} from '../phaser/src/data/player-combat.js';
import {updateVehicleDrawOrder} from '../phaser/src/rendering/VehicleDrawOrder.js';

test('shared character atlas and bounded assemblies retain the same slice records across animation',()=>{
 const svg=readFileSync(new URL('../phaser/assets/characters/human-stack.svg',import.meta.url),'utf8');
 assert.match(svg,/viewBox="0 0 96 192"/);assert.equal(CHARACTER_STACK_BOUNDS.length,CHARACTER_STACK_ATLAS.frames);
 for(const [x,y,w,h]of CHARACTER_STACK_BOUNDS)assert.ok(x>=0&&y>=0&&x+w<=24&&y+h<=24);
 for(const style of Object.values(MODULAR_CHARACTER_STYLES)){
  const rig=new CharacterStackRig(style),parts=new Set(rig.layers),corners=new Set(rig.layers.map(p=>p.corners));
  assert.ok(rig.layers.length<=72);
  for(let i=0;i<50;i++){
   const pose=modularCharacterPose({timeMs:i*30,moving:true,running:true,weaponId:i%2?'pistol':'iron_pipe',attacking:true,attackProgress:i/50});
   rig.update(pose,{timeMs:i*30,moving:true,running:true,upperRotation:i/8,feetRotation:-i/9,jumping:i>30,jumpProgress:i/50});
   for(const [index,p]of rig.layers.entries()){
    assert.ok(parts.has(p)&&corners.has(p.corners));assert.ok(p.frame>=0&&p.frame<CHARACTER_STACK_ATLAS.frames);
    assert.ok(p.z>=0&&p.z<=34);assert.ok([...p.corners].every(Number.isFinite));
    if(index)assert.ok(p.z>=rig.layers[index-1].z);
   }
  }
 }
});

test('running has larger strides, aim turns the upper body independently, jump folds legs and lands',()=>{
 const samples=running=>Array.from({length:80},(_,i)=>modularCharacterPose({timeMs:i*20,moving:true,running}).feet.left.y);
 const walk=samples(false),run=samples(true),span=a=>Math.max(...a)-Math.min(...a);
 assert.ok(span(run)>span(walk)*1.5);
 const rig=new CharacterStackRig(MODULAR_CHARACTER_STYLES.protagonist);
 const pose=modularCharacterPose({moving:true,running:true,timeMs:160,weaponId:'pistol'});
 rig.update(pose,{moving:true,running:true,timeMs:160});
 const foot=[...rig.legs[0].boots[0].corners],hand=[...rig.arms[0].hand[0].corners];
 rig.update(pose,{moving:true,running:true,timeMs:160,upperRotation:1.5});
 assert.deepEqual([...rig.legs[0].boots[0].corners],foot);assert.notDeepEqual([...rig.arms[0].hand[0].corners],hand);
 rig.update(pose,{jumping:true,jumpProgress:.5});const air=rig.legs[0].boots[0].z,head=rig.head[2].z;
 assert.equal(rig.shadow.alpha,0);
 rig.update(pose,{jumping:true,jumpProgress:1});
 assert.ok(air>rig.legs[0].boots[0].z+4);assert.ok(head>rig.head[2].z+2);
 rig.update(pose,{});assert.equal(rig.shadow.alpha,1);
});

test('police firearm and NPC melee sample their actual impact windows without changing action state',()=>{
 for(const [type,config]of Object.entries(ENEMY_MELEE_BY_TYPE)){
  const npc={type,enemyAttack:{elapsedMs:config.windupMs,direction:{x:1,y:0}}},before=JSON.stringify(npc);
  const a=npcCharacterAction(npc,1000);
  assert.equal(a.attackProgress,.14);assert.equal(a.weaponId,type==='police'?'iron_pipe':'unarmed');
  assert.equal(JSON.stringify(npc),before);
  assert.equal(characterAttackProgress(config.windupMs+config.activeMs,config),.3);
 }
 const cop={type:'police',policeFirearm:{phase:'burst-gap',muzzleUntil:1000+POLICE_FIREARM.muzzleFlashMs,aimDirection:{x:0,y:1}}};
 const shot=npcCharacterAction(cop,1000);assert.equal(shot.weaponId,'pistol');assert.equal(shot.attacking,true);assert.equal(shot.attackProgress,.14);
 assert.equal(npcCharacterAction(cop,1200).attacking,false);
 assert.equal(npcCharacterAction({type:'civilian'},1000).weaponId,'unarmed');
});

test('character projection is smooth, independent of sliders, with conservative height-aware culling',()=>{
 const cam={scrollX:0,scrollY:0,width:1200,height:800,zoom:1,worldView:{x:0,y:0,width:1200,height:800}};
 const a=characterStackProjection(600,400,cam),b=characterStackProjection(600.01,400,cam);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001);assert.ok(a.y<-.3);
 for(const y of [-1e7,0,1e7])assert.ok(Math.hypot(...Object.values(characterStackProjection(y,y,cam)))<1.1);
 assert.equal(characterInsideCamera({x:1210,y:400,scaleX:1,scaleY:1},cam),true);
 assert.equal(characterInsideCamera({x:1800,y:400,scaleX:1,scaleY:1},cam),false);
 assert.equal(canStackCharacter({game:{renderer:{}}}),false);
 assert.equal(canStackCharacter({game:{renderer:{gl:{}}},textures:{exists:()=>false}}),false);
});

test('stacked people share street Y order with cars but corpses and rooftop traversal retain their layers',()=>{
 const c=y=>({x:0,y,visible:true,depth:0,setDepth(d){this.depth=d;}});
 const player=c(150),car=c(100),npc={container:c(70),characterView:{stack:{}}};
 const s={currentLayer:0,player,playerCharacterView:{stack:{}},vehicleSystem:{vehicles:[{container:car}]},npcSystem:{npcs:[npc]}};
 const buffer=[];updateVehicleDrawOrder(s,buffer);assert.deepEqual(buffer,[npc.container,car,player]);
 player.y=50;updateVehicleDrawOrder(s,buffer);assert.deepEqual(buffer,[player,npc.container,car]);
 npc.dead=true;s.transitionSystem={active:true};updateVehicleDrawOrder(s,buffer);
 assert.deepEqual(buffer,[car]);assert.equal(player.depth,50);assert.equal(npc.container.depth,42);
});
