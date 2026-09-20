import {scaledBuildingHeight, metresToWorld, WORLD_SCALE} from './WorldScale.js';
import {blockArchitectureReady,bakeBlockFacade} from './OrdinaryBlockArchitecture.js';
import {buildingEntrances} from './BuildingEntrances.js';

export const ORDINARY_FACADE_KEY='ordinary-facades-v2';
export const ORDINARY_ROOF_KEY='ordinary-roofs-v1';

export function ordinaryBuilding(b){
 return b.w>=24&&b.h>=24&&(!b.landmark||Boolean(b.architectureKit))&&!b.skyline&&!b.campusBarrier&&!b.cornerTurret&&!b.roofTier&&!b.dormer
  &&!b.cathedralKind&&!b.cathedralCollider&&!['hospital','hospitalEmergency'].includes(b.id)
  &&!['hospital','police-campus','cathedral'].includes(b.family)&&b.siteId!=='club-site';
}
export const ordinaryMaterialsReady=(scene,b)=>ordinaryBuilding(b)&&scene.textures.exists(ORDINARY_FACADE_KEY)&&scene.textures.exists(ORDINARY_ROOF_KEY);

export function buildingArtSeed(id=''){
 let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;
}

// Layout is physical, independent of camera, display resolution and texture size.
// A half-panel is a square one-window bay; full panels contain one ground-floor use.
export function ordinaryFacadeLayout(b,length){
 const height=scaledBuildingHeight(b),storey=metresToWorld(b.storeyMetres??WORLD_SCALE.storeyMetres);
 const rows=Math.max(1,Math.round(height/storey)),rowHeight=height/rows;
 const bayWidth=Math.min(rowHeight,Math.max(0,length-8)),columns=Math.floor((length-8)/Math.max(1,bayWidth));
 const start=(length-columns*bayWidth)/2,seed=buildingArtSeed(b.id+':'+(b.facadeSide||'south'));
 const industrial=b.family==='industrial',commercial=['commercial','market','nightlife'].includes(b.family);
 const modules=[];
 if(bayWidth<20||columns<1)return {height,modules};
 const side=b.facadeSide||'south',authoredDoor=buildingEntrances(b).find(d=>d.side===side);
 const entrance=b.entrances?!!authoredDoor:side==='south';
 const groundWidth=Math.min(2*rowHeight,length-8),groundX=Math.max(4,Math.min(length-groundWidth-4,length*(authoredDoor?.at??.5)-groundWidth/2));
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x=start+col*bayWidth,y=row*rowHeight,ground=row===rows-1;
  if(ground&&entrance&&x<groundX+groundWidth&&x+bayWidth>groundX)continue;
  // A few blank bays break long grids without compromising the shared storey scale.
  const value=(seed+row*17+col*31)>>>0;
  const featuredLight=!ground&&entrance&&row===0&&columns>=2&&col===seed%columns;
  if(!ground&&columns>3&&value%7===0&&!featuredLight)continue;
  const lit=featuredLight||value%8===0,cell=industrial?4:commercial?5:lit?1:0;
  modules.push({x,y,w:bayWidth,h:rowHeight,cell,half:lit?1:0,lit,glowX:.5,glowY:.48});
 }
 if(entrance){
  const cell=industrial?7:commercial?3:2;
  modules.push({x:groundX,y:height-rowHeight,w:groundWidth,h:rowHeight,cell,lit:true,glowX:industrial?.85:commercial?.22:.5,glowY:industrial?.18:commercial?.42:.30});
 }
 return {height,modules};
}

export function atlasCell(source,cell,columns,rows,inset=1){
 const w=source.width/columns,h=source.height/rows;
 return {x:cell%columns*w+inset,y:Math.floor(cell/columns)*h+inset,w:w-inset*2,h:h-inset*2};
}
function cropDraw(ctx,source,crop,x,y,w,h){ctx.drawImage(source,crop.x,crop.y,crop.w,crop.h,x,y,w,h);}
function tiled(ctx,source,crop,x,y,w,h,tileW,tileH){
 for(let dy=0;dy<h;dy+=tileH)for(let dx=0;dx<w;dx+=tileW){
  const tw=Math.min(tileW,w-dx),th=Math.min(tileH,h-dy);
  cropDraw(ctx,source,{...crop,w:crop.w*tw/tileW,h:crop.h*th/tileH},x+dx,y+dy,tw,th);
 }
}
export function bakeOrdinaryFacade(materials,b,length){
 if(blockArchitectureReady(materials.scene,b))return bakeBlockFacade(materials,b,length);
 const source=materials.scene.textures.get(ORDINARY_FACADE_KEY).getSourceImage(),layout=ordinaryFacadeLayout(b,length);
 const width=Math.min(1024,Math.ceil(length*3)),height=Math.min(512,Math.ceil(layout.height*3));
 const canvas=materials.canvas(width,height),ctx=canvas.getContext('2d');ctx.scale(width/length,height/layout.height);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 // Exclude the source sheet's dark separators from the repeated material edges.
 tiled(ctx,source,atlasCell(source,6,2,4,5),0,0,length,layout.height,93,46.5);
 for(const m of layout.modules){
  const c=atlasCell(source,m.cell,2,4,5);
  if(m.half!==undefined){c.w/=2;c.x+=c.w*m.half;}
  cropDraw(ctx,source,c,m.x,m.y,m.w,m.h);
 }
 // The asset contains the bright interior only. Soft spill is composited separately
 // here once, never blurred over the window frame or regenerated during movement.
 for(const m of layout.modules)if(m.lit){
  materials.warmLights.draw(ctx,'halo',m.x+m.w*m.glowX,m.y+m.h*m.glowY,m.w*(m.half===undefined?.25:.40),m.h*.48,.13);
 }
 return {key:materials.register(canvas),lightKey:null,authoredNight:true};
}

export function bakeOrdinaryRoof(materials,b){
 const source=materials.scene.textures.get(ORDINARY_ROOF_KEY).getSourceImage();
 const width=Math.min(1024,Math.ceil(b.w*2)),height=Math.min(1024,Math.ceil(b.h*2));
 const canvas=materials.canvas(width,height),ctx=canvas.getContext('2d');ctx.scale(width/b.w,height/b.h);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 tiled(ctx,source,atlasCell(source,0,2,2),0,0,b.w,b.h,112,112);
 const c=atlasCell(source,1,2,2),rim=3.5,sw=c.w*.065,sh=c.h*.065;
 // Nine-sliced coping: its thickness never grows with the building footprint.
 const xs=[0,rim,b.w-rim],ys=[0,rim,b.h-rim],ws=[rim,b.w-rim*2,rim],hs=[rim,b.h-rim*2,rim];
 const sx=[c.x,c.x+sw,c.x+c.w-sw],sy=[c.y,c.y+sh,c.y+c.h-sh],cw=[sw,c.w-2*sw,sw],ch=[sh,c.h-2*sh,sh];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(x!==1||y!==1){
  tiled(ctx,source,{x:sx[x],y:sy[y],w:cw[x],h:ch[y]},xs[x],ys[y],ws[x],hs[y],x===1?64:rim,y===1?64:rim);
 }
 return materials.register(canvas);
}
