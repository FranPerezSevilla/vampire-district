// Authored assemblies of shared image sections, built once per archetype.
// x/y are in the original 34 x 16 sedan footprint; z is actual visual height.
export const STACK_PROFILES = Object.freeze({
  sedan: {height:10.1}, executive:{height:10.5,cabinLength:1.1},
  compact:{height:9.2,cabinX:-4,cabinLength:1.06},
  hatchback:{height:9.7,cabinX:-4,cabinLength:1.18},
  taxi:{height:10.1,extra:'taxi'},
  muscle:{height:8.6,cabinX:-4.3,cabinLength:.8,cabinWidth:.92,extra:'stripes'},
  sports:{height:7.8,cabinX:-4.5,cabinLength:.83,cabinWidth:.88,extra:'stripes'},
  coupe:{height:8.9,cabinX:-4,cabinLength:.9,extra:'rust'},
  junker:{height:9,cabinX:-3.5,cabinLength:1.02,extra:'rust'},
  suv:{height:12.4,deck:6.5,cabinX:-2,cabinLength:1.28,cabinWidth:1.05,extra:'rails'},
  pickup:{height:11.2,deck:5.8,cabinX:6,cabinLength:.65,extra:'bed'},
  van:{height:13.7,deck:5.8,cabinX:10,cabinLength:.52,cargo:'van'},
  'delivery-van':{height:14.5,deck:5.8,cabinX:10,cabinLength:.52,cargo:'van'},
  ambulance:{height:15.2,deck:5.8,cabinX:10,cabinLength:.52,cargo:'medical'},
  bus:{height:14.2,deck:5.8,bus:true},
  limousine:{height:10.5,cabinLength:1.25},
  hearse:{height:11.8,deck:5.6,cabinX:9,cabinLength:.58,cargo:'funeral'},
  'police-cruiser':{height:10.1,extra:'police'},
  'police-interceptor':{height:8.8,cabinX:-4.3,cabinLength:.86,extra:'police'},
  'police-suv':{height:12.4,deck:6.5,cabinX:-2,cabinLength:1.28,cabinWidth:1.05,extra:'police'},
  'police-unmarked':{height:10.1,extra:'unmarked'}
});

export const STACK_FRAME_BOUNDS = Object.freeze([
  [4,5,39,20], [20,12,8,4], [6,6,36,16], [6,5,36,18], [6,5,36,18],
  [8,6,33,16], [6,5,36,18], [11,7,21,14], [13,8,17,12], [14,9,15,10],
  [15,9,13,10], [17,11,7,7], [30,8,8,12], [6,5,36,18], [9,8,28,12],
  [6,5,36,18], [7,6,34,16], [29,6,11,16], [7,7,16,14], [20,11,8,6],
  [21,7,6,14], [7,5,34,18], [13,9,14,10], [9,8,28,12], [7,6,26,16],
  [8,10,31,8], [7,6,34,16], [25,4,5,20], [7,5,34,18], [8,6,28,16],
  [7,5,34,18], [9,6,28,16],
  [4,4,40,20], [4,4,40,20], [4,4,40,20], [4,4,40,20],
  [4,4,40,20], [4,4,40,20], [16,7,16,14], [4,4,40,20]
]);

