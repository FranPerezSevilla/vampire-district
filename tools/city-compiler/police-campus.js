import {POLICE_CAMPUS,policeCampusVolumes} from '../../phaser/src/data/police-campus.js';
export function compilePoliceCampus(city){
 const volumes=policeCampusVolumes(),owns=id=>id==='police'||id.startsWith('police:');
 const buildings=[...city.buildings.filter(b=>!owns(b.id)),...volumes];
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([level,roofs])=>[level,roofs.filter(r=>!owns(r.buildingId||''))]));
 roofAreas[1].push(...volumes.filter(b=>!b.campusBarrier).map(b=>({id:b.id==='police'?'policeRoof':b.id+'Roof',buildingId:b.id,x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12,color:0x30343a,label:'POLICE',generated:false,districtId:'civic-center'})));
 return {...city,buildings,roofAreas,
  landmarkSites:city.landmarkSites.map(s=>s.id==='police-site'?{...s,...POLICE_CAMPUS.site}:s),
  roofDrops:city.roofDrops.map(d=>d.id==='drop_police_service'?{...d,roof:{x:1643,y:526,layer:1},street:{x:1643,y:580}}:d)};
}
