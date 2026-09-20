import {VESPER_CAMPUS,vesperCampusVolumes} from '../../phaser/src/data/vesper-campus.js';
const owns=id=>id==='club'||id.startsWith('club:');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function compileVesperCampus(city){
 const volumes=vesperCampusVolumes();
 // Reserve circulation as well as the building footprint; only replace generated infill.
 const removed=new Set(city.buildings.filter(b=>owns(b.id)||(b.id.startsWith('infill:')&&overlap(b,VESPER_CAMPUS.site))).map(b=>b.id));
 const buildings=[...city.buildings.filter(b=>!removed.has(b.id)),...volumes];
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([level,roofs])=>[level,roofs.filter(r=>!removed.has(r.buildingId)&&!owns(r.buildingId||''))]));
 roofAreas[1].push(...volumes.filter(b=>!b.campusBarrier).map(b=>({id:b.id==='club'?'clubRoof':b.id+'Roof',buildingId:b.id,x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12,color:0x30272a,label:'VESPER',generated:false,districtId:'old-quarter'})));
 return {...city,buildings,roofAreas,
 landmarkSites:city.landmarkSites.map(s=>s.id==='club-site'?{...s,...VESPER_CAMPUS.site}:s),
 fireEscapes:city.fireEscapes.map(f=>f.id==='clubFireEscape'?{...f,street:{x:1860,y:1420},roof:{x:1886,y:1420,layer:1}}:f)};
}
