import {ProjectedStreetLamps} from './ProjectedStreetLamps.js';
import { attachedTurrets } from './CornerTurrets.js';
import { scaledBuildingHeight, perspectiveLimit, viewportPerspectiveLimit } from './WorldScale.js';
import { exposedWallSpans } from './AttachedVolumeUnion.js';
import {landmarkGroups,updateFrontage} from './LandmarkFrontage.js';
import { createPinnacleModel, paintRoofPinnacles } from './ArchitecturalPinnacles.js';
import { BuildingMaterialImages, MaterialQuad, triangleMaterialCorners } from './BuildingMaterialImages.js';
import { paintFacadeDetail } from "./UrbanMaterialDetail.js";
import { buildingMaterial } from "./BuildingIdentity.js";
// Close-frontage influence is shared by the landmark and its annexes.
const ENTRANCE_PERSPECTIVE_ENABLED=true;
// Art-directed maximum on both axes; physical height limits still apply.
const PARALLAX_INTENSITY=Object.freeze({eastWest:4,northSouth:4});
/** Radial bird-eye projection: roof expands away from the camera centre; base stays fixed. */
export const buildingHeight=scaledBuildingHeight;
export function facadeHeightBands(height,levels){
 const cuts=[0,...new Set(levels.filter(h=>h>0&&h<height)),height].sort((a,b)=>a-b);
 return cuts.slice(1).map((hi,i)=>({lo:cuts[i],hi,v0:1-hi/height,v1:1-cuts[i]/height,depth:60+hi*2-.5}));
}
export function roofParallaxOffset(building, camera, intensity={}) {
 const bounds=building.towerSourceBounds || building;
 const height=buildingHeight(building);
 const cameraX=camera.scrollX+camera.width/2,cameraY=camera.scrollY+camera.height/2;
 const cx=bounds.x+bounds.w/2,cy=bounds.y+bounds.h/2,spread=height/1505;
 // Shared vanishing point: corresponding roof vertices use the same projection.
 // Clamp only outside the active view, avoiding unbounded offscreen displacement.
 const limit=intensity.limit??perspectiveLimit([building],camera,intensity);
 const amount=Math.max(0,Math.min(1,intensity.entrance||0));
 const radial=1-amount, direction=intensity.direction||{nx:0,ny:1};
 const spreadX=spread*(intensity.eastWest??1)*limit*radial;
 const spreadY=spread*(intensity.northSouth??1)*limit*radial;
 // Convex blend of two height-bounded projections, never an additive camera kick.
 return {x:(cx-cameraX)*spreadX-height*.65*direction.nx*amount,
 y:(cy-cameraY)*spreadY-height*.65*direction.ny*amount,spread,spreadX,spreadY,cx,cy};

}

export function visibleFacadeEdges(b,o) {
 const {x,y,w,h}=b;
 const edges=[];
 if(o.x+(x+w-(o.cx||0))*(o.spreadX??o.spread??0)<0)edges.push([{x:x+w,y},{x:x+w,y:y+h},0x151515]);
 if(o.x+(x-(o.cx||0))*(o.spreadX??o.spread??0)>0)edges.push([{x,y},{x,y:y+h},0x24221e]);
 // The horizontal front plane wins at shared corners.
 if(o.y+(y+h-(o.cy||0))*(o.spreadY??o.spread??0)<0)edges.push([{x,y:y+h},{x:x+w,y:y+h},0x343029]);
 if(o.y+(y-(o.cy||0))*(o.spreadY??o.spread??0)>0)edges.push([{x,y},{x:x+w,y},0x222120]);
 return edges;
}

// Split facade edges around touching solid wings; never draw a wall inside one building.
export function exteriorFacadeEdges(building,offset,neighbours=[]) {
 const sameTower=b=>b!==building && b.skyline && building.skyline && b.towerSourceBounds?.x===building.towerSourceBounds?.x && b.towerSourceBounds?.y===building.towerSourceBounds?.y;
 return visibleFacadeEdges(building,offset).flatMap(([a,c,color])=>{
  const horizontal=a.y===c.y, start=horizontal?a.x:a.y,end=horizontal?c.x:c.y;
  let spans=[[start,end]];
  for(const b of neighbours.filter(sameTower)){
   const touching=horizontal ? Math.abs(b.y+b.h-a.y)<.01||Math.abs(b.y-a.y)<.01 : Math.abs(b.x+b.w-a.x)<.01||Math.abs(b.x-a.x)<.01;
   if(!touching)continue;
   const lo=horizontal?b.x:b.y,hi=lo+(horizontal?b.w:b.h);
   spans=spans.flatMap(([l,r])=>hi<=l||lo>=r?[[l,r]]:[[l,Math.min(r,lo)],[Math.max(l,hi),r]].filter(([x,y])=>y-x>.01));
  }
  return spans.map(([l,r])=>[horizontal?{x:l,y:a.y}:{x:a.x,y:l},horizontal?{x:r,y:a.y}:{x:a.x,y:r},color]);
 });
}

