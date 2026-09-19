import {scaledBuildingHeight} from './WorldScale.js';
import {buildingEntrances} from './BuildingEntrances.js';
// Built once per resident facade. Texture and light layers follow the same projection.
export function bakeVesperFacade(materials,b,length){
 const physicalHeight=scaledBuildingHeight(b),width=Math.ceil(length*3),height=Math.ceil(physicalHeight*3);
 const canvas=materials.canvas(width,height),ctx=canvas.getContext('2d');
 const source=materials.scene.textures.get('vesper-facade').getSourceImage();
 const front=!!b.theatreFront&&b.facadeSide==='south',range=b.theatreFront||[0,1];
 if(front)ctx.drawImage(source,range[0]*source.width,0,(range[1]-range[0])*source.width,source.height,0,0,width,height);
 else{
  ctx.fillStyle=ctx.createPattern(materials.pattern('stone-gothic'),'repeat');ctx.fillRect(0,0,width,height);
  ctx.fillStyle='rgba(28,23,24,.48)';ctx.fillRect(0,0,width,height);
  // A quiet window bay from the authored theatre texture, without repeating the entrance.
  const bayWidth=48*3,floorHeight=scaledBuildingHeight({storeys:1,storeyMetres:b.storeyMetres})*3;
  for(let y=height-floorHeight*2;y>=0;y-=floorHeight)for(let x=32*3;x<width-30*3;x+=bayWidth*1.6)
   ctx.drawImage(source,source.width*.77,source.height*.14,source.width*.09,source.height*.17,x,y,bayWidth*.6,floorHeight*.54);
  const asset=materials.scene.textures.get('vesper-service-door').getSourceImage();
  for(const d of buildingEntrances(b).filter(d=>d.side===b.facadeSide)){
   const h=43*3,w=h*asset.width/asset.height;ctx.drawImage(asset,width*d.at-w/2,height-h,w,h);
  }
 }
 if(!front&&!buildingEntrances(b).some(d=>d.side===b.facadeSide))return {key:materials.register(canvas),lightKey:null};
 const lights=materials.canvas(Math.ceil(width/3),Math.ceil(height/3)),c=lights.getContext('2d');
 c.scale(lights.width/length,lights.height/physicalHeight);
 if(front){
  const at=u=>(u-range[0])/(range[1]-range[0])*length;
  const contains=u=>u>=range[0]&&u<=range[1];
  for(const u of [.395,.605])if(contains(u))materials.warmLights.draw(c,'beam',at(u),physicalHeight*.76,8,25,.24);
  for(const [u,v] of [[.23,.23],[.5,.23],[.095,.43],[.5,.44]])if(contains(u))materials.warmLights.draw(c,'halo',at(u),physicalHeight*v,9,11,.15);
  if(b.id==='club')materials.warmLights.draw(c,'halo',length*.5,physicalHeight*.65,42,8,.12);
 }else for(const d of buildingEntrances(b).filter(d=>d.side===b.facadeSide))materials.warmLights.draw(c,'beam',length*d.at,physicalHeight-40,10,28,.28);
 return {key:materials.register(canvas),lightKey:materials.register(lights)};
}
