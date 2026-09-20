import {CHARACTER_STACK_BOUNDS} from './CharacterSpriteStack.js';
import {STACK_FRAME_BOUNDS} from './VehicleStackModels.js';
import {PROP_STACK_BOUNDS} from './PropSpriteStack.js';

// Asset preparation only, before any actors are created. Generated surface art
// is fitted to the existing authored silhouette masks once, never per actor/frame.
const MOOD_KEY='stack-mood-surfaces';
const PUBLIC_KEYS=['human-stack-v1','vehicle-stack-fleet-v1'];
const powerOfTwo=n=>2**Math.ceil(Math.log2(Math.max(1,n)));

export function packStackFrames(rects) {
 const sorted=rects.map(([x,y,w,h],index)=>({x,y,w,h,index})).sort((a,b)=>b.h-a.h||b.w-a.w||a.index-b.index);
 let best;
 for(const width of [512,1024,2048]){
  const placements=[];let x=8,y=8,rowHeight=0;
  for(const r of sorted){
   if(r.w+16>width){y=Infinity;break;}
   if(x+r.w+8>width){x=8;y+=rowHeight+16;rowHeight=0;}
   placements.push({...r,dx:x,dy:y});x+=r.w+16;rowHeight=Math.max(rowHeight,r.h);
  }
  const height=powerOfTwo(y+rowHeight+8);
  if(height<=2048&&(!best||width*height<best.width*best.height))best={width,height,placements};
 }
 if(!best)throw new RangeError('Stack atlas exceeds the shared texture budget');
 return best;
}

function packedAtlas(scene,key,image,rects,prefix) {
 const layout=packStackFrames(rects),renderer=scene.game.renderer,previous=renderer.mipmapFilter;
 // Select mip filtering only for these immutable atlases, not dynamic city maps.
 if(renderer.gl)renderer.mipmapFilter=renderer.gl.LINEAR_MIPMAP_LINEAR;
 try{
  const atlas=scene.textures.createCanvas(key,layout.width,layout.height);
  for(const r of layout.placements){
   atlas.context.drawImage(image,r.x,r.y,r.w,r.h,r.dx,r.dy,r.w,r.h);
   atlas.add(prefix+r.index,0,r.dx,r.dy,r.w,r.h);
  }
  atlas.refresh();
  scene.stackAtlasStats??={};scene.stackAtlasStats[key]={width:layout.width,height:layout.height,frames:rects.length,rgbaMipBytes:layout.width*layout.height*4*4/3};
  return atlas;
 }finally{renderer.mipmapFilter=previous;}
}
const surfaceCell=(image,index,inset=null)=>{
 const w=image.width/4,h=image.height/2;
 if(inset){const [x,y,cw,ch]=inset;return [Math.round((index%4+x)*w),Math.round((Math.floor(index/4)+y)*h),Math.floor(cw*w),Math.floor(ch*h)];}
 return [Math.round(index%4*w),Math.round(Math.floor(index/4)*h),Math.floor(w),Math.floor(h)];
};
export function prepareStackMaterialAtlases(scene) {
 const textures=scene.textures;
 if(textures.exists('street-stack-v1-source')){
  if(!textures.exists('street-stack-v1'))packedAtlas(scene,'street-stack-v1',textures.get('street-stack-v1-source').getSourceImage(),PROP_STACK_BOUNDS,'prop-');
  textures.remove('street-stack-v1-source');
 }
 if(PUBLIC_KEYS.every(key=>textures.exists(key))){
  for(const key of [...PUBLIC_KEYS.map(key=>key+'-source'),MOOD_KEY])if(textures.exists(key))textures.remove(key);
  return;
 }
 if(!textures.exists(MOOD_KEY)){
  for(const key of PUBLIC_KEYS)if(textures.exists(key+'-source')&&!textures.exists(key))textures.renameTexture(key+'-source',key);
  return;
 }
 const surface=textures.get(MOOD_KEY).getSourceImage();
 const scratch=document.createElement('canvas');
 for(const key of PUBLIC_KEYS){
  if(textures.exists(key)||!textures.exists(key+'-source'))continue;
  const source=textures.get(key+'-source').getSourceImage();
  const composed=document.createElement('canvas');composed.width=source.width;composed.height=source.height;
  const ctx=composed.getContext('2d');
  ctx.drawImage(source,0,0);
  const human=key===PUBLIC_KEYS[0],bounds=human?CHARACTER_STACK_BOUNDS:STACK_FRAME_BOUNDS;
  const target=index=>{
   const [x,y,w,h]=bounds[index];
   return [(index%4*(human?24:48)+x)*8,(Math.floor(index/4)*(human?24:28)+y)*8,w*8,h*8];
  };
  const material=(index,cell,alpha)=>{
   const [x,y,w,h]=target(index),from=surfaceCell(surface,cell);
   scratch.width=w;scratch.height=h;
   const g=scratch.getContext('2d');g.drawImage(source,x,y,w,h,0,0,w,h);
   g.globalCompositeOperation='multiply';g.globalAlpha=alpha;
   g.drawImage(surface,...from,0,0,w,h);
   g.globalCompositeOperation='destination-in';g.globalAlpha=1;
   g.drawImage(source,x,y,w,h,0,0,w,h);
   ctx.clearRect(x,y,w,h);ctx.drawImage(scratch,x,y);
  };
  // Characters retain their authored face/lapel/seam artwork: the older mood
  // image reintroduced blurred detail and unrelated anatomy over these parts.
  if(!human){
   for(const index of [3,4,5,10,12,15,16,18,26,29,34,35])material(index,6,.18);
   for(const index of [7,8,9,17,24,28])material(index,7,.12);
  }
  packedAtlas(scene,key,composed,bounds.map((_,i)=>target(i)),human?'human-':'slice-');
  textures.remove(key+'-source');
 }
 // The packed atlases are the only GPU surfaces needed during play.
 textures.remove(MOOD_KEY);
}
