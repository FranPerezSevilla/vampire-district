import {ordinaryBlockProfile} from './OrdinaryBlockProfiles.js';
import {metresToWorld,scaledBuildingHeight} from './WorldScale.js';
import {cityPerspectiveAt,cityPerspectiveReach} from './CityPerspective.js';
import {blockPrimarySide} from './OrdinaryBlockArchitecture.js';

export const BLOCK_ROOF_KEY='ordinary-block-roofs-v3';
// Authored boundaries, not equal thirds: the generated middle row is shorter.
const CELLS=[[.002,.002,.496,.329],[.503,.002,.997,.329],[.002,.337,.496,.623],
 [.503,.339,.997,.622],[.002,.637,.495,.974],[.505,.637,.997,.974]];

export function blockRoofLayout(b){
 const profile=ordinaryBlockProfile(b);if(!profile)return null;
 const base=scaledBuildingHeight(b),inset=Math.min(metresToWorld(profile.insetMetres),b.w*.2,b.h*.2),rise=metresToWorld(profile.riseMetres);
 const terrace={x:b.x+inset,y:b.y+inset,w:b.w-inset*2,h:b.h-inset*2,z:base+rise};
 const occupied=[];
 if(profile.roof==='market')occupied.push({x:b.x+b.w*.24,y:b.y+b.h*.32,w:b.w*.52,h:b.h*.32});
 if(profile.roof==='terrace')occupied.push({x:b.x+b.w*.52,y:b.y+b.h*.53,w:metresToWorld(2.5),h:metresToWorld(2.1)});
 if(['sawtooth','gable'].includes(profile.roof))occupied.push({x:b.x+b.w*.23,y:b.y+b.h*.16,w:b.w*.54,h:b.h*.68});
 const layout={kind:profile.roof,base,inset,rise,terrace,occupied};
 for(const d of blockDormerLayouts(b,layout))occupied.push({x:b.x+d.x,y:b.y+d.y,w:d.w,h:d.h});
 return layout;
}

// Dormers face the actual frontage and reserve their footprint from roof equipment.
export function blockDormerLayouts(b,layout){
 if(layout.kind!=='mansard')return [];
 const side=blockPrimarySide(b),vertical=side==='east'||side==='west',length=vertical?b.h:b.w;
 const width=Math.min(metresToWorld(1.65),length*.3),depth=layout.inset*.66;
 const positions=length<150?[.5]:[.27,.73];
 return positions.map(u=>{
  const along=length*u-width/2;
  if(side==='north')return {u,side,x:along,y:layout.inset*.32,w:width,h:depth};
  if(side==='east')return {u,side,x:b.w-layout.inset*.98,y:along,w:depth,h:width};
  if(side==='west')return {u,side,x:layout.inset*.32,y:along,w:depth,h:width};
  return {u,side,x:along,y:b.h-layout.inset*.98,w:width,h:depth};
 });
}

export function blockRoofHeightAt(b,x,y){
 const roof=blockRoofLayout(b);if(!roof)return scaledBuildingHeight(b);
 const edge=Math.max(0,Math.min(x-b.x,b.x+b.w-x,y-b.y,b.y+b.h-y));
 return roof.base+roof.rise*Math.min(1,edge/roof.inset);
}

const point=(x,y,z)=>({x,y,z});
const mix=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
const at=(q,u,v)=>mix(mix(q[0],q[1],v),mix(q[3],q[2],v),u);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// Fixed geometry prepared once. Long surfaces repeat the authored material at a
// physical scale; small mesh cells also keep sloping textures straight in projection.
function surface(faces,q,cell,{tile=64,tint=0xffffff,stretch=false}={}){
 const width=Math.max(distance(q[0],q[3]),distance(q[1],q[2]));
 const height=Math.max(distance(q[0],q[1]),distance(q[3],q[2]));
 const flat=q.every(p=>p.z===q[0].z);
 const [u0,v0,u1,v1]=CELLS[cell];
 const tilesX=stretch?1:Math.max(1,Math.ceil(width/tile)),tilesY=stretch?1:Math.max(1,Math.ceil(height/tile));
 for(let ty=0;ty<tilesY;ty++)for(let tx=0;tx<tilesX;tx++){
  const left=tx/tilesX,right=(tx+1)/tilesX,top=ty/tilesY,bottom=(ty+1)/tilesY;
  // Horizontal planes project affinely and need no internal tessellation.
  const nx=flat?1:Math.max(1,Math.ceil(width/tilesX/24)),ny=flat?1:Math.max(1,Math.ceil(height/tilesY/24));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const a=left+(right-left)*x/nx,c=left+(right-left)*(x+1)/nx,d=top+(bottom-top)*y/ny,e=top+(bottom-top)*(y+1)/ny;
   const pts=[at(q,a,d),at(q,a,e),at(q,c,e),at(q,c,d)];
   faces.push({xyz:new Float64Array(pts.flatMap(p=>[p.x,p.y,p.z])),uv:[u0+(u1-u0)*x/nx,v0+(v1-v0)*y/ny,u0+(u1-u0)*(x+1)/nx,v0+(v1-v0)*(y+1)/ny],tint});
  }
 }
}

