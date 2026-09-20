// Read-only broad phase for immutable authored city surfaces. Exact polygon/rectangle
// predicates remain in district.js, including their original boundary semantics.
export function surfacePointQuery(areas,contains,cellSize=128){
 const cells=new Map();
 for(const area of areas){
  const points=area.points;
  const xs=Array.isArray(points)&&points.length>=3?points.map(p=>p.x):[area.x,area.x+area.w];
  const ys=Array.isArray(points)&&points.length>=3?points.map(p=>p.y):[area.y,area.y+area.h];
  const x0=Math.floor(Math.min(...xs)/cellSize),x1=Math.floor(Math.max(...xs)/cellSize),y0=Math.floor(Math.min(...ys)/cellSize),y1=Math.floor(Math.max(...ys)/cellSize);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=x+':'+y,bucket=cells.get(key)||[];bucket.push(area);cells.set(key,bucket);}
 }
 return (x,y)=>{const bucket=cells.get(Math.floor(x/cellSize)+':'+Math.floor(y/cellSize));if(!bucket)return false;for(const area of bucket)if(contains(x,y,area))return true;return false;};
}
