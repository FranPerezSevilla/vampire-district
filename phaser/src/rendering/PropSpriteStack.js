import {cityPerspectiveAt,CITY_PERSPECTIVE_MAX} from './CityPerspective.js';

export const PROP_STACK_KEY='street-stack-v1';
// Crops in the authored 1254px atlas; materials use interior surface areas so
// repeated wall faces do not acquire a bright picture-frame border.
export const PROP_STACK_BOUNDS=[[40,66,260,180],[374,65,201,193],[725,14,121,293],[949,104,282,122],
 [38,317,247,290],[352,350,239,234],[648,342,269,251],[953,384,269,185],
 [20,685,300,221],[349,650,244,244],[703,625,164,294],[953,645,257,254],
 [45,949,252,282],[365,976,214,214],[645,945,282,266],[950,1035,278,95]];
export const canStackProps=scene=>Boolean(scene?.game?.renderer?.gl&&scene.textures?.exists(PROP_STACK_KEY));

// Authored assemblies: coordinates are ground dimensions and physical heights.
// All geometry is prepared once; the render path only projects and batches it.
export function propStackModel(kind,{w=30,h=12,height=16,base=0,broken=false,vertical=false}={}) {
 const layers=[];
 const quad=(frame,q,z,tint=0xffffff,normalX=0,normalY=0)=>layers.push({frame,q:new Float32Array(q),z:new Float32Array(Array.isArray(z)?z:[z,z,z,z]),tint,normalX,normalY});
 const top=(frame,x,y,width,depth,z,tint=0xffffff)=>quad(frame,[x-width/2,y-depth/2,x-width/2,y+depth/2,x+width/2,y+depth/2,x+width/2,y-depth/2],z,tint);
 const front=(frame,x,y,width,lo,hi,tint=0xffffff,back=false)=>quad(frame,[x-width/2,y,x-width/2,y,x+width/2,y,x+width/2,y],[hi,lo,lo,hi],tint,0,back?-1:1);
 const side=(frame,x,y,depth,lo,hi,tint=0xa6ada5,left=false)=>quad(frame,[x,y-depth/2,x,y-depth/2,x,y+depth/2,x,y+depth/2],[hi,lo,lo,hi],tint,left?-1:1,0);
 const box=(frame,x,y,width,depth,lo,hi,tint=0xffffff)=>{
  front(frame,x,y-depth/2,width,lo,hi,tint,true);side(frame,x-width/2,y,depth,lo,hi,tint,true);
  side(frame,x+width/2,y,depth,lo,hi,tint);front(frame,x,y+depth/2,width,lo,hi,tint);top(frame,x,y,width,depth,hi,tint);
 };
 if(kind==='lamp'){
  box(1,0,0,7,7,0,3);box(0,0,0,3,3,3,height-9);
  box(1,0,0,5,5,height-12,height-9);box(2,0,0,7,7,height-9,height-2);
  top(1,0,0,9,9,height-1);top(1,0,0,6,6,height);top(1,0,0,3,3,height+2);
 }else if(kind==='pew'){
  // Solid carved ends and back: church furniture, not a municipal slatted bench.
  for(const x of [-w*.46,w*.46])box(10,x,0,w*.065,h,0,17);
  box(9,0,-h*.4,w*.88,1.8,5,16);
  top(9,0,0,w*.91,h*.78,6.8);
  box(9,0,h*.35,w*.84,1.3,1.8,3.3);
 }else if(kind==='bench'){
  const wood=3;
  for(const x of [-w*.43,w*.43]){
   box(4,x,0,3,h,0,7);
   box(0,x,-h*.35,3,3,7,14);
  }
  for(let i=0;i<3;i++)top(wood,0,-h*.25+i*h*.26,w,h*.24,7.2);
  for(const z of [10,13])box(wood,0,-h*.4,w,1.7,z-1,z+1);
 }else if(kind==='dumpster'){
  for(const x of [-w*.34,w*.34])for(const y of [-h*.34,h*.34])box(0,x,y,3,3,0,2,0x484846);
  box(7,0,0,w,h,2,height-1);top(5,0,0,w,h,height-1,0x667369);
  if(broken){front(8,w*.22,-h*.22,w,height-3,height+9);top(8,w*.45,h*.4,w*.8,h*.8,2);}
  else top(6,0,0,w+1,h+1,height);
 }else if(kind==='pier'){
  // A cruciform stone pier with engaged shafts, all using the same masonry.
  box(11,0,0,w,h,0,2.5);
  box(11,0,0,w*.76,h*.76,2.5,5);
  box(11,0,0,w*.58,h*.58,5,height-4);
  for(const [x,y] of [[-w*.30,0],[w*.30,0],[0,-h*.30],[0,h*.30]])
   box(11,x,y,w*.23,h*.23,5,height-3);
  box(11,0,0,w*.86,h*.86,height-3,height);
 }else if(kind==='altar'){
  box(11,0,0,w*.9,h*.85,0,height-2);box(11,0,0,w,h,height-2,height);
  top(12,0,0,w+1,h+1,height+.2);
 }else if(kind==='candle'){
  box(1,0,0,5,5,0,2);box(0,0,0,1.8,1.8,2,height-3);
  top(13,0,0,5,5,height);top(13,0,0,2,2,height+2);
 }else if(kind==='fence'){
  const count=Math.ceil(w/28),step=w/count;
  for(let i=0;i<count;i++){
   const x=-w/2+step*(i+.5);
   // Double-sided ironwork is a vertical sprite; cap/posts retain a true footprint.
   quad(14,[x-step/2,0,x-step/2,0,x+step/2,0,x+step/2,0],[base+height,base,base,base+height],0xa4b0a5);
  }
  for(let i=0;i<=count;i++)box(0,-w/2+step*i,0,1.7,1.7,base,base+height+1);
  top(15,0,0,w,1.8,base+height);
 }
 if(vertical)for(const l of layers){for(let i=0;i<8;i+=2){const x=l.q[i];l.q[i]=-l.q[i+1];l.q[i+1]=x;}const x=l.normalX;l.normalX=-l.normalY;l.normalY=x;}
 layers.sort((a,b)=>Math.max(...a.z)-Math.max(...b.z));
 return {kind,layers,radius:Math.max(w,h)/2+(height+base+3)*1.65+12,maxHeight:height+base+3};
}

