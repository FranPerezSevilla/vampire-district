import {NIGHT} from './NightPalette.js';
import {lights,buildings} from '../data/district.js';
import {POLICE_LAMPS} from './ProjectedStreetLamps.js';
import {buildingEntrances,entrancePosition} from './BuildingEntrances.js';
import {cityPerspectiveAt,CITY_PERSPECTIVE_MAX} from './CityPerspective.js';
import {vehicleStackProjection} from './VehicleSpriteStack.js';
import {metresToWorld} from './WorldScale.js';

const KEY='night-light-stamps-v1',CELL=128,MAX_QUADS=1024;
export const NIGHT_LIGHT_BUDGET=Object.freeze({lamps:64,vehicles:48,quads:MAX_QUADS});
export function nightLightVisible(x,y,r,camera){const v=camera.worldView;return !v||x+r>=v.x&&x-r<=v.x+v.width&&y+r>=v.y&&y-r<=v.y+v.height;}
export function vehicleLampAnchors(x,y,angle,lamps,out={}){
 const c=Math.cos(angle),s=Math.sin(angle),f=lamps.front,r=lamps.rear,h=lamps.halfTrack;
 out.fx=x+c*f;out.fy=y+s*f;out.rx=x+c*r;out.ry=y+s*r;
 out.lx=-s*h;out.ly=c*h;out.c=c;out.s=s;return out;
}
function prepareAtlas(scene){
 if(scene.textures.exists(KEY))return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const c=canvas.getContext('2d');
 for(let i=0;i<5;i++){
  const tile=document.createElement('canvas');tile.width=tile.height=CELL;const g=tile.getContext('2d');
  if(i===1||i===3){
   const source=scene.textures.get(i===1?'paving-campus':'asphalt-gothic').getSourceImage();
   g.filter=i===1?'grayscale(1) brightness(2.4) contrast(.75)':'grayscale(1) brightness(3) contrast(1.8)';
   g.drawImage(source,0,0,128,128);g.filter='none';
  }else {g.fillStyle='#fff';g.fillRect(0,0,128,128);}
  g.globalCompositeOperation='destination-in';
  const fade=g.createRadialGradient(i===2?28:64,64,0,i===2?28:64,64,i===2?99:64);
  fade.addColorStop(0,'rgba(255,255,255,1)');fade.addColorStop(i===4?.08:.22,'rgba(255,255,255,.65)');
  fade.addColorStop(.6,'rgba(255,255,255,.12)');fade.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=fade;g.fillRect(0,0,128,128);
  if(i===2){
   // A short fan with soft edges, pointing right. No long solid headlight rays.
   for(let x=0;x<128;x++){
    const radius=10+x*.36,f=g.createLinearGradient(0,64-radius,0,64+radius);
    f.addColorStop(0,'transparent');f.addColorStop(.35,'#fff');f.addColorStop(.65,'#fff');f.addColorStop(1,'transparent');
    g.fillStyle=f;g.fillRect(x,0,1,128);
   }
  }
  c.drawImage(tile,(i%4)*128,Math.floor(i/4)*128);
 }
 const texture=scene.textures.addCanvas(KEY,canvas);
 for(let i=0;i<5;i++)texture.add('light-'+i,0,i%4*128,Math.floor(i/4)*128,128,128);
}

// One batch per depth band, a fixed shared atlas, no per-light scene objects.
class LightBatch extends (globalThis.Phaser?.GameObjects?.Image||class{}){
 constructor(scene,depth){super(scene,0,0,KEY,'light-0');this.items=[];this.count=0;this.frames=Array.from({length:5},(_,i)=>scene.textures.get(KEY).get('light-'+i));this.setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);scene.add.existing(this);}
 stamp(frame,x,y,w,h,color,alpha,rotation=0){
  if(this.count>=MAX_QUADS)return;
  const q=this.items[this.count]||(this.items[this.count]={});this.count++;
  q.frame=frame;q.x=x;q.y=y;q.w=w;q.h=h;q.color=color;q.alpha=alpha;q.rotation=rotation;
 }
 renderWebGL(renderer,src,camera){
  if(!src.count)return;
  const m=Phaser.GameObjects.GetCalcMatrix(src,camera).calc,p=renderer.pipelines.set(src.pipeline,src),unit=p.setGameObject(src);
  const tint=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha,texture=src.frame.glTexture;
  camera.addToRenderList(src);p.manager.preBatch(src);
  for(let i=0;i<src.count;i++){
   const q=src.items[i],c=Math.cos(q.rotation),s=Math.sin(q.rotation),x=q.w/2,y=q.h/2,f=src.frames[q.frame],t=tint(q.color,q.alpha*camera.alpha);
   const ax=q.x-x*c+y*s,ay=q.y-x*s-y*c,bx=q.x-x*c-y*s,by=q.y-x*s+y*c;
   const cx=q.x+x*c-y*s,cy=q.y+x*s+y*c,dx=q.x+x*c+y*s,dy=q.y+x*s-y*c;
   p.batchQuad(src,m.getX(ax,ay),m.getY(ax,ay),m.getX(bx,by),m.getY(bx,by),m.getX(cx,cy),m.getY(cx,cy),m.getX(dx,dy),m.getY(dx,dy),f.u0,f.v0,f.u1,f.v1,t,t,t,t,0,texture,unit);
  }
  p.manager.postBatch(src);
 }
}

