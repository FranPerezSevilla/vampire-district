import {DISTRICT_URBAN_VOLUMES,DISTRICT_URBAN_SPACES,DISTRICT_URBAN_PREFIX} from '../../phaser/src/data/district-blocks.js';

// Explicit district plans replace incidental infill. Main roads and existing landmark
// campuses are deliberately untouched. Roof points follow their owning footprint.
export function compileDistrictBlocks(city){
 const byId=new Map(DISTRICT_URBAN_VOLUMES.map(b=>[b.id,b]));
 const before=new Map(city.buildings.map(b=>[b.id,b]));
 const buildings=city.buildings.filter(b=>!b.id.startsWith('infill:')&&!byId.has(b.id)&&!b.id.startsWith(DISTRICT_URBAN_PREFIX));
 for(const b of DISTRICT_URBAN_VOLUMES)buildings.push({...before.get(b.id),...b});
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([layer,areas])=>[layer,areas.filter(r=>!r.buildingId?.startsWith('infill:')).map(r=>{
  const b=byId.get(r.buildingId),old=before.get(r.buildingId);if(!b||!old)return r;
  return {...r,x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12,districtId:b.districtId};
 })]));
 roofAreas[1]||=[];
 const roofOwners=new Set(Object.values(roofAreas).flat().map(r=>r.buildingId));
 for(const b of DISTRICT_URBAN_VOLUMES)if(!roofOwners.has(b.id))roofAreas[1].push({id:b.id+':urban-roof',buildingId:b.id,x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12,color:0x20262d,label:b.name,districtId:b.districtId,generated:false});
 const point=(p)=>{
  if(!p)return p;
  const owner=Object.entries(city.roofAreas).filter(([layer])=>+layer===(p.layer??1)).flatMap(([,r])=>r).find(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);
  const old=owner&&before.get(owner.buildingId),b=owner&&byId.get(owner.buildingId);
  if(!b||!old||b.x===old.x&&b.y===old.y&&b.w===old.w&&b.h===old.h)return p;
  return {...p,x:b.x+6+(p.x-owner.x)*(b.w-12)/owner.w,y:b.y+6+(p.y-owner.y)*(b.h-12)/owner.h};
 };
 return {...city,buildings,roofAreas,
  fireEscapes:city.fireEscapes.map(e=>e.id==='universityFireEscape'?{...e,street:{x:3680,y:1558},roof:{x:3680,y:1514,layer:1}}:{...e,roof:point(e.roof)}),
  roofDrops:city.roofDrops.map(e=>({...e,roof:point(e.roof)})),
  rooftopRoutes:city.rooftopRoutes.map(r=>{const a=point({x:r.ax,y:r.ay,layer:r.aLayer}),b=point({x:r.bx,y:r.by,layer:r.bLayer});return {...r,ax:a.x,ay:a.y,bx:b.x,by:b.y};}),
  pedestrianSurfaces:[...(city.pedestrianSurfaces||[]).filter(s=>!s.id.startsWith(DISTRICT_URBAN_PREFIX)),...DISTRICT_URBAN_SPACES]
 };
}
