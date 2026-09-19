import {VESPER_CAMPUS as plan} from '../data/vesper-campus.js';
import {drawMaterialRects} from './MaterialTiles.js';
// Baked into the existing sector surface; no extra update loop or runtime noise.
export function drawVesperCampusGround(scene,target,bounds){
 const p=plan.rearYard,s=plan.site,areas=[p,plan.westAlley,plan.eastAlley];
 if(s.x+s.w<bounds.x||s.x>bounds.x+bounds.w||s.y+s.h<bounds.y||s.y>bounds.y+bounds.h)return;
 target.draw(scene.map,-bounds.x,-bounds.y);scene.map.clear();
 drawMaterialRects(scene,target,areas,bounds,'sidewalk');
 if(typeof document!=='undefined'&&scene.textures.exists('vesper-grime')){
  const key='vesper-yard-patina';
  if(!scene.textures.exists(key)){
   const canvas=document.createElement('canvas');canvas.width=s.w;canvas.height=s.h;
   const ctx=canvas.getContext('2d');ctx.beginPath();
   for(const a of areas)ctx.rect(a.x-s.x,a.y-s.y,a.w,a.h);
   ctx.clip();ctx.globalAlpha=.32;
   ctx.drawImage(scene.textures.get('vesper-grime').getSourceImage(),p.x-s.x,p.y-s.y,p.w,plan.forecourt.y-p.y);
   scene.textures.addImage(key,canvas);scene.events.once('shutdown',()=>scene.textures.remove(key));
  }
  target.draw(key,s.x-bounds.x,s.y-bounds.y);
 }
 const g=scene.map;
 g.lineStyle(1,0x686153,.65).lineBetween(p.x,p.y,p.x+p.w,p.y);
 // Worn loading apron in front of the backstage door, clear of both alley entrances.
 g.fillStyle(0x777268,.2).fillRect(1996,1264,68,36);
 g.lineStyle(1,0xb5a889,.45).lineBetween(1996,1264,2064,1264);
 g.lineBetween(1996,1264,1996,1298);g.lineBetween(2064,1264,2064,1298);
}