export class BuildingParallax {
 constructor(scene, paint, canonicalBuildings=[]) {
  this.canonicalBuildings=canonicalBuildings;
  this.lamps=new ProjectedStreetLamps(scene);
  this.attachmentCache=new WeakMap();
  this.dormant=new Map();
  this.landmarkGroups=landmarkGroups(canonicalBuildings);
  this.stableHeightLevels=[...new Set(canonicalBuildings.flatMap(b=>[b,...attachedTurrets(b,buildingHeight(b))]).map(buildingHeight))];
  this.scene=scene; this.paint=paint; this.roofs=new Map(); this.materials=new BuildingMaterialImages(scene);
 }
 update(buildings, enabled) {
  buildings=buildings.flatMap(b=>{let parts=this.attachmentCache.get(b);if(!parts){parts=[b,...attachedTurrets(b,buildingHeight(b))];this.attachmentCache.set(b,parts);}return parts;});
  this.lamps.update(this.scene.cameras.main,enabled,(b,c)=>roofParallaxOffset(b,c,{...PARALLAX_INTENSITY,limit:viewportPerspectiveLimit(c,PARALLAX_INTENSITY)}));
  const player=this.scene.player;
  const cam=this.scene.cameras.main;
  this.entrances??=new Map();
  const resident=new Set(buildings.map(b=>b.id));
  for(const id of this.entrances.keys())if(!resident.has(id))this.entrances.delete(id);
  const groups=this.landmarkGroups?.length?this.landmarkGroups:landmarkGroups(buildings);
  for(const group of groups){
   const state=updateFrontage(enabled&&ENTRANCE_PERSPECTIVE_ENABLED?player:null,group.members,this.entrances.get(group.root.id),this.scene.game?.loop?.delta??16.67,this.scene.landmarkPerspectiveMagnitude??.75);
   for(const member of group.members)this.entrances.set(member.id,state);
  }
  this.entrance=Math.max(0,...Array.from(this.entrances.values(),s=>s.amount));
  const intensity={...PARALLAX_INTENSITY};
  intensity.limit=viewportPerspectiveLimit(cam,intensity);
  const entranceKey=Array.from(this.entrances,([id,s])=>`${id}:${s.amount.toFixed(4)}:${s.direction.nx}:${s.direction.ny}`).join(',');
  const key=enabled ? `${cam.scrollX}:${cam.scrollY}:${cam.zoom}:${cam.width}:${cam.height}:${entranceKey}:${buildings.map(b=>b.id).join(",")}` : "off";
  if(this.frameKey===key)return;
  this.frameKey=key;
  this.materialBudget=2;
  this.materialDeadline=performance.now()+3;
  for(const entry of this.roofs.values()){entry.graphic.setVisible(false);entry.groundImage?.setVisible(false);entry.pinnacles?.setVisible(false);entry.pinnacleCaps?.setVisible(false);for(const q of entry.pinnacleQuads||[])q.setVisible(false);entry.wall.setVisible(false);for(const f of entry.faces||[])for(const q of [...f.quads,...(f.lightQuads||[])])q.setVisible(false);}
  if(!enabled)return;
  const retained=new Set();
  const camera=this.scene.cameras.main, view=camera.worldView;
  this.heightLevels=this.stableHeightLevels?.length?this.stableHeightLevels:[...new Set(buildings.filter(b=>!(b.x+b.w<view.x-320||b.x>view.right+320||b.y+b.h<view.y-320||b.y>view.bottom+320)).map(buildingHeight))];
  let order=0;
  for(const b of [...buildings].sort((a,b)=>(a.y+a.h)-(b.y+b.h)||a.x-b.x)){
   if(b.x+b.w<view.x-320||b.x>view.right+320||b.y+b.h<view.y-320||b.y>view.bottom+320)continue;
   retained.add(b.id);
   let entry=this.roofs.get(b.id);
   if(!entry&&this.dormant.has(b.id)){entry=this.dormant.get(b.id);this.dormant.delete(b.id);this.roofs.set(b.id,entry);}
   if(!entry){
    const wall=this.scene.add.graphics();let graphic,roofKey;
    if(b.siteId==='club-site'&&!b.campusBarrier||b.id==='hospital'||b.id==='hospitalEmergency'||b.cornerTurret||b.family==='police-campus'&&!['railing','gate'].includes(b.campusBarrier)){roofKey=this.materials.roof(b,attachedTurrets(b,buildingHeight(b)));graphic=this.scene.add.image(b.x,b.y,roofKey).setOrigin(0,0).setDisplaySize(b.w,b.h);}
    else {graphic=this.scene.add.graphics();this.paint(graphic,b);}
    const pinnacles=this.scene.add.graphics(),pinnacleModel=createPinnacleModel(b);
    let groundImage,groundKey;
    if(b.family==='hospital'||b.id==='hospital'||b.id==='hospitalEmergency'){
     const contact=this.materials.groundContact(b);groundKey=contact.key;
     groundImage=this.scene.add.image(b.x-contact.pad,b.y-contact.pad,groundKey).setOrigin(0,0).setDepth((this.scene.map?.depth||0)+.01);
    }
    entry={graphic,wall,roofKey,groundImage,groundKey,pinnacles,pinnacleModel,pinnacleCaps:this.scene.add.graphics(),pinnacleQuads:[],faces:[]};this.roofs.set(b.id,entry);
   }
   const entryPerspective=this.entrances.get(b.parentBuildingId||b.id);
   const o=roofParallaxOffset(b,camera,{...intensity,entrance:entryPerspective?.amount||0,direction:entryPerspective?.direction}),roofDepth=60+buildingHeight(b)*2;
   entry.groundImage?.setVisible(true);
   entry.wall.clear().setVisible(true).setDepth(59+(order++)*.0001);
   if(entry.roofKey)entry.graphic.setVisible(true).setDisplaySize(b.w*(1+o.spreadX),b.h*(1+o.spreadY)).setPosition(b.x+o.x+(b.x-o.cx)*o.spreadX,b.y+o.y+(b.y-o.cy)*o.spreadY).setDepth(roofDepth);
   else entry.graphic.setVisible(true).setScale(1+o.spreadX,1+o.spreadY).setPosition(o.x-o.cx*o.spreadX,o.y-o.cy*o.spreadY).setDepth(roofDepth);
   entry.pinnacles.clear().setVisible(true).setDepth(roofDepth+.1);
   if(entry.pinnacleModel.length){
    const keys=this.materials.turretMaterials();let face=0;
    entry.pinnacleCaps.clear().setVisible(true).setDepth(roofDepth+.2);
    entry.pinnacles.materialFace=(shape,material,color)=>{
     if(material==='slate'){
      const index=face++,q=entry.pinnacleQuads[index]||(entry.pinnacleQuads[index]=new MaterialQuad(this.scene,keys.slate));
      q.setTexture(keys.slate);q.subdivisions=1;q.corners=triangleMaterialCorners(shape);
      const shades={0x37413f:0xbac0c6,0x192320:0x737b85,0x28322f:0x939ba4,0x56615a:0xe0e2e5};
      q.setVisible(true).setTint(shades[color]||0xffffff).setDepth(roofDepth+.2+index*.001);return;
     }
     const index=face++,q=entry.pinnacleQuads[index]||(entry.pinnacleQuads[index]=new MaterialQuad(this.scene,keys[material]));
     q.setTexture(keys[material]);
     q.corners=shape.length===3?[shape[2],shape[0],shape[1],shape[2]]:[shape[3],shape[0],shape[1],shape[2]];
     q.setVisible(true).setTint(color===0x626457?0xc0c1b6:color===0x454944?0x969e96:0x6b7771).setDepth(roofDepth+.11+index*.001);
    };
   }
   paintRoofPinnacles(entry.pinnacles,entry.pinnacleModel,o,buildingHeight(b));
   this.facades(b,o,entry.wall,buildings,entry);
  }
  for(const [id,entry] of this.roofs)if(!retained.has(id)){this.dormant.set(id,entry);this.roofs.delete(id);}
  // Keep a small recently-used set; account for decoded RGBA, not file size.
  let bytes=0;for(const e of this.dormant.values())bytes+=this.entryBytes(e);
  while(this.dormant.size>12||bytes>32*1024*1024){const [id,e]=this.dormant.entries().next().value;bytes-=this.entryBytes(e);this.releaseEntry(e);this.dormant.delete(id);}
 }
 facades(b,o,g,buildings,entry){
  let faceOrder=0;
  // Four connecting planes, with near planes painted last; no moving collision.
  const face=(a,c,color)=>{
   const material=buildingMaterial(b);
   color=a.y===c.y ? material.wall : ((material.wall & 0xfefefe) >> 1);
   const project=p=>({x:p.x+o.x+(p.x-o.cx)*o.spreadX,y:p.y+o.y+(p.y-o.cy)*o.spreadY});
   const pa=project(a),pc=project(c),plane=[a,c,pc,pa];

   const length=Math.hypot(c.x-a.x,c.y-a.y),horizontal=a.y===c.y;
   const id=`${a.x}:${a.y}:${c.x}:${c.y}`;
   let f=entry.faces.find(f=>f.id===id);
   if(!f && (this.materialBudget<=0||(this.materialBudget<2&&performance.now()>=this.materialDeadline))){g.fillStyle(color,1).fillPoints(plane,true);this.frameKey=null;return;}
   if(!f){this.materialBudget--;const facadeSide=horizontal?(a.y===b.y?'north':'south'):(a.x===b.x?'west':'east');const {key,lightKey}=this.materials.facade({...b,facadeSide},length,horizontal);f={id,key,lightKey,quads:[],lightQuads:[]};entry.faces.push(f);}
   const height=buildingHeight(b),base=b.renderBaseHeight||0;
   // The footprint/height topology does not change with the camera. Cache UV spans.
   const layout=f.layout??(f.layout=facadeHeightBands(height,[...this.heightLevels,base]).filter(band=>band.lo>=base).flatMap(band=>exposedWallSpans(b,a,c,band.hi,buildings,buildingHeight).map(span=>({band,span}))));
   const at=(base,roof,t)=>({x:base.x+(roof.x-base.x)*t,y:base.y+(roof.y-base.y)*t});
   let mesh=0;
   for(const {band,span:[u0,u1]} of layout){
    const i=mesh++,q=f.quads[i]||(f.quads[i]=new MaterialQuad(this.scene,f.key));
    const left=at(a,c,u0),right=at(a,c,u1),leftRoof=at(pa,pc,u0),rightRoof=at(pa,pc,u1);
    q.corners=[at(left,leftRoof,band.hi/height),at(left,leftRoof,band.lo/height),at(right,rightRoof,band.lo/height),at(right,rightRoof,band.hi/height)];
    q.adaptiveMesh=true;
    q.uStart=u0;q.uEnd=u1;
    q.vStart=1-(band.hi-base)/(height-base);q.vEnd=1-(band.lo-base)/(height-base);
    q.setVisible(true).setTint(horizontal?0xffffff:0x999999).setDepth(band.depth+(faceOrder)*.001);
    if(f.lightKey){const light=f.lightQuads[i]||(f.lightQuads[i]=new MaterialQuad(this.scene,f.lightKey));
     light.subdivisions=2;light.corners=q.corners;light.vStart=q.vStart;light.vEnd=q.vEnd;light.uStart=u0;light.uEnd=u1;
     light.setVisible(true).setDepth(band.depth+faceOrder*.001+.0001);
    }
   }
   faceOrder++;
  };
  for(const [a,c,color] of exteriorFacadeEdges(b,o,buildings))face(a,c,color);
 }
 entryBytes(e){let bytes=0;for(const key of [e.roofKey,e.groundKey,...e.faces.flatMap(f=>[f.key,f.lightKey])])if(key){const source=this.scene.textures.get(key).getSourceImage();bytes+=source.width*source.height*4;}return bytes;}
 releaseEntry(e){e.graphic.destroy();e.pinnacles?.destroy();e.pinnacleCaps?.destroy();e.wall.destroy();this.materials.destroyEntry(e);}
 destroy(){for(const e of this.dormant.values())this.releaseEntry(e);this.dormant.clear();this.lamps.destroy();for(const e of this.roofs.values()){e.graphic.destroy();e.pinnacles?.destroy();e.pinnacleCaps?.destroy();e.wall.destroy();this.materials.destroyEntry(e);}this.materials.destroy();this.roofs.clear();}
}
