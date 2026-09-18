import { buildingEntrances, entrancePosition } from './BuildingEntrances.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Presentation-only influence. The physical camera and building footprints stay fixed.
export function entranceInfluence(player,hospital){
 if(!player||!hospital)return 0;
 let influence=0;
 for(const door of buildingEntrances(hospital)){
  const p=entrancePosition(hospital,door),dx=player.x-p.x,dy=player.y-p.y;
  const forward=dx*p.nx+dy*p.ny,side=Math.abs(dx*p.ny-dy*p.nx);
  if(forward<0)continue;
  influence=Math.max(influence,(1-smooth((side-12)/26))*(1-smooth((forward-25)/55)));
 }
 return influence;
}

export function approachInfluence(current,target,deltaMs){
 const next=current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(100,deltaMs))/350));
 return Math.abs(next-target)<.0001?target:next;
}

// Latch the selected doorway: small movements near the threshold must not fold the facade.
export function updateEntranceState(player, building, previous={}, deltaMs=16.67){
 let door=previous.door;
 if(door && player){
  const dx=player.x-door.x,dy=player.y-door.y;
  const forward=dx*door.nx+dy*door.ny,side=Math.abs(dx*door.ny-dy*door.nx);
  if(forward < -16 || forward > 105 || side > 58)door=null;
 }else door=null;
 if(!door && player){
  for(const candidate of buildingEntrances(building)){
   const p=entrancePosition(building,candidate),dx=player.x-p.x,dy=player.y-p.y;
   const forward=dx*p.nx+dy*p.ny,side=Math.abs(dx*p.ny-dy*p.nx);
   if(forward>=0 && forward<=55 && side<=24){door=p;break;}
  }
 }
 return {door, direction:door||previous.direction||{nx:0,ny:1},
  amount:approachInfluence(previous.amount||0,door?1:0,deltaMs)};
}
