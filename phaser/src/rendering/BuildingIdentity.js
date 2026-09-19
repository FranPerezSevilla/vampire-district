import { architectureFor } from './ArchitecturalProfiles.js';
export function buildingMaterial(b={}) {
 const {roof,wall,trim}=architectureFor(b);return {roof,wall,trim};
}
export function paintLandmarkRoof(g,b) {
 const m=buildingMaterial(b),{x,y,w,h}=b;
 const rect=(a,c,d,e,color)=>g.fillStyle(color,1).fillRect(x+a*w,y+c*h,d*w,e*h);
 const poly=(points,color)=>g.fillStyle(color,1).fillPoints(points.map(([a,c])=>({x:x+a*w,y:y+c*h})),true);
 if(b.campusBarrier==='railing'){
  const horizontal=w>=h;
  g.fillStyle(0x74766f,1);
  for(let n=0;n<(horizontal?w:h);n+=4)g.fillRect(x+(horizontal?n:0),y+(horizontal?0:n),1.2,1.2);
  return true;
 }
 if(b.family==='police-campus'){
  rect(0,0,1,1,0x1c2023);
  if(!b.campusBarrier){
   g.fillStyle(0x666760,1).fillRect(x+1,y+1,w-2,h-2);
   g.fillStyle(0x323639,1).fillRect(x+4,y+4,w-8,h-8);
  }return true;
 }
 if(b.cornerTurret){rect(0,0,1,1,0x343c38);return true;}
 if(b.id==='hospital'||b.id==='hospitalEmergency'){
  const emergency=b.id==='hospitalEmergency';
  rect(0,0,1,1,0x141d1b);
  g.fillStyle(0x4b5146,1).fillRect(x+1,y+1,w-2,h-2);
  g.fillStyle(m.roof,1).fillRect(x+3,y+3,w-6,h-6);
  // A recessed gutter behind the coping makes the edge read as masonry, not a frame.
  g.lineStyle(1.2,0x101b17,.85).lineBetween(x+4,y+4,x+w-4,y+4);
  g.lineBetween(x+4,y+h-4,x+w-4,y+h-4);
  g.lineBetween(x+4,y+4,x+4,y+h-4);g.lineBetween(x+w-4,y+4,x+w-4,y+h-4);
  for(let u=3,i=0;u<w-3;u+=18,i++){
   const stone=[0x50594c,0x414c42,0x596052][i%3];
   g.fillStyle(stone,.55).fillRect(x+u,y+1,Math.min(16,w-u-3),.7);
   g.fillStyle(stone,.3).fillRect(x+u,y+h-2,Math.min(16,w-u-3),.7);
  }
  // Narrow stone coping, measured in world pixels rather than building percentages.
  for(let u=18;u<w-3;u+=18){g.lineStyle(.6,0x151c19,.65).lineBetween(x+u,y+1,x+u,y+3);g.lineBetween(x+u,y+h-3,x+u,y+h-1);}
  for(let v=18;v<h-3;v+=18){g.lineStyle(.6,0x151c19,.65).lineBetween(x+1,y+v,x+3,y+v);g.lineBetween(x+w-3,y+v,x+w-1,y+v);}
  if(!emergency){
   // Four slate slopes meet at a raised ridge, rather than a flat central slab.
   const slope=(points,color)=>{
    poly(points,color);
    const [a,b,c,d]=points,lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
    for(let row=1;row<20;row++){
     const t=row/20,left=lerp(a,d,t),right=lerp(b,c,t);
     g.lineStyle(.55,0x111918,.42).lineBetween(x+left[0]*w,y+left[1]*h,x+right[0]*w,y+right[1]*h);
     const lowerLeft=lerp(a,d,t+.05),lowerRight=lerp(b,c,t+.05);
     for(let col=0;col<12;col++){
      const u=(col+(row%2?.25:.75))/12,p=lerp(left,right,u),q=lerp(lowerLeft,lowerRight,u);
      g.lineStyle(.4,0x131b19,.22).lineBetween(x+p[0]*w,y+p[1]*h,x+q[0]*w,y+q[1]*h);
     }
    }
   };
   slope([[.025,.035],[.975,.035],[.79,.5],[.21,.5]],0x3d4645);
   slope([[.025,.965],[.975,.965],[.79,.5],[.21,.5]],0x293331);
   slope([[.025,.035],[.025,.965],[.21,.5],[.21,.5]],0x343f3b);
   slope([[.975,.035],[.975,.965],[.79,.5],[.79,.5]],0x202b29);
   g.lineStyle(2.2,0x172320,.85).lineBetween(x+w*.21,y+h*.505,x+w*.79,y+h*.505);
   g.lineStyle(1,0x737a6b,.65).lineBetween(x+w*.21,y+h*.5,x+w*.79,y+h*.5);
   for(const [u,v,r] of [[.025,.035,.21],[.025,.965,.21],[.975,.035,.79],[.975,.965,.79]])
    g.lineStyle(.75,0x737b70,.3).lineBetween(x+u*w,y+v*h,x+r*w,y+.5*h);
   // Low glazed rooflight straddles the ridge; restrained metal framing.
   if(!b.assetRoofDetails){rect(.37,.462,.26,.082,0x131d1b);rect(.377,.469,.246,.063,0x40544c);
   rect(.377,.469,.246,.009,0x6b7b6e);
   for(let i=0;i<7;i++)rect(.382+i*.035,.469,.004,.063,0x202d28);}
  }else{
   // Service roof, parapet and a sheltered clinical entrance.
   rect(.06,.78,.88,.16,0x23302c);
  }
  g.fillMaterialPattern?.(x+w*.035,y+h*.045,w*.93,h*.91);
  if(!b.assetRoofDetails)for(const [u,v] of emergency?[[.18,.2],[.58,.42]]:[[.13,.16],[.76,.7]]){
   const vx=x+u*w,vy=y+v*h,vw=emergency?12:21,vh=emergency?10:15;
   g.fillStyle(0x111b18,.65).fillRect(vx+3,vy+3,vw+1,vh+1);
   g.fillStyle(0x4b554e,1).fillRect(vx,vy,vw,vh);
   g.fillStyle(0x222d29,1).fillRect(vx+2,vy+2,vw-4,vh-4);
   for(let i=0;i<4;i++)g.fillStyle(0x697268,.7).fillRect(vx+3,vy+3+i*2,vw-6,.6);
   g.lineStyle(2,0x1c2723,.8).lineBetween(vx+vw/2,vy+vh,vx+vw/2,vy+vh+12);
   g.lineStyle(.7,0x687268,.55).lineBetween(vx+vw/2-1,vy+vh,vx+vw/2-1,vy+vh+12);
  }
  for(const u of [.25,.75]){const dx=x+w*u;g.fillStyle(0x141e1a,1).fillRect(dx,y+h-8,5,5);g.lineStyle(.6,0x687267,.55).lineBetween(dx,y+h-8,dx+5,y+h-8);}
  // Compact medical marker rather than a billboard across the whole roof.
  if(emergency)rect(.46,.39,.02,.085,0x733537);
  if(emergency)rect(.438,.42,.064,.025,0x733537);
  return true;
 }
 if(b.id==='cathedral'||b.family==='cathedral'){
  rect(0,0,1,1,m.wall);
  rect(.06,.06,.88,.88,0x79705e);
  // A cruciform copper roof above the rectangular cloister, seen from overhead.
  poly([[.39,.1],[.5,.07],[.5,.86],[.39,.86]],0x50796a);
  poly([[.5,.07],[.61,.1],[.61,.86],[.5,.86]],0x203e38);
  rect(.13,.37,.74,.13,0x50796a);rect(.13,.5,.74,.1,0x203e38);
  g.lineStyle(2,m.trim,.7).lineBetween(x+w*.5,y+h*.08,x+w*.5,y+h*.86);
  for(const a of [.15,.71]){
   rect(a,.7,.14,.2,0x242927);
   poly([[a,.7],[a+.07,.66],[a+.14,.7],[a+.07,.79]],0x749080);
   poly([[a,.7],[a+.07,.79],[a+.07,.9],[a,.9]],0x476359);
  }
  for(let i=0;i<5;i++){rect(.29,.16+i*.12,.07,.027,0xb6a78b);rect(.64,.16+i*.12,.07,.027,0xb6a78b);}
  return true;
 }
 if(b.id==='police'){
  rect(0,0,1,1,m.roof);
  rect(.04,.04,.92,.92,m.roof);rect(.08,.1,.84,.16,0x101e2a);
  rect(.09,.72,.82,.2,0x64717a);
  for(let i=0;i<7;i++)rect(.12+i*.11,.76,.05,.11,0x1a2936);
  poly([[.38,.31],[.62,.31],[.6,.56],[.5,.66],[.4,.56]],m.trim);
  poly([[.42,.35],[.58,.35],[.56,.53],[.5,.59],[.44,.53]],0x23384a);
  poly([[.5,.38],[.52,.44],[.58,.45],[.53,.49],[.54,.55],[.5,.52],[.46,.55],[.47,.49],[.42,.45],[.48,.44]],m.trim);
  // Rooftop communications mast and red warning lamps.
  g.lineStyle(2,m.trim,.9).lineBetween(x+w*.83,y+h*.3,x+w*.83,y+h*.62);
  for(let i=0;i<3;i++)g.lineBetween(x+w*(.77+i*.015),y+h*(.36+i*.07),x+w*(.89-i*.015),y+h*(.36+i*.07));
  rect(.08,.08,.018,.02,0xa94446);rect(.9,.08,.018,.02,0xa94446);
  return true;
 }
 return false;
}