export class NightStreetLights{
 constructor(scene){
  this.scene=scene;prepareAtlas(scene);this.ground=new LightBatch(scene,45);this.sources=new LightBatch(scene,55);
  this.anchors={};this.projection={};this.lamps=[...lights,...POLICE_LAMPS.map(([x,y],i)=>({x,y,radius:48,id:'campus-lamp-'+i}))];
  this.doors=buildings.filter(b=>!b.campusBarrier&&!b.cornerTurret).flatMap(b=>buildingEntrances(b).map(d=>({...entrancePosition(b,d),club:b.siteId==='club-site'})));
 }
 update(camera,enabled){
  const s=this.scene,g=this.ground,hot=this.sources;g.count=hot.count=0;g.setVisible(enabled);hot.setVisible(enabled);if(!enabled)return;
  let count=0;
  for(const l of this.lamps){
   if(s.brokenLights?.has(l.id)||!nightLightVisible(l.x,l.y,Math.max(l.radius||54,metresToWorld(3.6)*1.65*CITY_PERSPECTIVE_MAX+12),camera))continue;
   if(count++>=NIGHT_LIGHT_BUDGET.lamps)break;
   const radius=Math.min(72,l.radius||54);
   g.stamp(1,l.x,l.y,radius*2,radius*1.6,NIGHT.amber,.40);
   g.stamp(0,l.x,l.y,42,30,NIGHT.amber,.19);
   const o=cityPerspectiveAt(l.x,l.y,camera,this.projection,s.cityPerspective),h=metresToWorld(3.6),x=l.x+o.x*h,y=l.y+o.y*h;
   hot.stamp(0,x,y,19,19,NIGHT.amber,.34);hot.stamp(4,x,y,5,5,NIGHT.headlamp,1);
  }
  for(const d of this.doors){
   if(!nightLightVisible(d.x,d.y,65,camera))continue;
   const color=d.club?0xe84d38:NIGHT.amber;
   g.stamp(1,d.x+d.nx*20,d.y+d.ny*20,74,64,color,.30);
   g.stamp(3,d.x+d.nx*16,d.y+d.ny*16,28,46,color,.25,Math.atan2(d.ny,d.nx)-Math.PI/2);
  }
  count=0;
  for(const group of [s.vehicleSystem?.vehicles,s.trafficMaterializationSystem?.pool,s.motorizedPoliceSystem?.slots])for(const v of group||[]){
   const host=v.container,stack=v.visual?.stack||host?.list?.find(o=>o.model&&o.visual);
   if(!host?.visible||!stack||!v.engineRunning||v.disabled||v.destroyed||v.health===0||!nightLightVisible(host.x,host.y,100,camera))continue;
   if(count>=NIGHT_LIGHT_BUDGET.vehicles)continue;count++;
   const lamps=stack.model.lamps,a=host.rotation||0;
   const p=vehicleLampAnchors(host.x,host.y,a,lamps,this.anchors);
   const o=vehicleStackProjection(host.x,host.y,camera,this.projection,s.vehicleStackMagnitude),z=lamps.z;
   for(const side of [-1,1]){
    const fx=p.fx+p.lx*side,fy=p.fy+p.ly*side,rx=p.rx+p.lx*side,ry=p.ry+p.ly*side;
    g.stamp(2,fx+p.c*24,fy+p.s*24,62,28,NIGHT.headlamp,.27,a);
    g.stamp(3,fx+p.c*14,fy+p.s*14,32,13,NIGHT.headlamp,.33,a);
    g.stamp(0,rx-p.c*5,ry-p.s*5,23,17,NIGHT.tail,.28);
    hot.stamp(0,fx+o.x*z,fy+o.y*z,13,13,NIGHT.headlamp,.30);
    hot.stamp(4,fx+o.x*z,fy+o.y*z,4,3,0xfff0cc,1,a);
    hot.stamp(4,rx+o.x*z,ry+o.y*z,4,3,NIGHT.tail,.90,a);
   }
   // Existing police response presentation decides whether its beacon is active.
   if(v.sirenRed||v.sirenBlue){
    const red=v.sirenRed?.alpha??.35,blue=v.sirenBlue?.alpha??.35;
    for(const [side,color,pulse]of [[-1,NIGHT.red,red],[1,NIGHT.blue,blue]]){
     g.stamp(3,host.x+p.lx*side*3,host.y+p.ly*side*3,60,46,color,pulse*.36,a);
     hot.stamp(0,host.x+o.x*stack.model.maxHeight+p.lx*side*.45,host.y+o.y*stack.model.maxHeight+p.ly*side*.45,27,27,color,pulse*.65);
    }
   }
  }
  this.visibleVehicleCount=count;
 }
 destroy(){this.ground.destroy();this.sources.destroy();}
}
