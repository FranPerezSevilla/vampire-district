import {CATHEDRAL_CAMPUS as plan,cathedralFloorAreas,cathedralCollisionVolumes} from '../data/cathedral-campus.js';
import {drawMaterialRects} from './MaterialTiles.js';
import {CachedWarmLights} from './CachedWarmLights.js';
import {cathedralAtlasPart} from './CathedralArchitecture.js';
import {canStackProps} from './PropSpriteStack.js';

function bakeCathedralGround(scene){
 const key='cathedral-ground-v1';if(scene.textures.exists(key))return key;
 const s=plan.site,scale=2,canvas=document.createElement('canvas');canvas.width=s.w*scale;canvas.height=s.h*scale;
 const c=canvas.getContext('2d');c.scale(scale,scale);c.translate(-s.x,-s.y);
 const floor=scene.textures.get('cathedral-floor').getSourceImage();
 const tile=document.createElement('canvas');tile.width=tile.height=96;tile.getContext('2d').drawImage(floor,0,0,96,96);
 c.save();c.beginPath();for(const r of cathedralFloorAreas)c.rect(r.x,r.y,r.w,r.h);c.clip();
 c.fillStyle=c.createPattern(tile,'repeat');c.fillRect(s.x,s.y,s.w,s.h);
 // Inlays and runner preserve a clear main circulation line across the crossing.
 c.fillStyle='rgba(117,101,70,.13)';c.fillRect(3897,306,38,296);
 c.strokeStyle='rgba(155,143,111,.45)';c.lineWidth=1;
 for(const x of [3897,3935]){c.beginPath();c.moveTo(x,306);c.lineTo(x,602);c.stroke();}
 c.fillStyle='rgba(70,32,39,.32)';c.fillRect(3903,307,26,276);
 c.strokeStyle='#626359';c.strokeRect(3876,274,80,47);
 c.fillStyle='rgba(0,0,0,.22)';c.fillRect(s.x,s.y,s.w,s.h);
 const glow=new CachedWarmLights();
 for(const [x,y] of [[3838,410],[3994,410],[3796,466],[4036,466],[3878,300],[3954,300]]){
  glow.draw(c,'halo',x,y,24,35,.27);
 }
 // Quiet colored pools of light from stained glass, cached with the floor.
 for(const [x,color] of [[3790,'rgba(164,89,67,.15)'],[4006,'rgba(96,109,157,.15)']]){
  const gradient=c.createLinearGradient(x,440,x+40,510);gradient.addColorStop(0,color);gradient.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=gradient;c.beginPath();c.moveTo(x,438);c.lineTo(x+20,438);c.lineTo(x+48,508);c.lineTo(x+2,508);c.fill();
 }
 c.restore();
 const atlas=scene.textures.get('cathedral-facade').getSourceImage();
 const furniture=scene.textures.get('cathedral-furniture').getSourceImage();
 for(const b of cathedralCollisionVolumes()){
  c.fillStyle='rgba(0,0,0,.5)';c.fillRect(b.x-2,b.y-1,b.w+5,b.h+5);
  if(['wall','tower','buttress'].includes(b.cathedralPart)){
   c.save();c.beginPath();c.rect(b.x,b.y,b.w,b.h);c.clip();
   for(let y=b.y;y<b.y+b.h;y+=32)for(let x=b.x;x<b.x+b.w;x+=32)cathedralAtlasPart(c,atlas,'stone',x,y,32,32);
   c.restore();c.strokeStyle='#61625b';c.lineWidth=.65;c.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);
  }else if(!canStackProps(scene)){
   const [u,v,w,h]=b.cathedralPart==='pew'?[.045,.15,.46,.20]:b.cathedralPart==='pier'?[.555,.035,.41,.43]:[.055,.605,.48,.30];
   c.drawImage(furniture,u*furniture.width,v*furniture.height,w*furniture.width,h*furniture.height,b.x-1,b.y-1,b.w+2,b.h+2);
  }
 }
 for(const [x,y] of [[3877,325],[3949,325],[3806,482],[4022,482]]){
  if(!canStackProps(scene)){const sw=furniture.width/2,sh=furniture.height/2;c.drawImage(furniture,sw,sh,sw,sh,x-6,y-6,12,12);}
  glow.draw(c,'halo',x,y,20,20,.38);
 }
 // Wide stone path and entrance spill connect the door to the public pavement.
 c.fillStyle='rgba(131,127,113,.25)';c.fillRect(3897,602,38,88);
 c.strokeStyle='rgba(157,149,127,.48)';for(const y of [604,609,614]){c.beginPath();c.moveTo(3893,y);c.lineTo(3939,y);c.stroke();}
 glow.draw(c,'beam',3916,602,24,42,.2);glow.destroy();
 scene.textures.addImage(key,canvas);scene.events.once('shutdown',()=>scene.textures.remove(key));return key;
}

export function drawCathedralCampusGround(scene,target,bounds){
 const s=plan.site;if(s.x+s.w<bounds.x||s.x>bounds.x+bounds.w||s.y+s.h<bounds.y||s.y>bounds.y+bounds.h)return;
 if(!scene.textures.exists('cathedral-furniture'))return;
 target.draw(scene.map,-bounds.x,-bounds.y);scene.map.clear();
 drawMaterialRects(scene,target,[s],bounds,'sidewalk');
 const key=bakeCathedralGround(scene);
 let image=scene.cathedralGroundStamp;
 if(!image){image=scene.add.image(0,0,key).setOrigin(0,0).setDisplaySize(s.w,s.h).setVisible(false);scene.cathedralGroundStamp=image;scene.events.once('shutdown',()=>{image.destroy();scene.cathedralGroundStamp=null;});}
 target.draw(image,s.x-bounds.x,s.y-bounds.y);
}