function boxPart(b,id,x,y,w,h,top,frontCell,bottomAt,roofCell=1,facing='south'){
 const faces=[],p=(dx,dy,z)=>point(x+dx,y+dy,z),bl=bottomAt(x,y+h),br=bottomAt(x+w,y+h),nl=bottomAt(x,y),nr=bottomAt(x+w,y);
 // Consistent outward winding allows projected back-face culling from any side.
 const wall=(q,side,tint)=>surface(faces,q,side===facing?frontCell:1,{tint,stretch:side===facing});
 wall([p(w,0,top),p(w,0,nr),p(0,0,nl),p(0,0,top)],'north',0x69717c);
 wall([p(0,0,top),p(0,0,nl),p(0,h,bl),p(0,h,top)],'west',0x8b939d);
 wall([p(w,h,top),p(w,h,br),p(w,0,nr),p(w,0,top)],'east',0x69717c);
 wall([p(0,h,top),p(0,h,bl),p(w,h,br),p(w,h,top)],'south',0xffffff);
 surface(faces,[p(0,0,top),p(0,h,top),p(w,h,top),p(w,0,top)],roofCell,{tint:0xb0b6c0});
 return {id,kind:frontCell===4?'dormer':'access',faces,maxHeight:top};
}

export function blockRoofModel(b){
 const roof=blockRoofLayout(b);if(!roof)return null;
 const {base,inset,rise,kind,terrace}=roof,top=base+rise,w=b.w,h=b.h,i=inset,faces=[];
 const a=point(0,0,base),c=point(w,0,base),d=point(w,h,base),e=point(0,h,base);
 const A=point(i,i,top),C=point(w-i,i,top),D=point(w-i,h-i,top),E=point(i,h-i,top);
 const cell=kind==='mansard'?0:1;
 const tile=cell===0?96:64;
 surface(faces,[a,A,C,c],cell,{tile,tint:0x717c8c});
 surface(faces,[e,E,A,a],cell,{tile,tint:0x8a94a3});
 surface(faces,[c,C,D,d],cell,{tile,tint:0x606c7c});
 // Quiet material: retain enough value to read the terrace.
 surface(faces,[A,E,D,C],2,{tile:160,tint:0x9aa6b6});
 surface(faces,[E,e,d,D],cell,{tile,tint:0xa0aabd});
 const parts=[{id:b.id+':roof-surface',kind:'surface',faces,maxHeight:top}];
 if(kind==='mansard')for(const d of blockDormerLayouts(b,roof)){
  parts.push(boxPart(b,b.id+':dormer-'+d.u,d.x,d.y,d.w,d.h,top+metresToWorld(.8),4,(x,y)=>blockRoofHeightAt(b,b.x+x,b.y+y),0,d.side));
 }
 if(kind==='market'){
  const r=roof.occupied[0],x=r.x-b.x,y=r.y-b.y,sw=r.w,sh=r.h,low=top+metresToWorld(.15),high=top+metresToWorld(1.25),glass=[];
  surface(glass,[point(x,y,low),point(x,y+sh/2,high),point(x+sw,y+sh/2,high),point(x+sw,y,low)],3,{stretch:true,tint:0x8c98a5});
  surface(glass,[point(x,y+sh/2,high),point(x,y+sh,low),point(x+sw,y+sh,low),point(x+sw,y+sh/2,high)],3,{stretch:true,tint:0xe2ded1});
  surface(glass,[point(x,y,low),point(x,y+sh,low),point(x,y+sh/2,high),point(x,y+sh/2,high)],1,{stretch:true,tint:0x8894a0});
  surface(glass,[point(x+sw,y+sh,low),point(x+sw,y,low),point(x+sw,y+sh/2,high),point(x+sw,y+sh/2,high)],1,{stretch:true,tint:0x626d7a});
  parts.push({id:b.id+':skylight',kind:'skylight',faces:glass,maxHeight:high});
 }
 const rails=[];
 if(kind==='sawtooth'||kind==='gable'){
  const r=roof.occupied[0],x=r.x-b.x,y=r.y-b.y,teeth=kind==='sawtooth'?Math.max(1,Math.min(3,Math.round(r.h/42))):1;
  const high=top+metresToWorld(kind==='sawtooth'?1.8:2.4),low=top+.5,step=r.h/teeth,pitched=[];
  for(let n=0;n<teeth;n++){
   const a=y+n*step,d=a+step,peak=kind==='sawtooth'?d-step*.14:a+step*.5;
   surface(pitched,[point(x,a,low),point(x,peak,high),point(x+r.w,peak,high),point(x+r.w,a,low)],1,{tile:72,tint:0xa2abb9});
   surface(pitched,[point(x,peak,high),point(x,d,low),point(x+r.w,d,low),point(x+r.w,peak,high)],kind==='sawtooth'?3:1,{tile:72,tint:0x727f91});
   surface(pitched,[point(x,a,low),point(x,d,low),point(x,peak,high),point(x,peak,high)],1,{stretch:true,tint:0x727c8a});
   surface(pitched,[point(x+r.w,d,low),point(x+r.w,a,low),point(x+r.w,peak,high),point(x+r.w,peak,high)],1,{stretch:true,tint:0x596674});
  }
  parts.push({id:b.id+':industrial-ridge',kind,faces:pitched,maxHeight:high});
 }
 if(kind==='terrace'){
  const r=roof.occupied[0];parts.push(boxPart(b,b.id+':roof-access',r.x-b.x,r.y-b.y,r.w,r.h,top+metresToWorld(2.6),5,()=>top));
  const base=terrace.z,height=metresToWorld(1.05),x=terrace.x,y=terrace.y,tw=terrace.w,th=terrace.h;
  for(const [rx,ry,length,vertical]of [[x+tw/2,y,tw,false],[x,y+th/2,th,true],[x+tw,y+th/2,th,true],
   [x+tw*.2,y+th,tw*.4,false],[x+tw*.8,y+th,tw*.4,false]])rails.push({x:rx,y:ry,w:length,h:1.8,base,height,vertical});
 }
 return {parts,rails,terrace};
}

