import {metresToWorld,scaledBuildingHeight} from './WorldScale.js';
import {ordinaryBlockProfile} from './OrdinaryBlockProfiles.js';
import {buildingEntrances} from './BuildingEntrances.js';

export const ORDINARY_BLOCK_KEY='ordinary-block-v2';
export const WEST_MARKET_FACADE_KEY='west-market-facades-v1';
export const DISTRICT_FACADE_KEYS=['district-civic-facades-v1','district-industrial-facades-v1'];
export const blockPrimarySide=b=>buildingEntrances(b)[0]?.side||'south';
// Shared art recipes. Profiles opt in without changing footprints or collision.
const RECIPES={
 tenement:{crop:[.085,.002,.915,.282],piers:[[.12,.035],[.397,.041],[.60,.041],[.88,.035]],lights:[[.31,.27,.075,.21],[.50,.60,.09,.15]]},
 arcade:{crop:[.08,.289,.92,.571],piers:[[.103,.035],[.368,.029],[.633,.029],[.898,.035]],lights:[[.23,.71,.17,.25],[.77,.22,.075,.19]]},
 'after-hours':{crop:[.244,.579,.754,.825],piers:[[.258,.029],[.738,.032]],lights:[[.25,.65,.12,.19],[.71,.68,.12,.20],[.72,.21,.10,.20]]},
 court:{key:WEST_MARKET_FACADE_KEY,crop:[.002,.002,.998,.325],piers:[],modular:true,lights:[[.5,.64,.06,.12],[.38,.22,.055,.19]]},
 warehouse:{key:WEST_MARKET_FACADE_KEY,crop:[.002,.334,.998,.661],piers:[],modular:true,lights:[[.37,.24,.055,.19]]},
 workshop:{key:WEST_MARKET_FACADE_KEY,crop:[.002,.669,.998,.988],piers:[],modular:true,lights:[[.67,.74,.05,.17],[.62,.25,.05,.19]]},
 civic:{key:DISTRICT_FACADE_KEYS[0],crop:[.002,.002,.998,.325],piers:[],modular:true,lights:[[.5,.63,.06,.12],[.275,.23,.055,.19]]},
 academic:{key:DISTRICT_FACADE_KEYS[0],crop:[.002,.333,.998,.659],piers:[],modular:true,lights:[[.5,.65,.05,.10],[.705,.25,.055,.19]]},
 luxury:{key:DISTRICT_FACADE_KEYS[0],crop:[.002,.667,.998,.982],piers:[],modular:true,lights:[[.5,.70,.06,.14],[.275,.22,.055,.19]]},
 'canal-house':{key:DISTRICT_FACADE_KEYS[1],crop:[.002,.002,.998,.322],piers:[],modular:true,lights:[[.5,.63,.06,.12],[.275,.22,.055,.19]]},
 factory:{key:DISTRICT_FACADE_KEYS[1],crop:[.002,.329,.998,.657],piers:[],modular:true,lights:[[.765,.23,.055,.19]]},
 depot:{key:DISTRICT_FACADE_KEYS[1],crop:[.002,.667,.998,.989],piers:[],modular:true,lights:[[.275,.22,.055,.14]]}
};

export function ordinaryArchitecture(b){
 const name=ordinaryBlockProfile(b)?.name;
 return RECIPES[name]||null;
}

export function blockArchitectureReady(scene,b){
 const recipe=ordinaryArchitecture(b);
 return Boolean(recipe&&scene.textures.exists(ORDINARY_BLOCK_KEY)&&scene.textures.exists(recipe.key||ORDINARY_BLOCK_KEY));
}

// A central doorway is kept once. Side bays repeat at a readable physical scale;
// narrow courtyard wings use only the central section, not a compressed whole row.
export function blockFacadeSlices(b,length){
 if(!ordinaryArchitecture(b)?.modular)return [{x:0,w:length,u0:0,u1:1}];
 if(length<180)return [{x:0,w:length,u0:.30,u1:.70}];
 const center=112,side=(length-center)/2,count=Math.max(1,Math.round(side/84)),w=side/count;
 return [
  ...Array.from({length:count},(_,i)=>({x:i*w,w,u0:0,u1:.30})),
  {x:side,w:center,u0:.30,u1:.70},
  ...Array.from({length:count},(_,i)=>({x:side+center+i*w,w,u0:.70,u1:1}))
 ];
}

function drawCrop(ctx,image,uv,x,y,w,h){
 const [u0,v0,u1,v1]=uv;
 ctx.drawImage(image,u0*image.width,v0*image.height,(u1-u0)*image.width,(v1-v0)*image.height,x,y,w,h);
}

