import { bakeCathedralFacade } from './CathedralArchitecture.js';
import {ordinaryMaterialsReady,bakeOrdinaryFacade,bakeOrdinaryRoof} from './OrdinaryBuildingMaterials.js';
import {gradeNightCanvas} from './NightPalette.js';
import { bakeVesperFacade } from './VesperArchitecture.js';
import { bakePoliceFacade } from './PoliceArchitecture.js';
import { CachedWarmLights } from './CachedWarmLights.js';
import { HOSPITAL_LAYBY } from '../data/hospital-access.js';
import { WORLD_SCALE, metresToWorld, scaledBuildingHeight } from './WorldScale.js';
import { buildingEntrances, entrancePosition } from './BuildingEntrances.js';
import { drawLancet, drawPortal } from './ArchitecturalOpenings.js';
import { architectureFor, architectureBays } from './ArchitecturalProfiles.js';
import { paintFacadeDetail } from './UrbanMaterialDetail.js';
import { paintLandmarkRoof, buildingMaterial } from './BuildingIdentity.js';

const css = color => `#${color.toString(16).padStart(6,'0')}`;
// Canvas adapter is used only when a building enters the resident render set.
function painter(ctx) {
 const g={
  fillStyle(color,alpha=1){ctx.fillStyle=css(color);ctx.globalAlpha=alpha;return g;},
  fillRect(...a){ctx.fillRect(...a);return g;},
  fillPoints(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();return g;},
  lineStyle(width,color,alpha=1){ctx.lineWidth=width;ctx.strokeStyle=css(color);ctx.globalAlpha=alpha;return g;},
  lineBetween(x,y,a,b){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();return g;}
 };return g;
}

export function facadePoint(corners,u,v){
 const [tl,bl,br,tr]=corners;
 const left={x:tl.x+(bl.x-tl.x)*v,y:tl.y+(bl.y-tl.y)*v};
 const right={x:tr.x+(br.x-tr.x)*v,y:tr.y+(br.y-tr.y)*v};
 return {x:left.x+(right.x-left.x)*u,y:left.y+(right.y-left.y)*u};
}

// Affine mapping of an upright alpha triangle; slate rows do not collapse at its apex.
export function triangleMaterialCorners([a,b,tip]){
 const dx=(b.x-a.x)/2,dy=(b.y-a.y)/2;
 return [{x:tip.x-dx,y:tip.y-dy},a,b,{x:tip.x+dx,y:tip.y+dy}];
}

// Bilinear-to-triangle interpolation error is at most |cross term| / (4*n*n).
// Screen-space tolerance keeps straight openings stable without an 8-column minimum.
export function facadeMeshDivisions(crossX,crossY,tolerance=.35){
 return Math.max(1,Math.ceil(Math.sqrt(Math.hypot(crossX,crossY)/(4*tolerance))));
}

export function projectedQuadVisible(camera, ax, ay, bx, by, cx, cy, dx, dy) {
 // Coordinates already include camera zoom, rotation, viewport and parent transforms.
 // Bilinear surface and all its triangles stay inside the four-corner bounds.
 if (!Number.isFinite(camera.width) || !Number.isFinite(camera.height)) return true;
 const padding=4, x=camera.x||0, y=camera.y||0;
 return Math.max(ax,bx,cx,dx)>=x-padding && Math.min(ax,bx,cx,dx)<=x+camera.width+padding
  && Math.max(ay,by,cy,dy)>=y-padding && Math.min(ay,by,cy,dy)<=y+camera.height+padding;
}

