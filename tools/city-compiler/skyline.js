// Authored vertical district compiled into the same rectangles used by collisions.
const TOWERS = ['old-quarter:block:06'];
const LOW_QUARTER=new Set(['old-quarter:block:05','old-quarter:block:02']);
const prefix = 'skyline:';
export function compileSkyline(city) {
 const selected = new Set(TOWERS);
 const buildings=city.buildings.filter(b=>!b.id.endsWith(':tower-wing')).flatMap(b=>{
  if(LOW_QUARTER.has(b.id)){const {towerSourceBounds,skyline,...rest}=b;return [{...rest,...(towerSourceBounds||b),towerSourceBounds:undefined,skyline:false,h:b.id.endsWith('05')?80:50,storeys:b.id.endsWith('05')?3:2,family:'housing',architecture:'tenement',sign:'',name:'OLD QUARTER TENEMENT'}];}
  if(!selected.has(b.id)) return [b];
  const box=b.towerSourceBounds || {x:b.x,y:b.y,w:b.w,h:b.h};
  const common={...b,...box,towerSourceBounds:box,skyline:true,storeys:26+TOWERS.indexOf(b.id)*6,family:'office',sign:'TOWER'};
  const spine=Math.round(box.w*.57), arm=Math.round(box.h*.46);
  return [{...common,w:spine},{...common,id:b.id+':tower-wing',x:box.x+spine,w:box.w-spine,h:arm}];
 });
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([k,v])=>[k,v.filter(r=>!r.id.startsWith(prefix))]));
 for(const level of Object.keys(roofAreas))roofAreas[level]=roofAreas[level].filter(r=>!LOW_QUARTER.has(r.buildingId));
 roofAreas[1].push(...buildings.filter(b=>LOW_QUARTER.has(b.id)).map(b=>({id:'quarter-low:'+b.id,buildingId:b.id,x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12,color:0x383331,label:'TENEMENT',districtId:b.districtId})));
 const high=roofAreas[2] ||= [];
 for(const b of buildings.filter(b=>b.skyline)) high.push({id:prefix+b.id,buildingId:b.id,x:b.x,y:b.y,w:b.w,h:b.h,color:0x4c4841,label:`${b.storeys} FLOORS`,districtId:b.districtId});
 const fireEscapes=city.fireEscapes.filter(r=>!r.id.startsWith(prefix));
 const roofDrops=city.roofDrops.filter(r=>!r.id.startsWith(prefix));
 const rooftopRoutes=city.rooftopRoutes.filter(r=>!r.id.startsWith(prefix));
 for(const id of TOWERS){
  const b=buildings.find(b=>b.id===id), box=b.towerSourceBounds;
  // The recessed court is outside both solid wings; it is a safe landing/access.
  const street={x:box.x+box.w-14,y:box.y+box.h-14};
  const roof={x:b.x+b.w-12,y:street.y,layer:2};
  fireEscapes.push({id:prefix+id+':access',name:`${b.storeys}-storey service stair`,street,roof});
  roofDrops.push({id:prefix+id+':drop',label:'leap from the tower to the courtyard',roof,street,height:b.storeys});
 }
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const roofs=high.filter(r=>r.id.startsWith(prefix)||r.id==='refugeHighRoof');
 for(let i=0;i<roofs.length;i++) for(let j=i+1;j<roofs.length;j++){
  const a=roofs[i],b=roofs[j];
  if(a.buildingId.replace(':tower-wing','')===b.buildingId.replace(':tower-wing',''))continue;
  const ax=clamp(b.x+b.w/2,a.x+12,a.x+a.w-12),ay=clamp(b.y+b.h/2,a.y+12,a.y+a.h-12);
  const bx=clamp(ax,b.x+12,b.x+b.w-12),by=clamp(ay,b.y+12,b.y+b.h-12);
  if(Math.hypot(ax-bx,ay-by)>205)continue;
  rooftopRoutes.push({id:prefix+a.id+':'+b.id,ax,ay,bx,by,aLayer:2,bLayer:2,aToB:'leap to the next tower',bToA:'leap back across the skyline'});
 }
 return {...city,buildings,roofAreas,fireEscapes,roofDrops,rooftopRoutes};
}
