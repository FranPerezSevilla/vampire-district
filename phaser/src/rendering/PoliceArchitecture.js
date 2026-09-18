import {scaledBuildingHeight} from './WorldScale.js';
const PANEL_HEIGHT=scaledBuildingHeight({storeys:4});
// Authored raster modules, composed only when the existing material cache needs a face.
export function bakePoliceFacade(materials,b,length){
 const physicalHeight=scaledBuildingHeight(b),scale=2;
 const floorHeight=scaledBuildingHeight({storeys:1,storeyMetres:b.storeyMetres}),originalFloor=PANEL_HEIGHT/4;
 const width=Math.max(32,Math.ceil(length*scale)),height=Math.min(1024,Math.ceil(physicalHeight*scale));
 const canvas=materials.canvas(width,height),ctx=canvas.getContext('2d');
 const source=materials.scene.textures.get('police-facade').getSourceImage();
 if(b.solidPier){
  ctx.fillStyle=ctx.createPattern(materials.pattern('stone-gothic'),'repeat');ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(15,20,24,.45)';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(155,150,133,.2)';ctx.fillRect(width*.12,0,width*.12,height);
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(width*.8,0,width*.2,height);
 }else{
  // A four-storey panel repeats at physical scale instead of stretching nine floors.
  ctx.fillStyle=ctx.createPattern(materials.pattern('stone-gothic'),'repeat');ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(15,20,24,.5)';ctx.fillRect(0,0,width,height);
  const tileW=110*scale,rowH=originalFloor/physicalHeight*height,stride=floorHeight/physicalHeight*height;
  for(let row=0,y=height-stride;y>-stride;y-=stride,row++)for(let x=0;x<width;x+=tileW){
   const slice=3-row%4;
   ctx.drawImage(source,0,slice*source.height/4,source.width,source.height/4,x,y+(stride-rowH)/2,tileW,rowH);
  }
 }
 const entrance=b.id==='police'&&b.facadeSide==='south';
 if(entrance){
  const asset=materials.scene.textures.get('police-entrance').getSourceImage();
  const w=70*scale,h=56/physicalHeight*height;
  ctx.drawImage(asset,(width-w)/2,height-h,w,h);
 }
 const lights=materials.canvas(Math.ceil(width/2),Math.ceil(height/2)),c=lights.getContext('2d');
 c.scale(lights.width/length,lights.height/physicalHeight);
 if(!b.solidPier)for(let row=0,y=physicalHeight-floorHeight;y>-floorHeight;y-=floorHeight,row++)for(let x=0;x<length;x+=110){
  const slice=3-row%4;
  for(const [u,v] of [[.166,.365],[.833,.585]])if(Math.floor(v*4)===slice)
   materials.warmLights.draw(c,'halo',x+u*110,y+(floorHeight-originalFloor)/2+(v*4-slice)*originalFloor,9,14,.14);
 }
 if(entrance)for(const x of [length/2-27,length/2+27]){
  materials.warmLights.draw(c,'beam',x,physicalHeight-34,12,34,.26);
  materials.warmLights.draw(c,'halo',x,physicalHeight-34,4,7,.34);
 }
 return {key:materials.register(canvas),lightKey:!b.solidPier?materials.register(lights):null};
}