export class MaterialQuad extends (globalThis.Phaser?.GameObjects?.Image || class {}) {
 constructor(scene,key){super(scene,0,0,key);this.corners=[];scene.add.existing(this);}
 renderWebGL(renderer,src,camera,parentMatrix){
  if(src.corners.length!==4)return;
  const m=Phaser.GameObjects.GetCalcMatrix(src,camera,parentMatrix).calc;

  // A trapezoid is not an affine quad: one diagonal produces visibly bent windows.
  // Subdivide both axes: full-width strips still kink tall window edges.
  const [tl,bl,br,tr]=src.corners;
  const ax=m.getX(tl.x,tl.y),ay=m.getY(tl.x,tl.y),bx=m.getX(bl.x,bl.y),by=m.getY(bl.x,bl.y);
  const cx=m.getX(br.x,br.y),cy=m.getY(br.x,br.y),dx=m.getX(tr.x,tr.y),dy=m.getY(tr.x,tr.y);
  if(!projectedQuadVisible(camera,ax,ay,bx,by,cx,cy,dx,dy))return;
  camera.addToRenderList(src);
  const p=renderer.pipelines.set(src.pipeline,src);
  const tint=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(src.tintTopLeft,camera.alpha*src.alpha);
  const unit=p.setGameObject(src);
  p.manager.preBatch(src);
  const subdivisions=src.adaptiveMesh?facadeMeshDivisions(ax-bx+cx-dx,ay-by+cy-dy):src.subdivisions||8;
  const rowCount=src.adaptiveMesh?subdivisions:Math.max(1,Math.ceil(subdivisions*((src.vEnd??1)-(src.vStart||0))));
  for(let row=0;row<rowCount;row++){
   const v0=row/rowCount,v1=(row+1)/rowCount;
   const lx=ax+(bx-ax)*v0,ly=ay+(by-ay)*v0,rx=dx+(cx-dx)*v0,ry=dy+(cy-dy)*v0;
   const nx=ax+(bx-ax)*v1,ny=ay+(by-ay)*v1,sx=dx+(cx-dx)*v1,sy=dy+(cy-dy)*v1;
   // Scalar coordinates avoid temporary point/array allocations per cell and frame.
   for(let col=0;col<subdivisions;col++){
    const u0=col/subdivisions,u1=(col+1)/subdivisions;
    p.batchQuad(src,lx+(rx-lx)*u0,ly+(ry-ly)*u0,nx+(sx-nx)*u0,ny+(sy-ny)*u0,
     nx+(sx-nx)*u1,ny+(sy-ny)*u1,lx+(rx-lx)*u1,ly+(ry-ly)*u1,
     (src.uStart||0)+u0*((src.uEnd??1)-(src.uStart||0)),(src.vStart||0)+v0*((src.vEnd??1)-(src.vStart||0)),(src.uStart||0)+u1*((src.uEnd??1)-(src.uStart||0)),(src.vStart||0)+v1*((src.vEnd??1)-(src.vStart||0)),tint,tint,tint,tint,0,src.frame.glTexture,unit);
   }
  }
  p.manager.postBatch(src);
 }
}

// Shared warm emitter, baked only when a resident facade is prepared.
function warmGlow(ctx,x,y,rx,ry,strength=.35){
 ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
 const glow=ctx.createRadialGradient(0,0,0,0,0,1);
 glow.addColorStop(0,`rgba(255,211,143,${strength})`);
 glow.addColorStop(.35,`rgba(230,158,75,${strength*.45})`);
 glow.addColorStop(1,'rgba(214,133,59,0)');
 ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
}

