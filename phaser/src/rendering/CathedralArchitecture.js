import {scaledBuildingHeight} from './WorldScale.js';

// Authored atlas quadrants; the same small material is shared across every bay.
export function cathedralAtlasPart(ctx,source,part,x,y,w,h){
 const [u,v]=({front:[0,0],bay:[1,0],tower:[0,1],stone:[1,1]})[part];
 const sw=source.width/2,sh=source.height/2;
 ctx.drawImage(source,u*sw,v*sh,sw,sh,x,y,w,h);
}

export function bakeCathedralFacade(materials,b,length){
 const h=scaledBuildingHeight(b),scale=2;
 const canvas=materials.canvas(length*scale,h*scale),ctx=canvas.getContext('2d');ctx.scale(scale,scale);
 const source=materials.scene.textures.get('cathedral-facade').getSourceImage();
 for(let y=0;y<h;y+=96)for(let x=0;x<length;x+=96){
  ctx.save();ctx.beginPath();ctx.rect(x,y,Math.min(96,length-x),Math.min(96,h-y));ctx.clip();
  cathedralAtlasPart(ctx,source,'stone',x,y,96,96);ctx.restore();
 }
 ctx.fillStyle='rgba(10,16,19,.2)';ctx.fillRect(0,0,length,h);
 const front=b.id==='cathedral'&&b.facadeSide==='south';
 if(front){
  // Keep the authored rose circular in facade space; crop only the outer margins.
  const frontImage=materials.scene.textures.get('cathedral-front').getSourceImage(),width=h*frontImage.width/frontImage.height;
  ctx.drawImage(frontImage,(length-width)/2,0,width,h);
 }else if(b.cathedralKind==='tower'){
  cathedralAtlasPart(ctx,source,'tower',0,0,length,Math.min(h,length*3.2));
  const sw=source.width/2,sh=source.height/2;
  ctx.drawImage(source,sw*.4,sh*1.6,sw*.22,sh*.33,length*.36,h*.58,length*.28,h*.2);
  for(const x of [0,length-5])ctx.drawImage(source,0,sh,sw*.12,sh,x,0,5,h);
 }else if(b.cathedralKind!=='buttress'){
  const count=Math.max(1,Math.floor(length/62)),step=length/count;
  for(let i=0;i<count;i++){
   const width=Math.min(56,step*.88),height=Math.min(h*.88,width*2.8);
   cathedralAtlasPart(ctx,source,'bay',(i+.5)*step-width/2,h-height-6,width,height);
  }
 }
 if(b.cathedralKind==='transept'&&((b.id.includes('west')&&b.facadeSide==='west')||(b.id.includes('east')&&b.facadeSide==='east'))){
  const sw=source.width/2,sh=source.height/2;
  ctx.drawImage(source,sw*.3,sh*.53,sw*.4,sh*.47,length*(48/86)-24,h-68,48,68);
 }
 const lights=materials.canvas(Math.ceil(length),Math.ceil(h)),c=lights.getContext('2d');
 if(front){
  materials.warmLights.draw(c,'halo',length*.5,h*.40,length*.22,length*.24,.12);
  materials.warmLights.draw(c,'halo',length*.5,h-8,22,24,.12);
 }else if(!['tower','buttress'].includes(b.cathedralKind)){
  const count=Math.max(1,Math.floor(length/62)),step=length/count;
  for(let i=0;i<count;i++)materials.warmLights.draw(c,'halo',(i+.5)*step,h*.48,10,h*.21,.08);
 }
 return {key:materials.register(canvas),lightKey:materials.register(lights)};
}

// Pitched roofs are real projected planes. The ridge has its own height, sharing
// the existing camera projection with walls and towers.
export function cathedralRoofPlanes(b,o,height){
 if(b.cathedralKind==='tower')return [];
 const eastWest=b.cathedralKind==='transept',rise=b.cathedralKind==='nave'?62:b.cathedralKind==='choir'?48:32;
 const project=(x,y,z=0)=>({x:x+(o.x+(x-o.cx)*o.spreadX)*(1+z/height),y:y+(o.y+(y-o.cy)*o.spreadY)*(1+z/height)});
 const x=b.x,y=b.y,w=b.w,h=b.h;
 if(b.cathedralKind==='buttress'){
  // Stone flying supports spring from the outside piers and meet the upper nave.
  const target=b.supportX,top=scaledBuildingHeight({heightMetres:18})-height;
  const a=project(x+w/2,y,0),c=project(target,y,top),d=project(target,y+12,top),e=project(x+w/2,y+12,0);
  return [{points:[a,e,d,c],part:'stone'},
   {points:[e,project(x+w/2,y+12,-12),project(target,y+12,top-12),d],part:'stone'}];
 }
 if(eastWest){
  const a=project(x,y),c=project(x+w,y),d=project(x+w,y+h),e=project(x,y+h),r0=project(x,y+h/2,rise),r1=project(x+w,y+h/2,rise);
  return [{points:[a,r0,r1,c],part:'slate',u0:0,u1:.5},{points:[r0,e,d,r1],part:'slate',u0:.5,u1:1},
   {points:[r0,e,a,r0],part:'stone'},{points:[r1,c,d,r1],part:'stone'}];
 }
 const a=project(x,y),c=project(x+w,y),d=project(x+w,y+h),e=project(x,y+h),r0=project(x+w/2,y,rise),r1=project(x+w/2,y+h,rise);
 return [{points:[a,e,r1,r0],part:'slate',u0:0,u1:.5},{points:[r0,r1,d,c],part:'slate',u0:.5,u1:1},
  {points:[r0,a,c,r0],part:'stone'},{points:[r1,d,e,r1],part:'stone'}];
}
