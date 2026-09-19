// Rasterize once per scene; repeat small material images instead of per-stone geometry.
export function materialTile(scene,key,source,size,tint){
 if(scene.textures.exists(key))return key;
 if(!scene.textures.get||!scene.textures.exists(source)||typeof document==='undefined')return null;
 const image=scene.textures.get(source).getSourceImage(),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),half=size/2;
 if(source==='paving-campus')ctx.drawImage(image,0,0,size,size);
 else for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  ctx.save();ctx.translate(x?size:0,y?size:0);ctx.scale(x?-1:1,y?-1:1);ctx.drawImage(image,0,0,half,half);ctx.restore();
 }
 ctx.globalCompositeOperation='multiply';ctx.fillStyle=tint;ctx.fillRect(0,0,size,size);
 ctx.globalCompositeOperation='source-over';ctx.globalAlpha=source==='asphalt-gothic'?.66:source==='paving-campus'?.40:.48;ctx.fillStyle=source==='asphalt-gothic'?'#111820':'#202630';ctx.fillRect(0,0,size,size);
 scene.textures.addImage(key,canvas);return key;
}
export function drawMaterialRects(scene,target,rects,bounds,kind){
 const config={courtyard:['paving-campus',128,'#b8b8ae'],sidewalk:['paving-campus',128,'#b8b8ae'],road:['asphalt-gothic',256,'#6e736f']}[kind];
 const key=materialTile(scene,'gothic-ground-'+(kind==='road'?'road-v1':'paving-v3'),...config);if(!key)return false;
 const slot='gothicGroundTile_'+kind;
 let tile=scene[slot];if(!tile){tile=scene.add.tileSprite(0,0,1,1,key).setOrigin(0,0).setVisible(false);scene[slot]=tile;scene.events.once('shutdown',()=>{scene[slot]=null;});}
 target.beginDraw();
 for(const r of rects){tile.setSize(r.w,r.h);tile.tilePositionX=r.x;tile.tilePositionY=r.y;target.batchDraw(tile,r.x-bounds.x,r.y-bounds.y);}
 target.endDraw();return true;
}

// Irregular junctions use the same world-aligned tile. Only rasterized on sector refresh.
export function drawMaterialPolygon(scene,target,points,bounds,kind){
 const source=kind==='road'?'asphalt-gothic':'paving-campus';
 if(!scene.textures?.get||!scene.textures.exists(source)||typeof document==='undefined')return false;
 const size=kind==='road'?256:128,tint=kind==='road'?'#6e736f':'#b8b8ae';
 const key=materialTile(scene,'gothic-ground-'+(kind==='road'?'road-v1':'paving-v3'),source,size,tint);
 const x=Math.floor(Math.max(bounds.x,Math.min(...points.map(p=>p.x)))),y=Math.floor(Math.max(bounds.y,Math.min(...points.map(p=>p.y))));
 const w=Math.ceil(Math.min(bounds.x+bounds.w,Math.max(...points.map(p=>p.x)))-x),h=Math.ceil(Math.min(bounds.y+bounds.h,Math.max(...points.map(p=>p.y)))-y);
 if(w<=0||h<=0)return true;
 let cache=scene.groundPolygonCache;
 if(!cache){cache=scene.groundPolygonCache={items:new Map(),bytes:0,serial:0};scene.events.once('shutdown',()=>{for(const v of cache.items.values())scene.textures.remove(v.key);scene.groundPolygonCache=null;});}
 const signature=JSON.stringify([kind,x,y,w,h,points]);
 const cached=cache.items.get(signature);
 if(cached){cache.items.delete(signature);cache.items.set(signature,cached);target.draw(cached.key,x-bounds.x,y-bounds.y);return true;}
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');ctx.translate(-x,-y);ctx.beginPath();
 points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
 ctx.fillStyle=ctx.createPattern(scene.textures.get(key).getSourceImage(),'repeat');ctx.fill();
 const scratch='gothic-ground-polygon-'+cache.serial++;scene.textures.addImage(scratch,canvas);
 target.draw(scratch,x-bounds.x,y-bounds.y);
 const bytes=w*h*4;
 if(bytes>16*1024*1024){scene.textures.remove(scratch);return true;}
 cache.items.set(signature,{key:scratch,bytes});cache.bytes+=bytes;
 while(cache.items.size>64||cache.bytes>16*1024*1024){const [old,v]=cache.items.entries().next().value;scene.textures.remove(v.key);cache.bytes-=v.bytes;cache.items.delete(old);}
 return true;
}
