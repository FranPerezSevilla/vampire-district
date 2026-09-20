import {enemyMeleeForType, POLICE_FIREARM} from '../data/player-combat.js';

// Map each authority's actual windup/impact/recovery to the same visual key poses.
// This samples timing only: it never starts attacks, changes cooldowns or deals damage.
export function characterAttackProgress(elapsedMs,config={}) {
  const elapsed=Math.max(0,Number(elapsedMs)||0);
  const windup=Math.max(0,Number(config.windupMs)||0),active=Math.max(1,Number(config.activeMs)||1);
  const recovery=Math.max(1,Number(config.recoveryMs)||1);
  if(elapsed<windup)return .14*elapsed/windup;
  if(elapsed<windup+active)return .14+.16*(elapsed-windup)/active;
  return Math.min(1,.3+.7*(elapsed-windup-active)/recovery);
}

export function npcCharacterAction(npc,now=0) {
  const melee=npc.enemyAttack,gun=npc.policeFirearm;
  if(melee) return {weaponId:npc.type==='police'?'iron_pipe':'unarmed',attacking:true,
    attackProgress:characterAttackProgress(melee.elapsedMs,enemyMeleeForType(npc.type)),
    aimDirection:melee.direction,attackSerial:0};
  const firing=Boolean(gun && now<gun.muzzleUntil);
  const armed=Boolean(gun && (firing || ['aim','burst-gap','reload'].includes(gun.phase)));
  return {weaponId:armed?'pistol':'unarmed',attacking:firing,attackSerial:0,
    attackProgress:firing?.14+.65*Math.max(0,1-(gun.muzzleUntil-now)/POLICE_FIREARM.muzzleFlashMs):0,
    aimDirection:armed?gun.aimDirection:null};
}
