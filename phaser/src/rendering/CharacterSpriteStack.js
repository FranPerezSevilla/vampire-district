import {viewportPerspectiveLimit} from './WorldScale.js';

export const CHARACTER_STACK_ATLAS = Object.freeze({key:'human-stack-v1', cell:24, columns:4, frames:32, resolution:8});
export const CHARACTER_STACK_BOUNDS = Object.freeze([
  [2,8,20,8],[8,8,8,10],[9,8,6,8],[9,9,6,6],
  [6,9,12,6],[5,8,14,8],[3,8,18,8],[5,8,14,8],
  [9,8,6,8],[10,9,4,5],[9,10,6,4],[8,7,8,10],
  [7,7,10,10],[7,7,10,10],[7,7,10,10],[7,7,10,10],
  [6,6,12,12],[7,6,10,6],[8,7,8,4],[10,1,5,12],
  [10,0,4,16],[4,8,16,8],[7,7,10,10],[8,0,8,8],
  [7,5,10,14],[3,4,18,16],[3,4,18,16],[3,4,18,16],
  [10,3,4,9],[7,5,10,14],[3,4,18,16],[7,3,10,17]
]);
const PERSPECTIVE = Object.freeze({eastWest:4,northSouth:4});
const BODY_PROFILE=[.68,.70,.73,.77,.82,.88,.95,1,1,.94];
const HEAD_PROFILE=[.67,.80,.90,.95,.97,.97,.91,.78];
const shade=(color,k)=>((Math.min(255,(color>>16&255)*k)<<16)|(Math.min(255,(color>>8&255)*k)<<8)|Math.min(255,(color&255)*k));

export function characterStackProjection(x,y,camera,out={}) {
  const factor=4*viewportPerspectiveLimit(camera,PERSPECTIVE)/1505;
  const dx=(x-camera.scrollX-camera.width/2)*factor;
  const dy=(y-camera.scrollY-camera.height/2)*factor;
  const limit=.72/Math.sqrt(1+dx*dx+dy*dy);
  out.x=dx*limit;
  out.y=dy*limit-.32;
  return out;
}

export function characterInsideCamera(host,camera,scale=1) {
  const v=camera?.worldView;
  if (!v || camera.rotation || host.parentContainer) return true;
  const radius=72*Math.max(Math.abs(host.scaleX??1),Math.abs(host.scaleY??1))*scale+8;
  return host.x+radius>=v.x && host.x-radius<=v.x+v.width
    && host.y+radius>=v.y && host.y-radius<=v.y+v.height;
}

// A reusable articulated assembly. Poses update these records in place; they
// never create Phaser objects or textures. North is the local forward axis.
export class CharacterStackRig {
  constructor(style) {
    this.style=style;this.layers=[];
    const part=(frame,tint=0xffffff,sx=1,sy=1)=>{
      const p={frame,tint,sx,sy,order:this.layers.length,alpha:1,z:0,corners:new Float32Array(8),heights:new Float32Array(4),normalX:0,normalY:0};
      this.layers.push(p);return p;
    };
    this.shadow=part(0);
    this.legs=[-1,1].map(side=>({side,boots:[part(1,style.shoe),part(2,style.shoe)],
      leg:Array.from({length:7},(_,i)=>part(3,shade(style.trouser,.7+i*.065)))}));
    this.hips=[part(4,style.trouser),part(4,style.bodyDark)];
    const sw=style.shoulderWidth/16;
    this.body=BODY_PROFILE.map((v,i)=>part(6,shade(style.body,.66+i*.047),sw*v,.84));
    this.seams=part(7,0xffffff,sw);
    this.neck=part(10,style.skin);
    this.head=HEAD_PROFILE.map(v=>part(11,shade(style.skin,.88),v*.80,v*.80));
    this.hair=Array.from({length:3},(_,i)=>part(style.cap?16:style.headwear==='beanie'?22:style.headwear==='cap'?16:12+(style.hairVariant||0),
      shade(style.cap?style.body:style.headwear?style.bodyDark:style.hair,.88+i*.05),.81-i*.045,.81-i*.025));
    this.peak=style.cap||style.headwear==='cap'?part(17):null;
    this.glasses=style.glasses?part(18,0xffffff,.86,.86):null;
    this.badge=style.badge?part(21):null;
    this.face=part(style.glasses?29:24,style.skin);
    this.front=part(style.cap?26:style.glasses?25:27,shade(style.body,1.25));
    this.back=part(30,shade(style.body,1.1));
    this.arms=[-1,1].map(side=>({side,sleeve:Array.from({length:6},(_,i)=>part(8,shade(style.sleeve,1-i*.055),.82,.8)),
      hand:[part(9,style.skin),part(9,style.skin)]}));
    this.weapon=part(19);this.flash=part(23);
    this.cigarette=part(28);this.smoke=part(31);
  }

