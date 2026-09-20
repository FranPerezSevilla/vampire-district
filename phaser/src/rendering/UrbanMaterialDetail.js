import { paintArchitecture } from './ArchitecturalProfiles.js';
export function facadePanel(a,b,o,u,v,w,h) {
 const point=(s,t)=>({x:a.x+(b.x-a.x)*s+(o.x+(o.spread||0)*(a.x+(b.x-a.x)*s-(o.cx||0)))*t,y:a.y+(b.y-a.y)*s+(o.y+(o.spread||0)*(a.y+(b.y-a.y)*s-(o.cy||0)))*t});
 return [point(u,v),point(u+w,v),point(u+w,v+h),point(u,v+h)];
}
const hash=s=>[...String(s)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);
export function facadeLayout(length, projectedHeight, skyline=false) {
 const cols=Math.max(1,Math.floor(length/32));
 const rows=Math.max(1,Math.min(skyline?6:3,Math.floor(projectedHeight/19)));
 const bays=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const step=.54/rows;
  bays.push({u:(col+.29)/cols,v:.37+row*step,w:.42/cols,h:step*.60});
 }
 return {cols,rows,bays};
}
export function paintFacadeDetail(g,b,a,c,o,material) {
 paintArchitecture(g,b,a,c,o,material,facadePanel);
}
// World-space staggered slabs: clipping never changes the tile colour or phase.
export function pavementSlabs(rect, courtyard = false) {
 const tw=courtyard?7:11, th=courtyard?5:8, tiles=[];
 for(let row=Math.floor(rect.y/th);row*th<rect.y+rect.h;row++) {
  const dy=row*th, offset=((row%2+2)%2)*tw/2;
  const boundary=col=>col*tw+offset+(hash(`${col}:${row}:edge`)%5-2)*.35;
  for(let col=Math.floor((rect.x-offset)/tw)-1;col*tw+offset<rect.x+rect.w+tw;col++) {
   const dx=boundary(col), end=boundary(col+1),seed=hash(`${col}:${row}:stone`);
   const x=Math.max(dx+.3,rect.x),y=Math.max(dy+.3,rect.y);
   const r=Math.min(end-.3,rect.x+rect.w),bottom=Math.min(dy+th-.3,rect.y+rect.h);
   if(r>x&&bottom>y)tiles.push({x,y,w:r-x,h:bottom-y,dx,dy,tw:end-dx,th,seed});
  }
 }
 return tiles;
}
function clipStone(points,r){
 for(const [axis,edge,sign] of [['x',r.x,1],['x',r.x+r.w,-1],['y',r.y,1],['y',r.y+r.h,-1]]){
  const out=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],ia=(a[axis]-edge)*sign>=0,ib=(b[axis]-edge)*sign>=0;
   if(ia)out.push(a);
   if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  points=out;
 }
 return points;
}
export function paintPavementWear(g,rect,courtyard=false) {
 g.fillStyle(courtyard?0x1c211f:0x282e2b,1).fillRect(rect.x,rect.y,rect.w,rect.h);
 const colors=courtyard?[0x272d28,0x2a2f2a,0x252b27,0x2d322c,0x282e29]:[0x363e37,0x3a4039,0x343c36,0x393f38,0x3c423a];
 for(const t of pavementSlabs(rect,courtyard)) {
  const {seed,dx,dy,tw,th}=t,chip=.35+(seed%4)*.15;
  const l=dx+.3,r=dx+tw-.3,top=dy+.3,bottom=dy+th-.3;
  const points=clipStone([{x:l+chip,y:top},{x:r-.6,y:top},{x:r,y:top+.6},{x:r,y:bottom-chip},{x:r-chip,y:bottom},{x:l+.5,y:bottom},{x:l,y:bottom-.5},{x:l,y:top+chip}],rect);
  g.fillStyle(colors[seed%colors.length],1).fillPoints(points,true);
  // Occasional chipped/repaired stone, fully clipped with the same world phase.
  if(seed%9===0){
   const patch=clipStone([{x:l+1,y:top+1},{x:r-1,y:top+1.5},{x:r-2,y:bottom-1},{x:l+2,y:bottom-1}],rect);
   if(patch.length>2)g.fillStyle(seed%3?0x242f27:0x89907b,.12).fillPoints(patch,true);
  }
 }
}
export function paintAsphaltWear(g,r) {
 for(let y=Math.ceil((r.y+5)/72)*72;y<r.y+r.h-19;y+=72)for(let x=Math.ceil((r.x+5)/72)*72;x<r.x+r.w-29;x+=72){
  const n=hash(`${x}:${y}:asphalt`);if(n%4===0)continue;
  const w=16+n%12,h=6+(n>>>6)%10;
  g.fillStyle(n%3?0x121819:0x5b5547,n%3?.23:.12).fillPoints([{x,y},{x:x+w*.8,y:y-2},{x:x+w,y:y+h*.6},{x:x+w*.6,y:y+h},{x:x+3,y:y+h-1}],true);
  if(n%5===0)g.lineStyle(1,0x889187,.18).lineBetween(x+3,y+1,x+w*.65,y);
 }
}