export function bakeBlockFacade(materials,b,length){
 const recipe=ordinaryArchitecture(b),image=materials.scene.textures.get(recipe.key||ORDINARY_BLOCK_KEY).getSourceImage();
 const h=scaledBuildingHeight(b),width=Math.min(1024,Math.ceil(length*3)),height=Math.min(768,Math.ceil(h*3));
 const canvas=materials.canvas(width,height),ctx=canvas.getContext('2d');
 ctx.scale(width/length,height/h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 if((b.facadeSide||'south')===blockPrimarySide(b)){
  // Add actual storeys from the authored upper strip. The entrance and every
  // window keep the original physical height instead of stretching the image.
  for(const row of blockFacadeRows(b)){
   const [u0,v0,u1,v1]=recipe.crop,mid=(v0+v1)/2;
   const crop=[u0,row.ground?mid:v0,u1,row.ground?v1:mid];
   ctx.save();if(row.mirror){ctx.translate(length,0);ctx.scale(-1,1);}
   for(const slice of blockFacadeSlices(b,length)){
    drawCrop(ctx,image,[u0+(u1-u0)*slice.u0,crop[1],u0+(u1-u0)*slice.u1,crop[3]],slice.x,row.y,slice.w,row.h);
   }
   // The shop nameboard straddles the authored midline. It belongs only to the
   // original ground-floor pair, never to an added (potentially mirrored) storey.
   if(row.added&&ordinaryBlockProfile(b)?.name==='after-hours')drawCrop(ctx,image,[u0,.669,u1,.677],0,row.y+row.h*.78,length,row.h*.22);
   ctx.restore();
   for(const slice of blockFacadeSlices(b,length))for(const [u,v,rx,ry]of recipe.lights)if((v>=.5)===row.ground&&u>=slice.u0&&u<slice.u1){
    const x=slice.x+(u-slice.u0)/(slice.u1-slice.u0)*slice.w;
    materials.warmLights.draw(ctx,'halo',row.mirror?length-x:x,row.y+(v-(row.ground?.5:0))*2*row.h,rx*slice.w/(slice.u1-slice.u0),ry*row.h*2,.17);
   }
  }
 }else{
  // Quieter secondary elevations use the same stone, with physically sized bays.
  const image=materials.scene.textures.get(ORDINARY_BLOCK_KEY).getSourceImage();
  const size=metresToWorld(3.4),tile=[.008,.838,.24,.99];
  for(let y=0;y<h;y+=size)for(let x=0;x<length;x+=size){
   const w=Math.min(size,length-x),d=Math.min(size,h-y);
   drawCrop(ctx,image,[tile[0],tile[1],tile[0]+(tile[2]-tile[0])*w/size,tile[1]+(tile[3]-tile[1])*d/size],x,y,w,d);
  }
  const columns=Math.max(1,Math.floor(length/(size*1.5))),rows=Math.max(1,Math.round(h/size));
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
   const lit=row===0&&col===1&&b.facadeSide==='east',x=(col+.5)*length/columns-size/2,y=row*h/rows;
   drawCrop(ctx,image,lit?[.507,.838,.74,.99]:[.256,.838,.493,.99],x,y,size,h/rows);
   if(lit)materials.warmLights.draw(ctx,'halo',x+size*.5,y+h/rows*.46,size*.35,h/rows*.42,.13);
  }
 }
 return {key:materials.register(canvas),lightKey:null,authoredNight:true};
}

export function blockFacadeRows(b){
 const height=scaledBuildingHeight(b),floorHeight=metresToWorld(b.storeyMetres??3.4),rows=[];
 for(let floor=0;floor*floorHeight<height-.001;floor++){
  const h=Math.min(floorHeight,height-floor*floorHeight);
  rows.push({ground:floor===0,added:floor>1,mirror:floor>1&&floor%2===0,y:height-floor*floorHeight-h,h});
 }
 return rows;
}

// Continuous shallow relief: beveled piers share vertices with the recessed wall.
// The relief fades into the existing footprint and coping, avoiding open seams.
export function blockFacadeSections(b,length){
 const recipe=ordinaryArchitecture(b);
 if(!recipe||!recipe.piers.length||(b.facadeSide||'south')!==blockPrimarySide(b))return null;
 const [left,,right]=recipe.crop,knots=[[0,0]],depth=Math.min(metresToWorld(.24),length*.025);
 for(const [center,width]of recipe.piers){
  const lo=Math.max(0,(center-width*.6-left)/(right-left)),hi=Math.min(1,(center+width*.6-left)/(right-left));
  if(hi<=lo)continue;
  const bevel=Math.min((hi-lo)*.22,metresToWorld(.06)/length);
  if(lo>knots.at(-1)[0])knots.push([lo,0]);
  knots.push([lo+bevel,depth],[hi-bevel,depth],[hi,0]);
 }
 if(knots.at(-1)[0]<1)knots.push([1,0]);
 return knots.slice(1).map(([u1,d1],i)=>({u0:knots[i][0],u1,d0:knots[i][1],d1})).filter(s=>s.u1-s.u0>1e-8);
}

export function clipFacadeSections(sections,u0,u1){
 return sections.flatMap(s=>{
  const lo=Math.max(s.u0,u0),hi=Math.min(s.u1,u1);
  if(hi<=lo)return [];
  const depth=u=>s.d0+(s.d1-s.d0)*(u-s.u0)/(s.u1-s.u0);
  return [{u0:lo,u1:hi,d0:depth(lo),d1:depth(hi)}];
 });
}

export const facadeReliefBevel=height=>Math.min(metresToWorld(.18),height*.1);

export function reliefFacadePoint(a,c,u,z,height,depth,o,out={},side='south'){
 const bevel=facadeReliefBevel(height),fade=Math.max(0,Math.min(1,z/bevel,(height-z)/bevel));
 const x=a.x+(c.x-a.x)*u+depth*fade*(side==='east'?1:side==='west'?-1:0),y=a.y+(c.y-a.y)*u+depth*fade*(side==='south'?1:side==='north'?-1:0),t=z/height;
 out.x=x+(o.x+(x-o.cx)*o.spreadX)*t;
 out.y=y+(o.y+(y-o.cy)*o.spreadY)*t;
 return out;
}