  place(p,x,y,z,angle=0,sx=p.sx,sy=p.sy,alpha=1) {
    const [bx,by,w,h]=CHARACTER_STACK_BOUNDS[p.frame];
    const left=(bx-12)*sx,top=(by-12)*sy,right=left+w*sx,bottom=top+h*sy;
    const c=Math.cos(angle),s=Math.sin(angle),q=p.corners;
    q[0]=x+left*c-top*s;q[1]=y+left*s+top*c;
    q[2]=x+left*c-bottom*s;q[3]=y+left*s+bottom*c;
    q[4]=x+right*c-bottom*s;q[5]=y+right*s+bottom*c;
    q[6]=x+right*c-top*s;q[7]=y+right*s+top*c;
    p.z=z;p.alpha=alpha;p.heights.fill(z);p.normalX=0;p.normalY=0;
  }

  // Face/clothing art is an actual vertical surface, never another repeated
  // horizontal stamp. The shared renderer culls its back side using projection.
  panel(p,x,y,width,bottom,top,rotation,hostRotation,sortZ=top,topInset=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation),q=p.corners,h=p.heights;
    const left=x-width/2,right=x+width/2;
    q[0]=q[2]=left*c-y*s;q[1]=q[3]=left*s+y*c;
    q[4]=q[6]=right*c-y*s;q[5]=q[7]=right*s+y*c;
    // A sloped facial plane exposes cheek/eye art from the overhead camera.
    // Flat vertical faces collapse to a bright strip at the normal street pitch.
    q[0]-=topInset*s;q[1]+=topInset*c;q[6]-=topInset*s;q[7]+=topInset*c;
    h[0]=h[3]=top;h[1]=h[2]=bottom;p.z=sortZ;p.alpha=1;
    p.normalX=Math.sin(rotation+hostRotation);p.normalY=-Math.cos(rotation+hostRotation);
  }

  local(p,x,y,z,rotation,extra=0,sx=p.sx,sy=p.sy) {
    const c=Math.cos(rotation),s=Math.sin(rotation);
    this.place(p,x*c-y*s,x*s+y*c,z,rotation+extra,sx,sy);
  }

  update(pose,{upperRotation=0,feetRotation=0,timeMs=0,phase=0,moving=false,running=false,
    jumping=false,jumpProgress=0,hostRotation=0,idleMotion={},gesture=null,fallProgress=0,fallKind='shot'}={}) {
    const p=Math.max(0,Math.min(1,jumpProgress));
    const airborne=jumping?Math.sin(p*Math.PI):0;
    const crouch=jumping?(p<.16?(1-p/.16)*.7:p>.82?(p-.82)/.18*.65:0):0;
    const cadence=running ? .021 : .014,gait=moving?Math.sin(timeMs*cadence+phase):0;
    const bob=fallProgress>=.99?0:moving?Math.abs(gait)*(running?1.1:.45):Math.sin(timeMs*.00225+phase)*.25;
    const bodyZ=bob-crouch*5;
    const lean=running&&moving?-1.7:0;
    const core=upperRotation+(fallProgress>=.99?0:(pose.coreAttackRotation||0)+(idleMotion.coreRotation||0));
    this.place(this.shadow,Math.sin(hostRotation)*3,Math.cos(hostRotation)*3,0,-hostRotation,1,1,jumping?0:1);
    for(const leg of this.legs) {
      const foot=leg.side<0?pose.feet.left:pose.feet.right;
      const lift=jumping?airborne*5:Math.max(0,-leg.side*gait)*(running?3.2:1.4);
      const fy=jumping?3+airborne*2:foot.y;
      for(let i=0;i<2;i++)this.local(leg.boots[i],foot.x,fy,.7+i*1.2+lift,feetRotation,foot.rotation);
      for(let i=0;i<7;i++) {
        const t=(i+1)/8;
        this.local(leg.leg[i],foot.x,fy*(1-t)+1.8*t,3+lift*(1-t)+i*1.45+bodyZ*t,feetRotation,0,.85+t*.14,1);
      }
    }
    for(let i=0;i<2;i++)this.local(this.hips[i],0,1.8,12.6+i*.8+bodyZ,feetRotation);
    for(let i=0;i<10;i++)this.local(this.body[i],0,1.8+lean*i/9,14+i+bodyZ,core);
    this.local(this.seams,0,1.8+lean,23.1+bodyZ,core);
    this.seams.alpha=.45;
    if(this.badge){this.local(this.badge,0,1.8+lean,23.2+bodyZ,core);this.badge.alpha=.55;}
    this.local(this.neck,0,lean,24.5+bodyZ,core,0,.84,.84);
    for(let i=0;i<8;i++)this.local(this.head[i],0,lean,25+i*.7+bodyZ,core);
    for(let i=0;i<3;i++)this.local(this.hair[i],0,lean,29.9+i*.6+bodyZ,core);
    if(this.peak)this.local(this.peak,0,lean,31.2+bodyZ,core,0,.85,.85);
    // Glasses are painted once into the face, not stamped across the head again.
    if(this.glasses)this.glasses.alpha=0;
    this.panel(this.face,0,lean-3.9,5.7,25.2+bodyZ,30.2+bodyZ,core,hostRotation,31.3+bodyZ,2.1);
    this.panel(this.front,0,lean-1.35,12.8,14.4+bodyZ,22.8+bodyZ,core,hostRotation);
    this.panel(this.back,0,-lean-4.6,12.8,14.4+bodyZ,22.7+bodyZ,core+Math.PI,hostRotation);
    for(const arm of this.arms) {
      const hand=arm.side<0?pose.hands.left:pose.hands.right;
      const shoulderX=arm.side*this.style.shoulderWidth*.4,shoulderY=1.6+lean;
      let hx=hand.x+(jumping?arm.side*airborne*2:0),hy=hand.y+lean-(jumping?airborne*2:0);
      let hz=(pose.pistolVisible||pose.pipeVisible||pose.attackKind?22:16.8)+bodyZ+airborne*2;
      if(!moving&&!jumping&&!pose.pistolVisible&&!pose.pipeVisible&&!pose.attackKind){
        hx=arm.side*(this.style.shoulderWidth*.32+1.3);hy=2.6;hz=16+bodyZ;
      }
      if(gesture&&arm.side>0){const t=gesture.raise||0;hx+=(2-hx)*t;hy+=(-4.4-hy)*t;hz+=(27.5+bodyZ-hz)*t;}
      if(fallProgress){hx+=arm.side*fallProgress*2;hy-=fallProgress*4;}
      const length=Math.hypot(hx-shoulderX,hy-shoulderY);
      const ex=(shoulderX+hx)/2+arm.side*1.5,ey=(shoulderY+hy)/2+1.5;
      for(let i=0;i<6;i++) {
        const t=i/6,k=1-t;
        const x=k*k*shoulderX+2*k*t*ex+t*t*hx,y=k*k*shoulderY+2*k*t*ey+t*t*hy;
        const angle=Math.atan2(k*(ey-shoulderY)+t*(hy-ey),k*(ex-shoulderX)+t*(hx-ex))+Math.PI/2;
        this.local(arm.sleeve[i],x,y,23+bodyZ+(hz-23-bodyZ)*t,upperRotation,angle,.78,Math.max(.62,length/19));
      }
      for(let i=0;i<2;i++)this.local(arm.hand[i],hx,hy,hz+i*.7,upperRotation,hand.rotation);
      if(arm.side>0) {
        this.weapon.frame=pose.pipeVisible?20:19;
        this.local(this.weapon,hx,hy,hz+1,upperRotation,hand.rotation);
        this.weapon.alpha=pose.pistolVisible||pose.pipeVisible?1:0;
        this.local(this.flash,hx,hy-4,hz+1.1,upperRotation,hand.rotation);
        this.flash.alpha=pose.muzzleFlash?1:0;
        this.local(this.cigarette,hx,hy,hz+1.1,upperRotation,hand.rotation,.85,.85);
        this.cigarette.alpha=gesture?.kind==='smoke'?1:0;
        this.local(this.smoke,hx+Math.sin(timeMs*.001)*1.5,hy-3,hz+2+(gesture?.exhale||0)*8,upperRotation,0,1+(gesture?.exhale||0),1);
        this.smoke.alpha=gesture?.kind==='smoke'?(gesture.exhale||0)*.65:0;
      }
    }
    if(fallProgress){
      const f=Math.max(0,Math.min(1,fallProgress));
      for(const layer of this.layers){
        if(layer===this.shadow)continue;
        for(let i=0;i<4;i++){
          const z=layer.heights[i],c=Math.cos(upperRotation),s=Math.sin(upperRotation);
          const slide=z*f*(fallKind==='vehicle'?.75:.78),side=fallKind==='vehicle'?slide:0,back=fallKind==='vehicle'?slide*.3:slide;
          layer.corners[i*2]+=side*c-back*s;layer.corners[i*2+1]+=side*s+back*c;
          layer.heights[i]=z*(1-f)+1.2*f;
        }
        layer.normalX*=1-f;layer.normalY*=1-f;
      }
      this.cigarette.alpha=0;this.smoke.alpha=0;this.flash.alpha=0;this.weapon.alpha=0;
    }
    // Local slice order is independent of the host's street Y sort.
    this.layers.sort((a,b)=>a.z-b.z||a.order-b.order);
  }
}