export class BuildingMaterialImages {
 constructor(scene){this.scene=scene;this.serial=0;this.patterns=new Map();this.warmLights=new CachedWarmLights();}
 pattern(key){
  if(this.patterns.has(key))return this.patterns.get(key);
  const source=this.scene.textures.get(key).getSourceImage();
  const size=key==='slate-gothic'?64:256;
  const tile=document.createElement('canvas');tile.width=size;tile.height=size;
  const c=tile.getContext('2d');c.filter='grayscale(1)';
  // Mirrored repeat guarantees matching edges, including imperfect source borders.
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   c.save();c.translate(x?size:0,y?size:0);c.scale(x?-1:1,y?-1:1);c.drawImage(source,0,0,size/2,size/2);c.restore();
  }
  this.patterns.set(key,tile);return tile;
 }
 canvas(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
 register(canvas){const key=`building-material-${this.scene.sys.settings.key}-${this.serial++}`;this.scene.textures.addImage(key,canvas);return key;}
 facade(b,length,horizontal){
  const result=this.bakeFacade(b,length,horizontal);
  const base=this.scene.textures.get(result.key);
  if(!result.authoredNight)gradeNightCanvas(base.getSourceImage());
  // Front faces and their static glow have identical projection, normal blending
  // and white tint. Composite once, rather than submit two meshes every frame.
  // Side faces retain their separate untinted light layer.
  if(horizontal&&result.lightKey){
   const texture=this.scene.textures.get(result.key),canvas=texture.getSourceImage();
   const light=this.scene.textures.get(result.lightKey).getSourceImage();
   const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.9;ctx.globalCompositeOperation='lighter';ctx.drawImage(light,0,0,canvas.width,canvas.height);ctx.restore();
   this.scene.textures.remove(result.lightKey);result.lightKey=null;
  }
  base.source[0].update();
  return result;
 }
 bakeFacade(b,length,horizontal){
  if(ordinaryMaterialsReady(this.scene,b))return bakeOrdinaryFacade(this,b,length);
  if(b.cathedralKind)return bakeCathedralFacade(this,b,length);
  if(b.dormer){
   const canvas=this.canvas(96,112),ctx=canvas.getContext('2d');
   if(b.facadeSide==='south')ctx.drawImage(this.scene.textures.get('vesper-dormer').getSourceImage(),0,0,96,112);
   else {ctx.fillStyle=ctx.createPattern(this.pattern('stone-gothic'),'repeat');ctx.fillRect(0,0,96,112);ctx.fillStyle='rgba(22,24,28,.5)';ctx.fillRect(0,0,96,112);}
   return {key:this.register(canvas),lightKey:null};
  }
  if(b.siteId==='club-site'&&!b.campusBarrier)return bakeVesperFacade(this,b,length);
  if(b.family==='police-campus'&&!b.campusBarrier)return bakePoliceFacade(this,b,length);
  if(b.campusBarrier){
   const canvas=this.canvas(Math.max(32,Math.ceil(length*2)),128),ctx=canvas.getContext('2d');
   if(b.campusBarrier==='railing'||b.campusBarrier==='gate'){
    const fence=this.scene.textures.get(b.fenceMaterial||'police-fence').getSourceImage();
    for(let x=0;x<canvas.width;x+=384)ctx.drawImage(fence,x,0,384,128);
    if(b.campusBarrier==='fence'){ctx.fillStyle='#303633';ctx.fillRect(0,102,canvas.width,26);}
   }else{
    const stone=this.scene.textures.get('police-facade').getSourceImage();
    for(let x=0;x<canvas.width;x+=220)ctx.drawImage(stone,0,stone.height*.9,stone.width,stone.height*.1,x,0,220,128);
    ctx.fillStyle='rgba(15,22,25,.45)';ctx.fillRect(0,0,canvas.width,128);
    ctx.fillStyle='#60615a';ctx.fillRect(0,0,canvas.width,6);
   }
   return {key:this.register(canvas),lightKey:null};
  }
  const institutional=architectureFor(b).cornerButtresses;
  const width=Math.max(64,Math.min(institutional?1536:1024,Math.ceil(length*(institutional?3:2)))),height=institutional?512:b.skyline?384:256;
  const profile=architectureFor(b);
  const canvas=this.canvas(width,height),ctx=canvas.getContext('2d'),m=buildingMaterial(b);
  ctx.fillStyle=ctx.createPattern(this.pattern('stone-gothic'),'repeat');ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation='multiply';ctx.fillStyle='#a19d8d';ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='rgba(34,40,36,.22)';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(0,height);ctx.scale(width/length,height/96);
  const g=painter(ctx);
  g.paintOpening=q=>drawLancet(ctx,(q.u-q.w*.12)*length,-(q.v+q.h)*96,q.w*1.24*length,q.h*96,q.lit);
  g.paintPortal=(u,w)=>{if(b.id==='hospital'&&b.facadeSide==='south')return;const h=Math.min(.8,metresToWorld(WORLD_SCALE.doorMetres)/scaledBuildingHeight(b));drawPortal(ctx,(u-w*.45)*length,-(h+.02)*96,w*1.9*length,h*96,profile.medical);};
  g.paintStone=(u,v,w,h)=>{ctx.save();ctx.globalAlpha=.75;ctx.fillStyle=ctx.createPattern(this.pattern('stone-gothic'),'repeat');ctx.fillRect(u*length,-(v+h)*96,w*length,h*96);ctx.restore();};
  paintFacadeDetail(g,{...b,materialSide:!horizontal}, {x:0,y:0},{x:length,y:0},{x:0,y:-96},m);
  ctx.restore();ctx.globalAlpha=1;
  if(profile.medical){
   // Low masonry plinth and sparse damp patches, not another floor-wide cornice.
   ctx.fillStyle='rgba(13,23,19,.32)';ctx.fillRect(0,height*.945,width,height*.055);
   for(let i=0;i<9;i++){const x=((profile.seed+i*83)%997)/997*width,r=9+(i%3)*7;
    const damp=ctx.createRadialGradient(x,height,0,x,height,r);damp.addColorStop(0,'rgba(10,22,17,.36)');damp.addColorStop(1,'rgba(10,22,17,0)');ctx.fillStyle=damp;ctx.fillRect(x-r,height-r,r*2,r);
   }
  }
  const shadow=ctx.createLinearGradient(0,0,0,height);
  shadow.addColorStop(0,'rgba(0,0,0,.48)');shadow.addColorStop(.055,'rgba(0,0,0,0)');shadow.addColorStop(.7,'rgba(0,0,0,.05)');shadow.addColorStop(1,'rgba(0,0,0,.22)');
  ctx.fillStyle=shadow;ctx.fillRect(0,0,width,height);
  if(profile.base!=='shutter'&&horizontal&&!b.cornerTurret){
   for(const u of [.18,.82]){ctx.fillStyle='#30372e';ctx.fillRect(width*u-4,height*.745,8,12);ctx.fillStyle='#d7bd85';ctx.fillRect(width*u-2,height*.75,4,7);}
  }
  if(profile.sign&&horizontal){
   const x=width*.28,y=height*.045,w=width*.44,h=height*.24;
   ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(x-5,y+7,w+14,h+5);
   ctx.fillStyle='#454941';ctx.fillRect(x-6,y-3,w+12,h+6);
   ctx.fillStyle='#8c8672';ctx.fillRect(x-8,y-5,w+16,4);
   ctx.fillStyle='#202722';ctx.fillRect(x-8,y+h,w+16,5);
   const metal=ctx.createLinearGradient(0,y,0,y+h);metal.addColorStop(0,'#343b35');metal.addColorStop(.35,'#1e2623');metal.addColorStop(1,'#101917');
   ctx.fillStyle=metal;ctx.fillRect(x,y,w,h);
   ctx.strokeStyle='#6f6855';ctx.lineWidth=2;ctx.strokeRect(x+4,y+4,w-8,h-8);
   ctx.strokeStyle='#383f35';ctx.lineWidth=1;ctx.strokeRect(x+7,y+7,w-14,h-14);
   for(const px of [x+10,x+w-10])for(const py of [y+10,y+h-10]){ctx.fillStyle='#a59a78';ctx.fillRect(px,py,2,2);}

   ctx.fillStyle=profile.medical?'#873a3c':'#8b805f';
   if(profile.medical){ctx.fillRect(x+w*.045,y+h*.39,w*.105,h*.22);ctx.fillRect(x+w*.08,y+h*.20,w*.035,h*.6);}
   else {ctx.beginPath();ctx.moveTo(x+w*.06,y+h*.24);ctx.lineTo(x+w*.14,y+h*.24);ctx.lineTo(x+w*.14,y+h*.58);ctx.lineTo(x+w*.10,y+h*.77);ctx.lineTo(x+w*.06,y+h*.58);ctx.closePath();ctx.fill();}
   ctx.fillStyle='#c6c2a8';ctx.font=`bold ${Math.floor(h*.43)}px Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.shadowColor='rgba(0,0,0,.95)';ctx.shadowBlur=0;ctx.shadowOffsetY=2;
   ctx.fillText(profile.sign,x+w*.58,y+h*.53,w*.72);
   ctx.shadowOffsetY=0;ctx.shadowColor='rgba(225,180,98,.32)';ctx.shadowBlur=5;
   ctx.fillText(profile.sign,x+w*.58,y+h*.53,w*.72);ctx.shadowBlur=0;

  }
  if(b.id==='hospital'&&b.facadeSide==='south'){
   const source=this.scene.textures.get('hospital-entrance').getSourceImage();
   const aw=72/length*width,ah=54/scaledBuildingHeight(b)*height;
   ctx.drawImage(source,(width-aw)/2,height-ah,aw,ah);
  }
  if((b.id==='hospital'&&b.facadeSide==='south')||(b.id==='hospitalEmergency'&&b.facadeSide==='east')){
   const source=this.scene.textures.get('hospital-wall-service').getSourceImage();
   const ah=height*.58,aw=22/length*width;
   ctx.drawImage(source,width*.77,height-ah,aw,ah);
  }
  return {key:this.register(canvas),lightKey:this.facadeLights(b,length,horizontal,width,height)};
 }
 facadeLights(b,length,horizontal,width,height){
  if(b.cornerTurret)return null;
  const hospital=b.id==='hospital'&&b.facadeSide==='south';
  const profile=architectureFor(b),canvas=this.canvas(Math.ceil(width/(hospital?2:4)),Math.ceil(height/(hospital?2:4))),ctx=canvas.getContext('2d');
  ctx.scale(canvas.width/width,canvas.height/height);
  // Cached transparent light layer, independent of masonry and crisp openings.
  for(const q of architectureBays(b,length).bays){
   if(!q.lit || (profile.sign&&horizontal&&q.v+q.h>.72&&q.u<.78&&q.u+q.w>.22))continue;
   const x=(q.u+q.w*.5)*width,y=(1-q.v-q.h*.43)*height;
   const rx=Math.max(7,q.w*width*1.3),ry=q.h*height*.9;
   if(hospital)this.warmLights.draw(ctx,'halo',x,y,rx*.78,ry*.8,.16);
   else warmGlow(ctx,x,y,rx,ry,.42);
  }
  if(profile.base!=='shutter'&&horizontal){
   const authored=buildingEntrances(b);
   const doors=authored.length?authored.filter(d=>d.side===(b.facadeSide||'south')):profile.medical?[{at:.5}]:[];
   for(const door of doors){
    if(hospital){
     const h=scaledBuildingHeight(b),doorY=height*(1-22/h);
     this.warmLights.draw(ctx,'halo',width*door.at,doorY,26/length*width,20/h*height,.17);
     this.warmLights.draw(ctx,'beam',width*door.at,doorY,24/length*width,22/h*height,.19);
    }else warmGlow(ctx,width*door.at,height*.82,height*.26,height*.32,.43);
   }
   for(const u of [.18,.82]){
    if(hospital){
     this.warmLights.draw(ctx,'beam',width*u,height*.764,18/length*width,height*.23,.28);
     this.warmLights.draw(ctx,'halo',width*u,height*.757,5/length*width,height*.045,.48);
    }else warmGlow(ctx,width*u,height*.76,height*.23,height*.28,.26);
   }
  }
  return this.register(canvas);
 }
 groundContact(b){
  const campus=b.id==='hospital',pad=campus?90:32,canvas=this.canvas(b.w+pad*2+(campus?80:0),b.h+pad*2+(campus?180:0)),ctx=canvas.getContext('2d');
  ctx.translate(pad,pad);
  if(campus){
   const court=this.scene.textures.get('hospital-forecourt').getSourceImage();
   // Reuse only the narrow clear walkway, never the baked forecourt scene.
   ctx.drawImage(court,court.width*.468,0,court.width*.063,court.height*.44,
    484-b.x,580-b.y,32,110);
   const bay=HOSPITAL_LAYBY.parking;
   ctx.drawImage(this.scene.textures.get('hospital-parking').getSourceImage(),bay.x-b.x,bay.y-b.y,bay.w,bay.h);
   if(!this.scene.textures.exists('street-stack-v1')||!this.scene.game?.renderer?.gl)ctx.drawImage(this.scene.textures.get('street-bench-clean').getSourceImage(),355-b.x,601-b.y,75,20);
   // Ground decals share the pavement exposure; subsequent light stamps remain
   // emissive. Grade once before any warm entrance light is composited.
   gradeNightCanvas(canvas);
  }
  // Soft contact stays attached to the fixed footprint, not the displaced roof.
  for(const [x,y,angle,length] of [[0,0,Math.PI/2,b.h],[b.w,b.h,-Math.PI/2,b.h],[b.w,0,Math.PI,b.w],[0,b.h,0,b.w]]){
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);
   const shade=ctx.createLinearGradient(0,0,0,9);shade.addColorStop(0,'rgba(8,15,12,.45)');shade.addColorStop(1,'rgba(8,15,12,0)');
   ctx.fillStyle=shade;ctx.fillRect(0,0,length,9);ctx.restore();
  }
  for(const door of buildingEntrances(b)){
   const p=entrancePosition(b,door);
   ctx.save();ctx.translate(p.x-b.x,p.y-b.y);ctx.rotate(Math.atan2(-p.nx,p.ny));
   if(campus){
    this.warmLights.draw(ctx,'beam',0,2,23,43,.19);
    this.warmLights.draw(ctx,'halo',0,5,17,8,.20);
   }else warmGlow(ctx,0,12,27,21,.29);
   ctx.fillStyle='#252e29';ctx.fillRect(-11,0,22,5);
   ctx.fillStyle='#555c4f';ctx.fillRect(-10,0,20,3);
   ctx.fillStyle='#898771';ctx.fillRect(-10,2,20,.6);
   ctx.restore();
  }
  if(campus)for(const u of [.18,.82]){
   this.warmLights.draw(ctx,'halo',b.w*u,b.h+7,21,10,.16);
  }
  return {key:this.register(canvas),pad};
 }
 roof(b,attachments=[]){
  if(ordinaryMaterialsReady(this.scene,b))return bakeOrdinaryRoof(this,b);
  const canvas=this.canvas(b.w*2,b.h*2),ctx=canvas.getContext('2d');ctx.scale(2,2);
  const g=painter(ctx);
  g.fillMaterialPattern=(x,y,w,h)=>{ctx.save();ctx.globalAlpha=.42;ctx.globalCompositeOperation='soft-light';ctx.fillStyle=ctx.createPattern(this.pattern('slate-gothic'),'repeat');ctx.fillRect(x,y,w,h);ctx.restore();};
  if(b.cathedralKind==='buttress'){
   const stone=this.scene.textures.get('cathedral-facade').getSourceImage();ctx.drawImage(stone,stone.width/2,stone.height/2,stone.width/2,stone.height/2,0,0,b.w,b.h);
  }else if(b.cathedralKind){ctx.drawImage(this.scene.textures.get('cathedral-roof').getSourceImage(),0,0,b.w,b.h);}
  else if(b.dormer){ctx.drawImage(this.scene.textures.get('vesper-mansard').getSourceImage(),330,70,100,100,0,0,b.w,b.h);}
  else if(b.siteId==='club-site'&&!b.campusBarrier){
   const image=this.scene.textures.get(b.roofForm==='mansard'?'vesper-mansard':'vesper-roof').getSourceImage();
   ctx.drawImage(image,0,0,b.w,b.h);
  }else if(b.family==='police-campus'&&b.campusBarrier){
   // Reuse the authored stone parapet strip, at a fixed world scale.
   const image=this.scene.textures.get('police-roof').getSourceImage(),horizontal=b.w>=b.h;
   ctx.save();if(!horizontal){ctx.translate(b.w,0);ctx.rotate(Math.PI/2);}
   const length=horizontal?b.w:b.h,depth=horizontal?b.h:b.w;
   for(let x=0;x<length;x+=32){const width=Math.min(32,length-x);ctx.drawImage(image,image.width*.12,0,image.width*.76*width/32,image.height*.06,x,0,width,depth);}
   ctx.fillStyle='rgba(10,15,17,.35)';ctx.fillRect(0,0,length,depth);
   ctx.fillStyle='#858174';ctx.fillRect(0,1,length,.7);
   ctx.fillStyle='#111719';ctx.fillRect(0,depth-1.5,length,1.5);
   ctx.restore();
  }else if(b.family==='police-campus')ctx.drawImage(this.scene.textures.get('police-roof').getSourceImage(),0,0,b.w,b.h);
  else if(b.id==='hospital')ctx.drawImage(this.scene.textures.get('hospital-roof-slate').getSourceImage(),0,0,b.w,b.h);
  else paintLandmarkRoof(g,{...b,x:0,y:0});
  if(b.id==='hospital')ctx.drawImage(this.scene.textures.get('hospital-roof-service').getSourceImage(),b.w*.28,b.h*.39,b.w*.42,b.h*.2);
  ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=1;
  for(const part of attachments.filter(p=>!p.roofTier&&!p.dormer))ctx.fillRect(part.x-b.x,part.y-b.y,part.w,part.h);
  return this.register(canvas);
 }
 turretMaterials(){
  if(this.turretKeys)return this.turretKeys;
  const wall=this.canvas(128,192),c=wall.getContext('2d');
  c.fillStyle=c.createPattern(this.pattern('stone-gothic'),'repeat');c.fillRect(0,0,128,192);
  drawLancet(c,35,27,58,143);
  const slate=this.canvas(256,256);slate.getContext('2d').drawImage(this.scene.textures.get('hospital-turret-slate').getSourceImage(),0,0,256,256);
  this.turretKeys={stone:this.register(wall),slate:this.register(slate)};return this.turretKeys;
 }
 destroy(){this.warmLights.destroy();if(this.turretKeys)for(const key of Object.values(this.turretKeys))this.scene.textures.remove(key);this.turretKeys=null;}
 destroyEntry(e){e.groundImage?.destroy();if(e.groundKey)this.scene.textures.remove(e.groundKey);for(const q of [...(e.pinnacleQuads||[]),...(e.cathedralRoofQuads||[])])q.destroy();for(const face of e.faces||[]){for(const q of face.quads)q.destroy();for(const q of face.lightQuads||[])q.destroy();this.scene.textures.remove(face.key);if(face.lightKey)this.scene.textures.remove(face.lightKey);}if(e.roofKey)this.scene.textures.remove(e.roofKey);}
}
