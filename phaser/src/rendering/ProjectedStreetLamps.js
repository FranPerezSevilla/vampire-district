import {metresToWorld} from './WorldScale.js';
import {lights} from '../data/district.js';
import {PropSpriteStack,canStackProps} from './PropSpriteStack.js';
import {cathedralCollisionVolumes} from '../data/cathedral-campus.js';
import {DISTRICT_URBAN_DECOR} from '../data/district-blocks.js';
import {RooftopObject,DISTRICT_OBJECT_KEY} from './RooftopObjects.js';
import {cityPerspectiveReach} from './CityPerspective.js';
export const POLICE_LAMPS=[[1588,570],[1698,570],[1600,636],[1684,636],[1856,334],[1974,608],[1600,674],[1686,674]];
// Presentation only: called by the existing post-camera projection hook.
export class ProjectedStreetLamps{
 constructor(scene){this.scene=scene;this.items=[];this.districtItems=new Map();}
 updateDistrictDecor(camera,enabled){
  const v=camera.worldView;if(!v)return;
  for(const d of DISTRICT_URBAN_DECOR){
   let item=this.districtItems.get(d.id);
   // Retain nearby objects across small camera reversals at the visibility edge.
   const margin=(item?220:100)+d.height*cityPerspectiveReach(this.scene.cityPerspective);
   const visible=enabled&&d.x>=v.x-margin&&d.x<=v.right+margin&&d.y>=v.y-margin&&d.y<=v.bottom+margin;
   if(!visible){if(item){item.destroy();this.districtItems.delete(d.id);}continue;}
   if(!item){
    if(['cargo','transformer'].includes(d.kind)){
     if(!this.scene.textures.exists(DISTRICT_OBJECT_KEY))continue;
     item=new RooftopObject(this.scene,{...d,base:0,cell:d.kind==='cargo'?2:0,textureKey:DISTRICT_OBJECT_KEY,atlasMid:.5});
    }else item=new PropSpriteStack(this.scene,d.x,d.y,d.kind,d);
    this.districtItems.set(d.id,item);
   }
   item.setVisible(true);
  }
 }
 update(camera,enabled,project){
  if(canStackProps(this.scene)){
   this.updateDistrictDecor(camera,enabled);
   if(!this.stacks){
    this.stacks=POLICE_LAMPS.map(([x,y])=>new PropSpriteStack(this.scene,x,y,'lamp',{height:metresToWorld(3.6)}));
    for(const l of lights){const p=new PropSpriteStack(this.scene,l.x,l.y,'lamp',{height:metresToWorld(3.6)});p.lampId=l.id;this.stacks.push(p);}
    this.stacks.push(new PropSpriteStack(this.scene,392.5,611,'bench',{w:70,h:14,height:14}));
    for(const b of cathedralCollisionVolumes().filter(b=>['pew','altar','pier'].includes(b.cathedralPart))){
     this.stacks.push(new PropSpriteStack(this.scene,b.x+b.w/2,b.y+b.h/2,b.cathedralPart,{w:b.w,h:b.h,height:b.cathedralPart==='pier'?42:14}));
    }
    for(const [x,y]of [[3877,325],[3949,325],[3806,482],[4022,482]])this.stacks.push(new PropSpriteStack(this.scene,x,y,'candle',{height:16}));
   }
   for(const p of this.stacks)p.setVisible(enabled&&!(p.lampId&&this.scene.brokenLights?.has(p.lampId)));
   return;
  }
  if(!this.scene.textures.exists('police-lamp'))return;
  if(!this.items.length){
   const texture=this.scene.textures.get('police-lamp'),src=texture.getSourceImage();
   if(!texture.has('head'))texture.add('head',0,0,0,src.width,Math.round(src.height*.33));
   if(!texture.has('stem'))texture.add('stem',0,Math.floor(src.width*.4),Math.floor(src.height*.33),Math.floor(src.width*.2),Math.floor(src.height*.47));
   if(!texture.has('base'))texture.add('base',0,0,Math.round(src.height*.80),src.width,Math.floor(src.height*.20));
   for(const [x,y] of POLICE_LAMPS){
    this.items.push({x,y,model:{x,y,w:0,h:0,renderHeight:metresToWorld(3.6)},
     base:this.scene.add.image(x,y,'police-lamp','base').setDisplaySize(7,5).setDepth(60),
     pole:this.scene.add.image(x,y,'police-lamp','stem').setOrigin(.5,1),
     head:this.scene.add.image(x,y,'police-lamp','head').setDisplaySize(9,10)});
   }
  }
  const v=camera.worldView;
  for(const l of this.items){
   const visible=enabled&&l.x>v.x-100&&l.x<v.right+100&&l.y>v.y-100&&l.y<v.bottom+100;
   l.base.setVisible(visible);l.pole.setVisible(visible);l.head.setVisible(visible);if(!visible)continue;
   const o=project(l.model,camera),length=Math.hypot(o.x,o.y);
   l.pole.setVisible(length>2).setPosition(l.x,l.y).setDisplaySize(2.5,length).setRotation(Math.atan2(o.y,o.x)+Math.PI/2).setDepth(60+l.model.renderHeight);
   l.head.setPosition(l.x+o.x,l.y+o.y).setDepth(60+l.model.renderHeight*2);
  }
 }
 destroy(){for(const p of this.districtItems.values())p.destroy();this.districtItems.clear();for(const p of this.stacks||[])p.destroy();this.stacks=[];for(const l of this.items){l.base.destroy();l.pole.destroy();l.head.destroy();}this.items=[];}
}
