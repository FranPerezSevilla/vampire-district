import {metresToWorld,scaledBuildingHeight} from './WorldScale.js';
import {cityPerspectiveAt,cityPerspectiveReach} from './CityPerspective.js';
import {ordinaryBuilding,buildingArtSeed} from './OrdinaryBuildingMaterials.js';
import {blockRoofLayout} from './OrdinaryBlockRoofs.js';

export const ROOFTOP_OBJECT_KEY='ordinary-rooftop-objects-v2';
export const DISTRICT_OBJECT_KEY='district-utility-objects-v1';
const TYPES=Object.freeze({
 ventilation:{cell:0,width:1.8,depth:1.8,height:.9},
 chimney:{cell:1,width:.85,depth:.85,height:1.9},
 access:{cell:2,width:2.2,depth:2.5,height:2.5},
 extractor:{cell:0,width:1.5,depth:1.5,height:1.2,key:DISTRICT_OBJECT_KEY},
 flue:{cell:1,width:1.1,depth:1.1,height:3.6,key:DISTRICT_OBJECT_KEY}
});

// Definitions retain a fixed world footprint and roof elevation. Presentation owns
// no physics: future rooftop encounters can reference these stable ids/bounds.
export function rooftopObjects(b){
 if(!ordinaryBuilding(b))return [];
 const roof=blockRoofLayout(b),seed=buildingArtSeed(b.id),base=roof?.terrace.z??scaledBuildingHeight(b);
 const authored=b.roofObjects;
 const defaults=roof?.kind==='mansard'?[{kind:'access',u:.34,v:.37},{kind:'ventilation',u:.70,v:.4},{kind:'chimney',u:.28,v:.70}]
  :roof?.kind==='market'?[{kind:'ventilation',u:.16,v:.2},{kind:'chimney',u:.84,v:.77}]
  :roof?.kind==='terrace'?[{kind:'ventilation',u:.23,v:.3},{kind:'chimney',u:.8,v:.24}]
  :['sawtooth','gable'].includes(roof?.kind)?[{kind:'extractor',u:.12,v:.34},{kind:'flue',u:.88,v:.7}]:null;
 const placements=authored||defaults||[
  {kind:'ventilation',u:seed%2?.30:.69,v:.26+(seed%3)*.05},
  ...(b.w>=90&&b.h>=90?[{kind:'access',u:seed%2?.70:.31,v:.62+(seed%3)*.04}]:[]),
  ...(b.w*b.h>30000?[{kind:'chimney',u:seed%2?.24:.76,v:.77}]:[])
 ];
 const objects=[];
 for(const [index,p]of placements.entries()){
  const type=TYPES[p.kind];if(!type)continue;
  const w=metresToWorld(p.width??type.width),h=metresToWorld(p.depth??type.depth),height=metresToWorld(p.height??type.height);
  const area=roof?.terrace||b,margin=roof?4:8;
  if(![w,h,height].every(n=>Number.isFinite(n)&&n>0)||w>area.w-margin*2||h>area.h-margin*2)continue;
  const x=Math.max(area.x+margin+w/2,Math.min(area.x+area.w-margin-w/2,b.x+b.w*(p.u??.5)));
  const y=Math.max(area.y+margin+h/2,Math.min(area.y+area.h-margin-h/2,b.y+b.h*(p.v??.5)));
  if(roof?.occupied.some(r=>x+w/2+4>r.x&&x-w/2-4<r.x+r.w&&y+h/2+4>r.y&&y-h/2-4<r.y+r.h))continue;
  if(objects.some(o=>Math.abs(x-o.x)<(w+o.w)/2+5&&Math.abs(y-o.y)<(h+o.h)/2+5))continue;
  objects.push({id:p.id||`${b.id}:roof:${index}`,buildingId:b.id,kind:p.kind,cell:type.cell,x,y,w,h,base,height,...(type.key?{textureKey:type.key,atlasMid:.5}:{})});
 }
 return objects;
}

