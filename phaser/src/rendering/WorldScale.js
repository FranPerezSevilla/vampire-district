// Shared art scale. A top-down sprite's footprint is not a standing person's height.
export const WORLD_SCALE=Object.freeze({humanMetres:1.75,humanHeight:24,doorMetres:2.3,storeyMetres:3.4,carLengthMetres:4.4});
export const metresToWorld=metres=>metres*WORLD_SCALE.humanHeight/WORLD_SCALE.humanMetres;
export function scaledBuildingHeight(b){
 if(Number.isFinite(b.renderHeight))return b.renderHeight;
 if(Number.isFinite(b.heightMetres))return metresToWorld(b.heightMetres);
 const floors=b.storeys??(b.skyline?26:b.id==='hospitalEmergency'?1:b.landmark?3:2);
 return metresToWorld(Math.max(1,floors)*(b.storeyMetres??WORLD_SCALE.storeyMetres));
}
// One common attenuation preserves coplanar shared vertices and tower intersections.
export function perspectiveLimit(buildings,camera,settings={}){
 const cx=camera.scrollX+camera.width/2,cy=camera.scrollY+camera.height/2;
 const sx=settings.eastWest??1,sy=settings.northSouth??1;
 let largest=1;
 for(const b of buildings){
  const box=b.towerSourceBounds||b;
  for(const x of [box.x,box.x+box.w])for(const y of [box.y,box.y+box.h]){
   largest=Math.max(largest,Math.hypot((x-cx)*sx/1505,(y-cy)*sy/1505));
  }
 }
 return 1/largest;
}

// Stable projection envelope: resident/culling transitions must not rescale the city.
// Use camera dimensions rather than worldView (which can lag camera follow a frame).
export function viewportPerspectiveLimit(camera,settings={}){
 const zoom=camera.zoom||1,pad=160;
 const width=camera.width/zoom,height=camera.height/zoom;
 const dx=Math.abs(width-camera.width)/2+width/2+pad;
 const dy=Math.abs(height-camera.height)/2+height/2+pad;
 return 1.65/Math.max(1,Math.hypot(dx*(settings.eastWest??1)/1505,dy*(settings.northSouth??1)/1505));
}
