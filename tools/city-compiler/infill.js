const prefix='infill:';
const overlaps=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
export function compileInfill(city,roads,source) {
 const buildings=city.buildings.filter(b=>!b.id.startsWith(prefix));
 const reserved=[...roads.map(r=>({...r,x:r.x-30,y:r.y-30,w:r.w+60,h:r.h+60})),...city.landmarkSites];
 const points=[];
 const add=p=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))points.push(p);};
 Object.values(source.CITY_ANCHORS||{}).forEach(add);
 for(const e of [...city.fireEscapes,...city.roofDrops,...(source.sewerAccesses||[])]){add(e.street);add(e.roof);}
 for(const p of [...(source.dumpsters||[]),...(source.lights||[]),...(source.streetNavigationPoints||[])])add(p);
 const families=['housing','industrial','nightlife'];let count=0;
 // Compact infill distributed around the Old Quarter and market, preserving broad circulation gaps.
 for(const zone of source.districtZones){
  let local=0;
  for(let y=zone.y;y<zone.y+zone.h-100&&local<3&&count<18;y+=60)for(let x=zone.x;x<zone.x+zone.w-80&&local<3&&count<18;x+=60){
   const n=count,box={x,y,w:n%2?54:68,h:n%3?60:76};
   if(reserved.some(r=>overlaps(box,r))||buildings.some(b=>overlaps(box,b,26)))continue;
   if(points.some(p=>overlaps(box,{x:p.x-34,y:p.y-34,w:68,h:68})))continue;
   buildings.push({...box,id:prefix+zone.id+':'+local,name:'TENEMENT '+(local+1),sign:['FLATS','WORKS','CLUB'][n%3],family:families[n%3],districtId:zone.id,generated:true,color:0x69483e,trim:0xb68a68});
   count++;local++;
  }
 }
 return {...city,buildings};
}
