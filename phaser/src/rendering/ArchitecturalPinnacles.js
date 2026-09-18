import { architectureFor, architectureBays } from './ArchitecturalProfiles.js';
// Cache world-space square volumes; project only when the building camera changes.
export function createPinnacleModel(b){
 if(b.cornerTurret)return [{x:b.x+b.w/2,y:b.y+b.h/2,shoulder:0,ring:[{x:b.x,y:b.y,z:0},{x:b.x+b.w,y:b.y,z:0},{x:b.x+b.w,y:b.y+b.h,z:0},{x:b.x,y:b.y+b.h,z:0}],tip:{x:b.x+b.w/2,y:b.y+b.h/2,z:b.capHeight}}];
 if(b.id==='hospital'||b.turrets)return [];
 if(!architectureFor(b).cornerButtresses||b.w<180)return [];
 const {cols}=architectureBays(b,b.w),width=b.w*Math.min(.14,.64/cols),half=width/2;
 return [b.x+b.w*.018+half,b.x+b.w*(1-.018)-half].map(x=>{
  const y=b.y+b.h-half;
  return {x,y,ring:[[-half,-half],[half,-half],[half,half],[-half,half]].map(([dx,dy])=>({x:x+dx,y:y+dy,z:0})),tip:{x,y,z:89}};
 });
}
export function projectPinnaclePoint(p,o,height){
 const t=1+p.z/height;
 return {x:p.x+(o.x+(p.x-o.cx)*(o.spreadX??o.spread))*t,y:p.y+(o.y+(p.y-o.cy)*(o.spreadY??o.spread))*t};
}
export function paintRoofPinnacles(g,model,o,height){
 const project=p=>projectPinnaclePoint(p,o,height);
 const polygon=(points,color,material)=>{const shape=points.map(project);g.fillStyle(color,1).fillPoints(shape,true);if(material)g.materialFace?.(shape,material,color);};
 for(const tower of model){
  const shoulder=tower.shoulder??28,ring=tower.ring,top=ring.map(p=>({...p,z:shoulder}));
  const direction={x:o.x+(tower.x-o.cx)*(o.spreadX??o.spread),y:o.y+(tower.y-o.cy)*(o.spreadY??o.spread)};
  // Far sides first; the facing sides cover them as perspective changes quadrant.
  const edges=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return {i,rank:(a.x+b.x-2*tower.x)*direction.x+(a.y+b.y-2*tower.y)*direction.y};}).sort((a,b)=>b.rank-a.rank);
  const stone=[0x373d38,0x252d2b,0x454944,0x626457];
  for(const {i,rank} of edges){
   if(!shoulder)continue;
   const j=(i+1)%ring.length;
   polygon([ring[i],ring[j],top[j],top[i]],stone[i],'stone');
   if(rank<0&&!g.materialFace){
    const at=(u,z)=>({x:ring[i].x+(ring[j].x-ring[i].x)*u,y:ring[i].y+(ring[j].y-ring[i].y)*u,z});
    // Recessed stone surround and inner lancet, consistent with the shaft below.
    polygon([at(.25,5),at(.75,5),at(.75,20),at(.5,26),at(.25,20)],0x797768);
    polygon([at(.31,6),at(.69,6),at(.69,19),at(.5,23),at(.31,19)],0x111b18);
    polygon([at(.48,7),at(.52,7),at(.52,20),at(.48,20)],0x4b554a);
    for(const z of [3,12,22]){
     polygon([at(0,z),at(.23,z),at(.23,z+.35),at(0,z+.35)],0x222b26);
     polygon([at(.77,z),at(1,z),at(1,z+.35),at(.77,z+.35)],0x222b26);
    }
   }
  }
  // Stepped square cornice, including vertical returns instead of a flat rim.
  const ledge=ring.map(p=>({x:tower.x+(p.x-tower.x)*1.03,y:tower.y+(p.y-tower.y)*1.03,z:shoulder}));
  const lip=ledge.map(p=>({...p,z:shoulder+3}));
  for(const {i} of edges)polygon([ledge[i],ledge[(i+1)%ring.length],lip[(i+1)%ring.length],lip[i]],stone[i]);
  polygon(lip,0x62676b);
  const slate=[0x37413f,0x192320,0x28322f,0x56615a];
  for(const {i} of edges){
   const a=lip[i],b=lip[(i+1)%ring.length];
   polygon([a,b,tower.tip],slate[i],'slate');
   // A narrow ridge highlight preserves a crisp angular silhouette at gameplay scale.
   const near={x:a.x+(b.x-a.x)*.025,y:a.y+(b.y-a.y)*.025,z:a.z};
   if(!g.materialFace)polygon([a,near,tower.tip],i===3?0x76806b:0x405345);
  }
 }
}