export function rooftopObjectFaces(o){
 const x=o.w/2,y=o.h/2,lo=o.base,hi=lo+o.height;
 const f=(q,z,normalX,normalY,top=false)=>({q:new Float32Array(q),z:new Float32Array(z),normalX,normalY,cell:o.kind==='access'&&!top&&normalY!==1?4:o.cell+(top?0:3),top});
 return [
  f([-x,-y,-x,-y,x,-y,x,-y],[hi,lo,lo,hi],0,-1),
  f([-x,-y,-x,-y,-x,y,-x,y],[hi,lo,lo,hi],-1,0),
  f([x,-y,x,-y,x,y,x,y],[hi,lo,lo,hi],1,0),
  f([-x,y,-x,y,x,y,x,y],[hi,lo,lo,hi],0,1),
  f([-x,-y,-x,y,x,y,x,-y],[hi,hi,hi,hi],0,0,true)
 ];
}

export function projectRoofVertex(x,y,z,camera,settings,out={}){
 const p=cityPerspectiveAt(x,y,camera,out,settings);out.x=x+p.x*z;out.y=y+p.y*z;return out;
}

// Five textured surfaces in one object and one atlas. No per-prop baked textures,
// sprite slices, animation loop, physics bodies or per-frame canvas work.
export class RooftopObject extends (globalThis.Phaser?.GameObjects?.Image||class{}){
 constructor(scene,definition){
  super(scene,definition.x,definition.y,definition.textureKey||ROOFTOP_OBJECT_KEY);
  this.definition=definition;this.faces=rooftopObjectFaces(definition);this.projection={};this.screen=new Float32Array(8);
  this.setSize(definition.w,definition.h).setDepth(60+(definition.base+definition.height)*2+.2);
  scene.add.existing(this);
 }
 willRender(camera){
  if(!super.willRender(camera))return false;
  const d=this.definition,v=camera.worldView,r=(d.base+d.height)*cityPerspectiveReach(this.scene.cityPerspective)+Math.max(d.w,d.h);
  return !v||d.x+r>=v.x&&d.x-r<=v.right&&d.y+r>=v.y&&d.y-r<=v.bottom;
 }
 renderWebGL(renderer,src,camera,parentMatrix){
  const d=src.definition,m=Phaser.GameObjects.GetCalcMatrix(src,camera,parentMatrix).calc,cm=camera.matrix;
  const p=cityPerspectiveAt(d.x,d.y,camera,src.projection,src.scene.cityPerspective);
  const pipe=renderer.pipelines.set(src.pipeline,src),unit=pipe.setGameObject(src),texture=src.frame.glTexture;
  camera.addToRenderList(src);pipe.manager.preBatch(src);
  for(const f of src.faces){
   if(!f.top&&f.normalX*(p.x+f.q[0]*p.spreadX)+f.normalY*(p.y+f.q[1]*p.spreadY)>=0)continue;
   const corners=src.screen;
   for(let i=0;i<4;i++){
    const x=f.q[i*2],y=f.q[i*2+1],z=f.z[i],dx=(p.x+x*p.spreadX)*z,dy=(p.y+y*p.spreadY)*z;
    corners[i*2]=m.getX(x,y)+cm.a*dx+cm.c*dy;corners[i*2+1]=m.getY(x,y)+cm.b*dx+cm.d*dy;
   }
   // The authored atlas has its horizontal seam at 40.8%, not its midpoint.
   const mid=d.atlasMid??.408,u=f.cell%3/3,v=f.cell<3?0:mid+.002,vEnd=f.cell<3?mid-.003:1,du=2/src.frame.width,dv=2/src.frame.height;
   const tint=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(f.top?0xd4dbe4:f.normalX?0x969fae:0xb9c0c9,camera.alpha*src.alpha);
   pipe.batchQuad(src,...corners,u+du,v+dv,u+1/3-du,vEnd-dv,tint,tint,tint,tint,0,texture,unit);
  }
  pipe.manager.postBatch(src);
 }
}
