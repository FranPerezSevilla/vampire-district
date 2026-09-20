// Attached architectural volumes. Heights are absolute presentation heights above ground.
export function attachedTurrets(building,parentHeight){
 if(building.cornerTurret||building.dormer)return [];
 if(building.roofForm==='mansard')return [.36,.64].map((u,i)=>({
  id:building.id+':dormer-'+i,parentBuildingId:building.id,siteId:building.siteId,dormer:true,
  x:building.x+building.w*u-6,y:building.y+building.h*.79,w:12,h:14,
  renderBaseHeight:parentHeight,renderHeight:parentHeight+16,architecture:'tenement',family:building.family
 }));
 if(building.fenceHeight){
  const horizontal=building.w>=building.h,thickness=1.2;
  return [{id:building.id+':railing',parentBuildingId:building.id,family:building.family,architecture:'deco',campusBarrier:'railing',
   x:horizontal?building.x:building.x+(building.w-thickness)/2,y:horizontal?building.y+(building.h-thickness)/2:building.y-(building.w+thickness)/2,
   w:horizontal?building.w:thickness,h:horizontal?thickness:building.h+building.w+thickness,
   renderBaseHeight:parentHeight,renderHeight:parentHeight+building.fenceHeight}];
 }
 if(building.roofTiers)return building.roofTiers.map((t,i)=>({id:building.id+':roof-tier-'+i,parentBuildingId:building.id,x:building.x+t.inset,y:building.y+t.inset,w:building.w-2*t.inset,h:building.h-2*t.inset,renderHeight:parentHeight+t.rise,family:building.family,architecture:'deco',roofTier:true,solidPier:true}));
 const config=building.turrets??(building.id==='hospital'?{width:44,overhang:10,height:parentHeight+55,capHeight:58}:null);
 if(!config)return [];
 const width=Math.max(12,config.width??44),overhang=Math.max(0,Math.min(width*.5,config.overhang??10));
 return ['west','east'].map(side=>({
  id:`${building.id}:turret-${side}`,parentBuildingId:building.id,cornerTurret:true,
  x:side==='west'?building.x-overhang:building.x+building.w-width+overhang,
  y:building.y+building.h-width+overhang,w:width,h:width,
  renderHeight:Math.max(20,config.height??parentHeight+55),capHeight:Math.max(8,config.capHeight??58),
  family:building.family,architecture:'institutional',landmark:true
 }));
}
