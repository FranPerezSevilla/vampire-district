import {POLICE_LAMPS} from './ProjectedStreetLamps.js';
import {CachedWarmLights} from './CachedWarmLights.js';
import {POLICE_CAMPUS as plan} from '../data/police-campus.js';
import {drawMaterialRects} from './MaterialTiles.js';
// Prepared in the existing static sector cache; no additional frame loop.
export function drawPoliceCampusGround(scene,target,bounds){
 const s=plan.site;
 if(s.x+s.w<bounds.x||s.x>bounds.x+bounds.w||s.y+s.h+30<bounds.y||s.y>bounds.y+bounds.h)return;
 target.draw(scene.map,-bounds.x,-bounds.y);scene.map.clear();
 drawMaterialRects(scene,target,[plan.parking,plan.driveway],bounds,'road');
 if(typeof document!=='undefined'&&scene.textures.exists('police-lamp')){
  const key='police-campus-ground-lights';
  if(!scene.textures.exists(key)){
   const canvas=document.createElement('canvas');canvas.width=570;canvas.height=414;
   const ctx=canvas.getContext('2d'),stamps=new CachedWarmLights();
   for(const [x,y] of POLICE_LAMPS){
    stamps.draw(ctx,'halo',x-s.x,y-s.y,34,23,.22);
   }
   stamps.draw(ctx,'beam',1643-s.x,532-s.y,28,64,.18);
   scene.textures.addImage(key,canvas);stamps.destroy();
   scene.events.once('shutdown',()=>scene.textures.remove(key));
  }
  target.draw(key,s.x-bounds.x,s.y-bounds.y);
 }
 const g=scene.map,p=plan.parking,d=plan.driveway;
 // Pale coping follows the asphalt perimeter, opening onto the vehicle driveway.
 g.lineStyle(2,0xd3cebd,.9);
 g.lineBetween(p.x,p.y,p.x+p.w,p.y);
 g.lineBetween(p.x,p.y,p.x,p.y+p.h);
 g.lineBetween(p.x+p.w,p.y,p.x+p.w,p.y+p.h);
 g.lineBetween(p.x,p.y+p.h,d.x,p.y+p.h);
 g.lineBetween(d.x+d.w,p.y+p.h,p.x+p.w,p.y+p.h);
 g.lineBetween(d.x,p.y+p.h,d.x,d.y+d.h);
 g.lineBetween(d.x+d.w,p.y+p.h,d.x+d.w,d.y+d.h);
 g.fillStyle(0x9e9781,.16).fillRect(plan.walk.x,plan.walk.y,plan.walk.w,plan.walk.h);
 g.lineStyle(1,0xc2bca9,.65);
 for(const b of plan.bays){
  g.lineBetween(b.x,b.y,b.x+b.w,b.y);g.lineBetween(b.x+b.w,b.y,b.x+b.w,b.y+b.h);g.lineBetween(b.x,b.y+b.h,b.x+b.w,b.y+b.h);
 }
 // Painted stop line at the vehicle checkpoint, leaving the turning lane clear.
 g.lineStyle(2,0xb5ae99,.65).lineBetween(1876,638,1932,638);
}
