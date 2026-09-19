import {CATHEDRAL_CAMPUS,cathedralCollisionVolumes,cathedralRoofAreas} from '../../phaser/src/data/cathedral-campus.js';
const owns=id=>id==='cathedral'||String(id).startsWith('cathedral:');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function compileCathedralCampus(city){
 const removed=new Set(city.buildings.filter(b=>owns(b.id)||(b.id.startsWith('infill:')&&overlap(b,CATHEDRAL_CAMPUS.site))).map(b=>b.id));
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([layer,roofs])=>[layer,roofs.filter(r=>!removed.has(r.buildingId)&&!owns(r.buildingId))]));
 roofAreas[1].push(...cathedralRoofAreas());
 return {...city,buildings:[...city.buildings.filter(b=>!removed.has(b.id)),...cathedralCollisionVolumes()],roofAreas,
 landmarkSites:city.landmarkSites.map(s=>s.id==='cathedral-site'?{...s,...CATHEDRAL_CAMPUS.site}:s),
 fireEscapes:city.fireEscapes.map(f=>f.id==='cathedralFireEscape'?{...f,street:{x:3762,y:470},roof:{x:3804,y:470,layer:1}}:f)};
}