function registerFrames(texture) {
  if(texture.has('human-0'))return;
  for(let i=0;i<CHARACTER_STACK_ATLAS.frames;i++) {
    const [x,y,w,h]=CHARACTER_STACK_BOUNDS[i],r=CHARACTER_STACK_ATLAS.resolution;
    texture.add(`human-${i}`,0,((i%4)*24+x)*r,(Math.floor(i/4)*24+y)*r,w*r,h*r);
  }
}

export class CharacterSpriteStack extends (globalThis.Phaser?.GameObjects?.Image||class {}) {
  constructor(scene,host,style) {
    const texture=scene.textures.get(CHARACTER_STACK_ATLAS.key);registerFrames(texture);
    super(scene,0,0,CHARACTER_STACK_ATLAS.key,'human-0');
    this.host=host;this.characterScale=style.scale||.78;
    this.rig=new CharacterStackRig(style);this.projection={x:0,y:0};
    this.frames=Array.from({length:CHARACTER_STACK_ATLAS.frames},(_,i)=>texture.get(`human-${i}`));
    this.setSize(32,48).setOrigin(.5);scene.add.existing(this);
  }
  insideCamera(camera){return characterInsideCamera(this.host,camera,this.characterScale);}
  willRender(camera){return super.willRender(camera)&&this.insideCamera(camera);}
  renderWebGL(renderer,src,camera,parentMatrix) {
    const m=Phaser.GameObjects.GetCalcMatrix(src,camera,parentMatrix).calc;
    const o=characterStackProjection(src.host.x,src.host.y,camera,src.projection),cm=camera.matrix;
    const determinant=parentMatrix?parentMatrix.a*parentMatrix.d-parentMatrix.b*parentMatrix.c:1;
    const scale=Math.sqrt(Math.abs(determinant));
    const ox=(cm.a*o.x+cm.c*o.y)*scale,oy=(cm.b*o.x+cm.d*o.y)*scale;
    const p=renderer.pipelines.set(src.pipeline,src),unit=p.setGameObject(src),texture=src.frame.glTexture;
    const tint=Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha,alpha=camera.alpha*src.alpha;
    camera.addToRenderList(src);p.manager.preBatch(src);
    for(const layer of src.rig.layers) {
      if(!layer.alpha)continue;
      if(layer.normalX*o.x+layer.normalY*o.y>-.01&&(layer.normalX||layer.normalY))continue;
      const q=layer.corners,h=layer.heights,f=src.frames[layer.frame],t=tint(layer.tint,alpha*layer.alpha);
      p.batchQuad(src,m.getX(q[0],q[1])+ox*h[0],m.getY(q[0],q[1])+oy*h[0],
        m.getX(q[2],q[3])+ox*h[1],m.getY(q[2],q[3])+oy*h[1],m.getX(q[4],q[5])+ox*h[2],m.getY(q[4],q[5])+oy*h[2],
        m.getX(q[6],q[7])+ox*h[3],m.getY(q[6],q[7])+oy*h[3],f.u0,f.v0,f.u1,f.v1,t,t,t,t,0,texture,unit);
    }
    p.manager.postBatch(src);
  }
}

export function canStackCharacter(scene) {
  return Boolean(scene?.game?.renderer?.gl && scene.textures?.exists(CHARACTER_STACK_ATLAS.key));
}