export class PropSpriteStack extends (globalThis.Phaser?.GameObjects?.Image||class{}) {
 constructor(scene,x,y,kind,options={},host=null){
  const texture=scene.textures.get(PROP_STACK_KEY);
  if(!texture.has('prop-0'))for(let i=0;i<PROP_STACK_BOUNDS.length;i++){
   const [x,y,w,h]=PROP_STACK_BOUNDS[i];texture.add('prop-'+i,0,x,y,w,h);
  }
  super(scene,x,y,PROP_STACK_KEY,'prop-0');
  this.model=propStackModel(kind,options);this.kind=kind;this.options=options;this.host=host||this;
  this.frames=PROP_STACK_BOUNDS.map((_,i)=>texture.get('prop-'+i));this.projection={x:0,y:0};this.screenCorners=new Float32Array(8);
  this.setSize(Math.max(1,options.w||8),Math.max(1,options.h||8));scene.add.existing(this);
 }
 setBroken(broken){this.options={...this.options,broken};this.model=propStackModel(this.kind,this.options);return this;}
 willRender(camera){
  if(!super.willRender(camera)||this.scene.currentLayer>0)return false;
  const v=camera.worldView,r=this.model.radius+this.model.maxHeight*1.65*(CITY_PERSPECTIVE_MAX-1),x=this.host.x,y=this.host.y;
  return !v||x+r>=v.x&&x-r<=v.x+v.width&&y+r>=v.y&&y-r<=v.y+v.height;
 }
 renderWebGL(renderer,src,camera,parentMatrix){
  const m=Phaser.GameObjects.GetCalcMatrix(src,camera,parentMatrix).calc,cm=camera.matrix;
  const r=src.host.rotation||0,rc=Math.cos(r),rs=Math.sin(r),p=src.buildingProjection;
  const o=src.projection;
  if(p){o.x=(p.x+(src.host.x-p.cx)*p.spreadX)/p.height;o.y=(p.y+(src.host.y-p.cy)*p.spreadY)/p.height;o.spreadX=p.spreadX/p.height;o.spreadY=p.spreadY/p.height;}
  else cityPerspectiveAt(src.host.x,src.host.y,camera,o,src.scene.cityPerspective);
  const scale=parentMatrix?Math.sqrt(Math.abs(parentMatrix.a*parentMatrix.d-parentMatrix.b*parentMatrix.c)):1;
  const ox=(cm.a*o.x+cm.c*o.y)*scale,oy=(cm.b*o.x+cm.d*o.y)*scale;
  const pipe=renderer.pipelines.set(src.pipeline,src),unit=pipe.setGameObject(src),texture=src.frame.glTexture;
  const tint=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
  camera.addToRenderList(src);pipe.manager.preBatch(src);
  for(const l of src.model.layers){
   if(l.normalX||l.normalY){const nx=l.normalX*rc-l.normalY*rs,ny=l.normalX*rs+l.normalY*rc;if(nx*o.x+ny*o.y>=0)continue;}
   const q=l.q,h=l.z,f=src.frames[l.frame],t=tint(l.tint,camera.alpha*src.alpha);
   const sx=o.spreadX,sy=o.spreadY;
   const screen=src.screenCorners;
   for(let i=0;i<4;i++){
    const x=(q[i*2]*rc-q[i*2+1]*rs)*scale,y=(q[i*2]*rs+q[i*2+1]*rc)*scale;
    screen[i*2]=m.getX(q[i*2],q[i*2+1])+ox*h[i]+(cm.a*sx*x+cm.c*sy*y)*h[i];
    screen[i*2+1]=m.getY(q[i*2],q[i*2+1])+oy*h[i]+(cm.b*sx*x+cm.d*sy*y)*h[i];
   }
   pipe.batchQuad(src,...screen,f.u0,f.v0,f.u1,f.v1,t,t,t,t,0,texture,unit);
  }
  pipe.manager.postBatch(src);
 }
}
