// Authored campus layout: fixed coordinates, no procedural placement.
export function compileHospitalCampus(city){
 const buildings=city.buildings.map(b=>b.id==='hospital'?{...b,h:280}:b.id==='hospitalEmergency'?{...b,y:500}:b);
 const roofAreas=Object.fromEntries(Object.entries(city.roofAreas).map(([layer,roofs])=>[layer,roofs.map(r=>r.buildingId==='hospital'?{...r,y:306,h:268}:r.buildingId==='hospitalEmergency'?{...r,y:506,h:128}:r)]));
 return {...city,buildings,roofAreas,
 landmarkSites:city.landmarkSites.map(s=>s.id==='hospital-site'?{...s,h:400}:s),
 roofDrops:city.roofDrops.map(d=>d.id==='drop_hospital_courtyard'?{...d,roof:{...d.roof,y:574}}:d),
 rooftopRoutes:city.rooftopRoutes.map(r=>r.id==='jumpHospitalEmergency'?{...r,ay:540,by:540}:r)};
}
