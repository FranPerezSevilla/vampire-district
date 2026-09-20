import {metresToWorld} from '../rendering/WorldScale.js';

export const CATHEDRAL_CAMPUS=Object.freeze({
 site:{x:3640,y:258,w:560,h:432},
 plaza:{x:3710,y:602,w:412,h:88},
 mainDoor:{x:3916,y:602,width:38},
 westDoor:{x:3748,y:400,width:32},
 eastDoor:{x:4084,y:400,width:32}
});

const common={siteId:'cathedral-site',family:'cathedral',districtId:'cathedral-hill',architecture:'institutional',authoredSiteFootprint:true,color:0x252929,trim:0x797565};
const volume=(id,x,y,w,h,metres,kind)=>({...common,id,x,y,w,h,heightMetres:metres,cathedralKind:kind,name:'CATHEDRAL OF THE LAST DAWN',...(id==='cathedral'?{landmark:true,entrances:[{id:'main',side:'south',at:.5}]}:{parentBuildingId:'cathedral'})});

// Presentation volumes and floor plan share the same authored dimensions. They are
// hollow: only cathedralCollisionVolumes() enters the world's building index.
export function cathedralVisualVolumes(){return [
 volume('cathedral',3828,340,176,262,22,'nave'),
 volume('cathedral:choir',3860,264,112,76,18,'choir'),
 volume('cathedral:west-transept',3748,352,80,86,16,'transept'),
 volume('cathedral:east-transept',4004,352,80,86,16,'transept'),
 volume('cathedral:west-chapel',3780,438,48,88,10,'chapel'),
 volume('cathedral:east-chapel',4004,438,48,88,10,'chapel'),
 ...[3780,4004].map((x,i)=>({...volume('cathedral:tower-'+i,x,526,48,76,32,'tower'),cornerTurret:true,capHeight:metresToWorld(9)})),
 ...[450,498].flatMap((y,i)=>[3768,4052].map((x,j)=>({...volume(`cathedral:flying-${i}-${j}`,x,y,12,12,14,'buttress'),supportX:j?4004:3828})))
];}
export const cathedralFloorAreas=Object.freeze(cathedralVisualVolumes().filter(b=>!['tower','buttress'].includes(b.cathedralKind)));
const inRect=(p,r,pad=0)=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;

export function cathedralInteriorAt(player,pad=0){
 return !!player&&(player.layer===undefined||player.layer===0)&&cathedralFloorAreas.some(r=>inRect(player,r,pad));
}
export function cathedralCutaway(previous,player,deltaMs=16.67){
 // A small outward margin prevents the cover switching at an open threshold.
 const inside=cathedralInteriorAt(player,previous?.inside?7:0);
 const target=inside?1:0,current=previous?.amount||0;
 const amount=current+(target-current)*(1-Math.exp(-Math.min(100,Math.max(0,deltaMs))/85));
 return {inside,amount:Math.abs(target-amount)<.004?target:amount};
}

export function cathedralCollisionVolumes(){
 const block=(id,x,y,w,h,part)=>({...common,id:id==='root'?'cathedral':'cathedral:'+id,name:'CATHEDRAL OF THE LAST DAWN',x,y,w,h,cathedralCollider:true,cathedralPart:part,renderHeight:8,...(id==='root'?{landmark:true}:{parentBuildingId:'cathedral'})});
 const walls=[
 ['choir-north',3860,264,112,8],['choir-west',3860,272,8,68],['choir-east',3964,272,8,68],
 ['shoulder-west',3828,340,40,8],['shoulder-east',3964,340,40,8],
 ['neck-west',3828,348,8,12],['neck-east',3996,348,8,12],
 ['cross-nw',3748,352,80,8],['cross-ne',4004,352,80,8],
 ['cross-west-n',3748,360,8,24],['cross-west-s',3748,416,8,22],
 ['cross-east-n',4076,360,8,24],['cross-east-s',4076,416,8,22],
 ['cross-sw',3756,430,32,8],['cross-se',4044,430,32,8],
 ['chapel-west',3780,438,8,88],['chapel-east',4044,438,8,88],
 ['root',3828,594,69,8],['front-east',3935,594,69,8]
 ].map(([id,x,y,w,h])=>block(id,x,y,w,h,'wall'));
 const towers=[3780,4004].map((x,i)=>block('tower-solid-'+i,x,526,48,76,'tower'));
 const piers=[372,450,502,552].flatMap((y,row)=>[3846,3974].map((x,col)=>block(`pier-${row}-${col}`,x,y,12,16,'pier')));
 const pews=[462,486,518,542,566].flatMap((y,row)=>[3868,3934].map((x,col)=>block(`pew-${row}-${col}`,x,y,30,9,'pew')));
 const altar=block('altar',3892,286,48,20,'altar');
 // Exterior buttress feet line up with the chapel / choir walls and leave circulation.
 const buttresses=[286,312].flatMap((y,i)=>[3848,3972].map((x,j)=>block(`choir-buttress-${i}-${j}`,x,y,12,9,'buttress')));
 const flying=[450,498].flatMap((y,i)=>[3768,4052].map((x,j)=>block(`flying-foot-${i}-${j}`,x,y,12,12,'buttress')));
 return [...walls,...towers,...piers,...pews,altar,...buttresses,...flying];
}

export function cathedralRoofAreas(){return cathedralVisualVolumes().filter(b=>b.cathedralKind!=='buttress').map(b=>({
 id:b.id==='cathedral'?'cathedralRoof':b.id+'Roof',buildingId:b.id==='cathedral'?b.id:'cathedral',
 x:b.x,y:b.y,w:b.w,h:b.h,color:0x252d30,label:'CATHEDRAL',generated:false,districtId:'cathedral-hill'
}));}
