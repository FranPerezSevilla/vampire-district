import {metresToWorld} from '../rendering/WorldScale.js';
export const POLICE_WALL_HEIGHT=metresToWorld(4.7);
// Authored block plan; shared by city compiler and static surface presentation.
export const POLICE_CAMPUS=Object.freeze({
 site:{x:1436,y:280,w:570,h:386},
 parking:{x:1842,y:310,w:150,h:344},
 driveway:{x:1870,y:654,w:100,h:39},
 walk:{x:1618,y:532,w:50,h:160},
 bays:[0,1,2,3].map(i=>({x:1946,y:318+i*78,w:40,h:70})),
 pedestrianGate:{x:1618,y:654,w:50,h:12},
 vehicleGate:{x:1870,y:654,w:100,h:12}
});
export function policeCampusVolumes(){
 const common={siteId:'police-site',family:'police-campus',districtId:'civic-center',architecture:'deco',color:0x30343a,trim:0x827d70};
 const volume=(id,x,y,w,h,storeys,extra={})=>({...common,id,name:id==='police'?'CENTRAL POLICE HEADQUARTERS':'POLICE COMPOUND',x,y,w,h,storeys,storeyMetres:4.7,...extra});
 return [
  volume('police',1588,322,110,210,6,{landmark:true,roofTiers:[{inset:12,rise:36},{inset:24,rise:68}],entrances:[{id:'main',side:'south',at:.5}]}),
  volume('police:west-wing',1480,340,108,174,3,{parentBuildingId:'police'}),
  volume('police:east-wing',1698,340,108,174,3,{parentBuildingId:'police'}),
  volume('police:gatehouse',1818,604,42,42,1),
  ...[1582,1690].map((x,i)=>volume('police:entry-pier-'+i,x,514,16,24,6,{parentBuildingId:'police',solidPier:true})),
  ...[
   ['north',1436,280,570,12,'wall'],['west',1436,292,12,362,'wall'],['east',1994,292,12,362,'wall'],
   ['front-west',1436,654,182,12,'fence'],['front-middle',1668,654,202,12,'fence'],['front-east',1970,654,36,12,'wall'],
   ['vehicle-gate',1870,654,100,8,'gate']
  ].map(([id,x,y,w,h,kind])=>volume('police:'+id,x,y,w,h,1,{campusBarrier:kind,renderHeight:POLICE_WALL_HEIGHT,...(kind==='gate'?{}:{fenceHeight:22})})),
  ...[1436,1606,1668,1858,1970,1994].map((x,i)=>volume('police:pier-'+i,x,642,12,12,1,{campusBarrier:'pier',renderHeight:POLICE_WALL_HEIGHT+24}))
 ];
}
