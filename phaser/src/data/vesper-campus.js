// Authored theatre compound. Coordinates shared by compiler and presentation.
export const VESPER_CAMPUS=Object.freeze({
 site:{x:1825,y:1205,w:410,h:315},
 westAlley:{x:1840,y:1265,w:40,h:225},
 eastAlley:{x:2180,y:1265,w:45,h:225},
 rearYard:{x:1840,y:1210,w:385,h:90},
 forecourt:{x:1840,y:1490,w:385,h:40},
 mainDoor:{x:2030,y:1490},backDoor:{x:2030,y:1300}
});
export function vesperCampusVolumes(){
 const common={siteId:'club-site',authoredSiteFootprint:true,family:'nightlife',districtId:'old-quarter',architecture:'tenement',color:0x30272a,trim:0x827666,storeyMetres:4.2};
 const volume=(id,x,y,w,h,storeys,extra={})=>({...common,id,name:'VESPER',x,y,w,h,storeys,...extra});
 return [
  ...[['north',1838,1206,389,2],['west',1838,1208,2,282],['east',2225,1208,2,282]].map(([id,x,y,w,h])=>volume('club:yard-fence-'+id,x,y,w,h,1,{campusBarrier:'railing',fenceMaterial:'vesper-fence',renderHeight:29})),
  volume('club',1978,1360,104,130,3,{landmark:true,storeyMetres:4.7,roofForm:'mansard',theatreFront:[98/300,202/300],sign:'VESPER',entrances:[{id:'main',side:'south',at:.5}]}),
  volume('club:west-wing',1880,1360,98,114,3,{parentBuildingId:'club',storeyMetres:3.4,roofForm:'mansard',theatreFront:[0,98/300]}),
  volume('club:east-wing',2082,1360,98,114,3,{parentBuildingId:'club',storeyMetres:3.4,roofForm:'mansard',theatreFront:[202/300,1]}),
  volume('club:stage-house',1940,1300,180,60,4,{parentBuildingId:'club',architecture:'industrial',entrances:[{id:'back',side:'north',at:.5}]}),
  volume('club:service',2120,1300,60,60,1,{parentBuildingId:'club',architecture:'industrial',entrances:[{id:'service',side:'east',at:.5}]})
 ];
}
