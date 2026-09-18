import { HOSPITAL_LAYBY } from '../data/hospital-access.js';
import { drawMaterialPolygon } from './MaterialTiles.js';
import { COLORS } from '../data/balance.js';
// Baked into the existing sector surface. The open edge connects to the road.
export function drawHospitalLayby(scene,target,bounds){
 const {bounds:r,points}=HOSPITAL_LAYBY;
 if(r.x+r.w<bounds.x||r.x>bounds.x+bounds.w||r.y+r.h<bounds.y||r.y>bounds.y+bounds.h)return;
 target.draw(scene.map,-bounds.x,-bounds.y);scene.map.clear();
 drawMaterialPolygon(scene,target,points,bounds,'road');
 scene.map.lineStyle(1.2,COLORS.sidewalkCurb,.6);
 for(let i=1;i<points.length;i++)scene.map.lineBetween(points[i-1].x,points[i-1].y,points[i].x,points[i].y);
}