const models = new Map();
export function vehicleStackModel(archetype) {
  const profile = STACK_PROFILES[archetype.bodyStyle || archetype.id];
  if (!profile || !(archetype.width > 0 && archetype.height > 0)) return null;
  const key = `${archetype.bodyStyle}:${archetype.width}:${archetype.height}`;
  if (models.has(key)) return models.get(key);
  const sx=archetype.width/34, sy=archetype.height/16*.94, layers=[];
  const add=(frame,z,material,options={})=>layers.push({frame,z,material,...options});
  const deck=profile.deck||5.1, box=profile.cargo||profile.bus;
  // Sloping image planes join the horizontal sections. Their shared vertices
  // describe real shoulders/glazing instead of a pyramid of smaller stickers.
  const face=(frame,material,corners,options={})=>{
    const z=Math.min(...corners.map(p=>p[2]));
    layers.push({frame,z,material,corners,...options});
  };
  const sides=(x0,x1,y0,y1,z0,z1,frame,material='body',inset=0)=>{
    face(frame,material,[[x0+inset,y1-inset,z1],[x0,y1,z0],[x1,y1,z0],[x1-inset,y1-inset,z1]]);
    face(frame,material,[[x1-inset,y0+inset,z1],[x1,y0,z0],[x0,y0,z0],[x0+inset,y0+inset,z1]]);
  };
  add(0,0);add(2,.3);
  for(const [wheel,[x,y]] of [[-9.86,-7.1],[9.86,-7.1],[-9.86,7.1],[9.86,7.1]].entries())add(1,.8,'wheel',{wheel,x,y,scaleY:.55});
  // Tyre sidewalls tuck beneath the curved wheel arches, not square blocks
  // stuck on the outside. The far faces disappear naturally with projection.
  for(const [wheel,[x,y]] of [[-9.86,-7.7],[9.86,-7.7],[-9.86,7.7],[9.86,7.7]].entries()){
    const order=y>0?1:-1;
    face(38,'wheelFace',[[x-3*order,y,3.65],[x-3*order,y,0],[x+3*order,y,0],[x+3*order,y,3.65]],{wheel});
  }
  sides(-14.6,14.6,-7.5,7.5,1.2,deck,34);
  // Bevelled end corners preserve the long sedan silhouette at every heading.
  for(const sign of [-1,1]){
    const end=sign*16.7,shoulder=sign*14.6;
    face(sign>0?36:37,'trim',sign>0?
      [[end,5.7,deck-.25],[end,5.7,1.2],[end,-5.7,1.2],[end,-5.7,deck-.25]]:
      [[end,-5.7,deck-.25],[end,-5.7,1.2],[end,5.7,1.2],[end,5.7,deck-.25]]);
    for(const side of [-1,1]){
      let corners=[[shoulder,side*7.5,deck],[shoulder,side*7.5,1.2],[end,side*5.7,1.2],[end,side*5.7,deck-.25]];
      if(sign*side<0)corners=corners.slice().reverse();
      face(35,'body',corners);
    }
  }
  add(box?15:4,deck-.16,'body');add(5,deck,'body');
  add(6,deck+.04,'trim');add(12,deck+.06,'hood');
  const cx=profile.cabinX??-2.7,cl=profile.cabinLength||1,cw=profile.cabinWidth||1;
  const cabin=(frame,z,material)=>add(frame,z,material,{scaleX:cl,scaleY:cw,x:cx+2.7*cl});
  let top=profile.height;
  if(profile.bus){
    sides(-16,16,-7.4,7.4,deck,top,39,'glass',.35);
    face(32,'glass',[[15.5,7,top],[16.7,7,deck],[16.7,-7,deck],[15.5,-7,top]]);
    add(16,top,'body');add(23,top+.1,'trim');add(17,deck+3.6,'glass');
  }else{
    const cabinTop=profile.cargo?10.6:top;
    const rear=cx-9.5*cl,front=cx+9.5*cl,roofRear=cx-6.1*cl,roofFront=cx+6.1*cl;
    const waist=6*cw,roof=4.65*cw;
    face(32,'glass',[[roofFront,roof,cabinTop],[front,waist,deck],[front,-waist,deck],[roofFront,-roof,cabinTop]]);
    face(32,'glass',[[roofRear,-roof,cabinTop],[rear,-waist,deck],[rear,waist,deck],[roofRear,roof,cabinTop]]);
    face(33,'glass',[[roofRear,roof,cabinTop],[rear,waist,deck],[front,waist,deck],[roofFront,roof,cabinTop]]);
    face(33,'glass',[[roofFront,-roof,cabinTop],[front,-waist,deck],[rear,-waist,deck],[roofRear,-roof,cabinTop]]);
    cabin(10,cabinTop,'body');
    // Mirrors belong near the waist, not floating beside the highest roof.
    add(27,deck+.8,'trim',{x:cx+2.7*cl+(cl-1)*3});
    if(profile.cargo){
      sides(-16.2,5.5,-7.4,7.4,deck,top,35);
      face(35,'body',[[-16.2,-7.4,top],[-16.2,-7.4,deck],[-16.2,7.4,deck],[-16.2,7.4,top]]);
      face(35,'body',[[5.5,7.4,top],[5.5,7.4,cabinTop],[5.5,-7.4,cabinTop],[5.5,-7.4,top]]);
      add(16,top,'body',{x:-5.4,scaleX:.68,scaleY:.96});
      add(profile.cargo==='funeral'?24:26,top+.06,'trim',{x:-5.4,scaleX:.68,scaleY:.96});
      if(profile.cargo==='medical'){
        add(30,deck+2,'trim');add(22,top+.12,'trim');
        add(20,top+.55,'trim',{x:2.5,scaleX:.85,scaleY:.92});
      }
    }
  }
  if(profile.extra==='bed')add(18,deck+.1,'trim');
  if(profile.extra==='stripes')add(25,deck+.1,'trim');
  if(profile.extra==='rust')add(29,deck+.1,'trim');
  if(profile.extra==='rails')add(31,top+.1,'trim',{scaleX:.72,x:-1});
  if(profile.extra==='taxi')add(19,top+.5,'trim',{x:cx});
  if(profile.extra==='police'){
    add(21,deck+.12,'trim');add(20,top+.6,'trim',{x:cx});
  }
  if(profile.extra==='unmarked')add(20,deck+.8,'trim',{x:10,scaleX:.6,scaleY:.55});
  layers.sort((a,b)=>a.z-b.z);
  let extentX=0,extentY=0,maxHeight=0;
  const slices=layers.map(layer=>{
    if(layer.corners){
      const corners=layer.corners.map(([x,y,z])=>Object.freeze([x*sx,y*sy,z]));
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),zs=corners.map(p=>p[2]);
      const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
      extentX=Math.max(extentX,...xs.map(Math.abs));extentY=Math.max(extentY,...ys.map(Math.abs));maxHeight=Math.max(maxHeight,...zs);
      return Object.freeze({...layer,x,y,w,h,corners:Object.freeze(corners)});
    }
    const [left,upper,width,height]=STACK_FRAME_BOUNDS[layer.frame];
    const kx=(layer.scaleX??1)*sx,ky=(layer.scaleY??1)*sy;
    const x=((layer.x||0)*sx)+(left-24)*kx,y=((layer.y||0)*sy)+(upper-14)*ky;
    const w=width*kx,h=height*ky;
    extentX=Math.max(extentX,Math.abs(x),Math.abs(x+w));extentY=Math.max(extentY,Math.abs(y),Math.abs(y+h));maxHeight=Math.max(maxHeight,layer.z);
    return Object.freeze({...layer,x,y,w,h});
  });
  const model=Object.freeze({slices:Object.freeze(slices),width:extentX*2,height:extentY*2,maxHeight,
    lamps:Object.freeze({front:15.7*sx,rear:-15.5*sx,halfTrack:4.7*sy,z:deck-.35}),
    badge:profile.bus?{x:-archetype.width*.06,y:0,z:top+.2}:null});
  models.set(key,model);return model;
}