export class BlockRoofPart extends (globalThis.Phaser?.GameObjects?.Image||class{}){
 constructor(scene,b,part){
  super(scene,b.x,b.y,BLOCK_ROOF_KEY);this.part=part;this.buildingId=b.id;this.projection={};this.screen=new Float64Array(8);
  this.setSize(b.w,b.h).setDepth(60+part.maxHeight*2+.1);scene.add.existing(this);
 }
 willRender(camera){
  if(!super.willRender(camera))return false;
  const v=camera.worldView,r=this.part.maxHeight*cityPerspectiveReach(this.scene.cityPerspective)+Math.max(this.width,this.height);
  return !v||this.x+r>=v.x&&this.x-r<=v.right&&this.y+r>=v.y&&this.y-r<=v.bottom;
 }
 renderWebGL(renderer,src,camera,parentMatrix){
  const m=Phaser.GameObjects.GetCalcMatrix(src,camera,parentMatrix).calc,cm=camera.matrix;
  const p=cityPerspectiveAt(src.x,src.y,camera,src.projection,src.scene.cityPerspective),s=src.screen;
  let pipe,unit,active=false;
  for(const face of src.part.faces){
   const q=face.xyz;
   for(let i=0;i<4;i++){
    const x=q[i*3],y=q[i*3+1],z=q[i*3+2],dx=(p.x+x*p.spreadX)*z,dy=(p.y+y*p.spreadY)*z;
    s[i*2]=m.getX(x,y)+cm.a*dx+cm.c*dy;s[i*2+1]=m.getY(x,y)+cm.b*dx+cm.d*dy;
   }
   const cross=(s[2]-s[0])*(s[5]-s[1])-(s[3]-s[1])*(s[4]-s[0]);
   if(cross>=-1e-6)continue;
   if(Math.max(s[0],s[2],s[4],s[6])<camera.x-2||Math.min(s[0],s[2],s[4],s[6])>camera.x+camera.width+2||
    Math.max(s[1],s[3],s[5],s[7])<camera.y-2||Math.min(s[1],s[3],s[5],s[7])>camera.y+camera.height+2)continue;
   if(!active){pipe=renderer.pipelines.set(src.pipeline,src);unit=pipe.setGameObject(src);camera.addToRenderList(src);pipe.manager.preBatch(src);active=true;}
   const t=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(face.tint,camera.alpha*src.alpha);
   pipe.batchQuad(src,...s,...face.uv,t,t,t,t,0,src.frame.glTexture,unit);
  }
  if(active)pipe.manager.postBatch(src);
 }
}
