import { drawMaterialRects } from './MaterialTiles.js';
import { paintPavementWear } from './UrbanMaterialDetail.js';

// A small reusable tile replaces tens of thousands of vector stones per sector.
export function drawCachedPavements(scene,target,rects,bounds,courtyard=true){
 if(scene.textures.get&&drawMaterialRects(scene,target,rects,bounds,courtyard?'courtyard':'sidewalk'))return;
 const key=courtyard?'vice-courtyard-paving-v3':'vice-sidewalk-paving-v3';
 const width=courtyard?224:220,height=160;
 if(!scene.textures.exists(key)){
  const g=scene.make.graphics({x:0,y:0,add:false});
  paintPavementWear(g,{x:0,y:0,w:width,h:height},courtyard);
  g.generateTexture(key,width,height);g.destroy();
 }
 const slot=courtyard?'courtyardPavingTile':'sidewalkPavingTile';
 let tile=scene[slot];
 if(!tile){
  tile=scene.add.tileSprite(0,0,bounds.w,bounds.h,key).setOrigin(0,0).setVisible(false);
  scene[slot]=tile;
  scene.events.once('shutdown',()=>{scene[slot]=null;});
 }
 target.beginDraw();
 for(const r of rects){
  tile.setSize(r.w,r.h);tile.tilePositionX=r.x;tile.tilePositionY=r.y;
  target.batchDraw(tile,r.x-bounds.x,r.y-bounds.y);
 }
 target.endDraw();
}

export function drawCachedCourtyard(scene,target,bounds){drawCachedPavements(scene,target,[bounds],bounds,true);}
