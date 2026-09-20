export function relatedVolumes(a,b){
 return a!==b&&(a.parentBuildingId===b.id||b.parentBuildingId===a.id||!!a.parentBuildingId&&a.parentBuildingId===b.parentBuildingId||!!a.streetBlockId&&a.streetBlockId===b.streetBlockId);
}
// Horizontal UV intervals exposed at this height, excluding surfaces inside attachments.
export function exposedWallSpans(building,a,c,height,neighbours,heightOf){
 const horizontal=a.y===c.y,start=horizontal?a.x:a.y,length=horizontal?c.x-a.x:c.y-a.y;
 let spans=[[0,1]];
 for(const other of neighbours){
  if(!relatedVolumes(building,other)||heightOf(other)<height-.001)continue;
  const cross=horizontal?a.y:a.x,low=horizontal?other.y:other.x,high=low+(horizontal?other.h:other.w);
  const joinedCathedral=building.cathedralKind&&other.cathedralKind&&cross>=low-.001&&cross<=high+.001;
  const joinedBlock=building.streetBlockId&&building.streetBlockId===other.streetBlockId&&cross>=low-.001&&cross<=high+.001;
  if(!joinedCathedral&&!joinedBlock&&(cross<=low+.001||cross>=high-.001))continue;
  const lo=((horizontal?other.x:other.y)-start)/length,hi=lo+(horizontal?other.w:other.h)/length;
  spans=spans.flatMap(([l,r])=>hi<=l||lo>=r?[[l,r]]:[[l,Math.min(r,lo)],[Math.max(l,hi),r]].filter(([x,y])=>y-x>.00001));
 }
 return spans;
}
