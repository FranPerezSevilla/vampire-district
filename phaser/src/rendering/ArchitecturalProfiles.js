// Visual grammar only: footprints, collision and gameplay remain compiler-owned.
const seedOf=value=>[...String(value)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);
import { buildingEntrances } from './BuildingEntrances.js';
export const ARCHITECTURAL_PROFILES=Object.freeze({
 institutional:Object.freeze({cornerButtresses:true,bay:55,window:'lancet',piers:true,cornice:3,base:'arcade',roof:0x292f30,wall:0x45433f,trim:0x8b8270}),
 tenement:Object.freeze({bay:42,window:'lintel',piers:false,cornice:2,base:'shop',roof:0x332c30,wall:0x483b39,trim:0x81756b}),
 industrial:Object.freeze({bay:60,window:'grid',piers:true,cornice:1,base:'shutter',roof:0x303333,wall:0x3d3632,trim:0x756d60}),
 deco:Object.freeze({bay:48,window:'tall',piers:true,cornice:3,base:'portal',roof:0x30333b,wall:0x373b43,trim:0x928574}),
 tower:Object.freeze({bay:36,window:'ribbon',piers:true,cornice:1,base:'portal',roof:0x292e34,wall:0x30363b,trim:0x677175})
});
export function architectureFor(b={}){
 const id=String(b.id||'building').replace(/:tower-wing.*$/,'');
 const seed=seedOf(b.parentBuildingId||id);
 const identity=id==='hospital'||id==='hospitalEmergency'||b.family==='hospital'?'hospital':id==='cathedral'||b.family==='cathedral'?'cathedral':id==='police'?'police':null;
 const fallback=identity==='hospital'||identity==='cathedral'?'institutional':identity==='police'?'deco':b.skyline?'tower':b.family==='industrial'?'industrial':['tenement','industrial','deco'][seed%3];
 const key=Object.hasOwn(ARCHITECTURAL_PROFILES,b.architecture)?b.architecture:fallback;
 const base=ARCHITECTURAL_PROFILES[key],shift=[-5,0,4][(seed>>>3)%3];
 const tone=color=>[16,8,0].reduce((n,bits)=>n|(Math.max(0,Math.min(255,((color>>>bits)&255)+shift))<<bits),0);
 return {key,...base,roof:tone(base.roof),wall:tone(base.wall),seed,sign:b.cornerTurret?null:identity==='hospital'?null:identity==='police'?'POLICE':null,medical:identity==='hospital'};
}
export function architectureBays(b,length){
 const p=architectureFor(b),cols=Math.max(1,Math.min(32,Math.floor(length/p.bay))),rows=b.skyline?4:p.cornerButtresses?1:2;
 const bays=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  if(p.cornerButtresses&&cols>1&&(c===0||c===cols-1))continue;
  // Solid vertical bays interrupt the grid; isolated upper blanks add a repair rhythm.
  if(cols>3&&(c+p.seed%3)%4===3)continue;
  if(cols>4&&r===rows-1&&(c+p.seed)%7===1)continue;
  const index=r*cols+c;
  bays.push({u:(c+.39)/cols,v:.38+r*.52/rows,w:.22/cols,h:.29/rows,index,lit:(p.seed+index*17)%19<4});
 }
 return {profile:p,cols,rows,bays};
}
// Modules are painted into the resident facade bitmap, never individual scene objects.
export function paintArchitecture(g,b,a,c,o,material,project){
 const length=Math.hypot(c.x-a.x,c.y-a.y);if(length<12)return;
 const {profile:p,cols,rows,bays}=architectureBays(b,length);
 const poly=(points,color,alpha=1)=>g.fillStyle(color,alpha).fillPoints(points.map(([u,v])=>project(a,c,o,u,v,0,0)[0]),true);
 const rect=(u,v,w,h,color,alpha=1)=>g.fillStyle(color,alpha).fillPoints(project(a,c,o,u,v,w,h),true);
 const trim=material.trim,dark=0x111517;
 if(b.cornerTurret){
  rect(.02,0,.06,1,trim,.22);rect(.92,0,.06,1,dark,.45);
  for(const v of [.25,.67])g.paintOpening?.({u:.37,v,w:.26,h:.19,lit:false});
  return;
 }
 const opening=(u,v,w,h,color,alpha=1)=>p.window==='lancet'?poly([[u,v],[u+w,v],[u+w,v+h*.72],[u+w*.5,v+h],[u,v+h*.72]],color,alpha):rect(u,v,w,h,color,alpha);
 // Base, sill band and cornice establish a continuous architectural section.
 if(!p.medical){
 rect(0,0,1,.29,0x171a1b,.48);
 for(let i=0;i<3;i++)rect(0,.06+i*.08,1,.006,trim,.13);
 rect(0,.29,1,.018,dark,.8);rect(0,.308,1,.018,trim,.55);
 for(let i=0;i<p.cornice;i++){rect(0,.92+i*.024,1,.012,trim,.48);rect(0,.932+i*.024,1,.01,dark,.6);}
 }
 if(p.piers)for(let i=0;i<=cols;i++){
  const u=Math.min(.984,Math.max(0,i/cols-.008));
  rect(u,p.medical?.025:.33,.016,p.medical?.94:.59,trim,.26);rect(u+.012,p.medical?.025:.33,.004,p.medical?.94:.59,dark,.6);
  if(p.key==='deco')rect(u,.87,.016,.035,trim,.55);
 }
 for(const q of bays){
  const {u,v,w,h,index}=q;
  if(p.sign&&!b.materialSide&&v+h>.72&&u<.78&&u+w>.22)continue;
  if(g.paintOpening&&p.cornerButtresses){g.paintOpening(q);continue;}
  opening(u-.004,v-.009,w+.008,h+.018,trim,.65);opening(u,v,w,h,dark);
  if(q.lit)rect(u+w*.12,v+h*.13,w*.76,h*.45,0xb89b62,.47);
  rect(u+w*.48,v,w*.04,h*.77,trim,.55);
  if(p.window==='grid')for(let k=1;k<3;k++)rect(u,v+h*k/3,w,.006,trim,.5);
  if(p.window==='lintel'){rect(u-.008,v+h+.016,w+.016,.012,trim,.7);rect(u-.008,v-.015,w+.016,.012,dark,.8);}
  if(p.window==='tall'){rect(u+w*.2,v+h*.78,w*.6,.015,trim,.5);}
 }
 const entry=Math.floor(cols/2),authoredDoors=buildingEntrances(b);
 if(authoredDoors.length&&g.paintPortal){
  const w=.32/cols;
  for(const door of authoredDoors.filter(d=>d.side===(b.facadeSide||'south')))g.paintPortal(door.at-w/2,w);
 }
 for(let col=0;col<cols;col++){
  if(p.cornerButtresses&&cols>1&&col!==entry&&(col===0||col===cols-1))continue;
  if(col!==entry&&cols>3&&(col+p.seed%3)%4===3)continue;
  const w=.32/cols,u=p.cornerButtresses&&cols<3&&col===entry?.5-w/2:(col+.34)/cols;
  if(col===entry&&p.cornerButtresses&&g.paintPortal){if(!authoredDoors.length)g.paintPortal(u,w);continue;}
  rect(u-.006,.025,w+.012,.235,trim,.35);rect(u,.03,w,.215,dark);
  if(col===entry){
   rect(u+w*.48,.03,w*.035,.205,trim,.6);rect(u+w*.68,.13,w*.04,.015,0xbaaa7d);
   rect(u-.012,.26,w+.024,.027,trim,.8);rect(u-.012,.246,w+.024,.014,dark,.9);
  }else if(p.base==='shutter'){
   rect(u,.035,w,.19,0x414446,.6);for(let r=0;r<5;r++)rect(u,.05+r*.032,w,.008,dark,.65);
  }else{
   rect(u+w*.12,.075,w*.76,.12,0x5f6863,.23);
   for(let r=1;r<4;r++)rect(u+w*r/4,.05,w*.025,.16,trim,.45);
  }
 }
 // Solid terminal buttresses: reusable supports for a later rooftop turret module.
 if(p.cornerButtresses&&b.id!=='hospital'&&!b.turrets){
  const w=Math.min(.14,.64/cols);
  for(const u of [.018,1-.018-w]){
   rect(u,.012,w,.952,0x333635);
   g.paintStone?.(u,.012,w,.952);
   rect(u,.012,w*.18,.952,trim,.42);
   rect(u+w*.78,.012,w*.22,.952,dark,.65);
   rect(u+w*.2,.08,w*.54,.80,trim,.12);
   // Recessed pointed niches, block joints and stepped plinth add weight.
   poly([[u+w*.3,.39],[u+w*.7,.39],[u+w*.7,.79],[u+w*.5,.87],[u+w*.3,.79]],dark,.8);
   rect(u+w*.47,.42,w*.06,.35,trim,.22);
   for(let j=0;j<7;j++)rect(u,.12+j*.105,w,.006,dark,.32);
   rect(u-.009,.015,w+.018,.04,trim,.55);
   rect(u-.006,.055,w+.012,.015,dark,.65);
   for(const v of p.medical?[.035]:[.035,.32,.91]){rect(u-.004,v,w+.008,.016,trim,.55);rect(u-.004,v-.009,w+.008,.009,dark,.7);}
   poly([[u,.952],[u+w*.5,.99],[u+w,.952]],trim,.5);
  }
 }
 // Sparse grime and repairs share a stable identity across camera movements.
 for(let i=0;i<Math.min(cols,12);i++){
  const u=((p.seed+i*37)%97)/100;
  rect(u,.33,.008,.10+((p.seed+i)%7)*.035,0x111716,.14);
 }
 rect(.978,.03,.007,.87,dark,.75);
}
