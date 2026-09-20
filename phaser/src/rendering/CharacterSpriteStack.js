import {viewportPerspectiveLimit} from './WorldScale.js';

export const CHARACTER_STACK_ATLAS = Object.freeze({key:'human-stack-v1', cell:24, columns:4, frames:37, resolution:8});
export const CHARACTER_STACK_BOUNDS = Object.freeze([
  [2,8,20,8],[8,8,8,10],[9,8,6,8],[9,9,6,6],
  [6,9,12,6],[5,8,14,8],[3,8,18,8],[5,8,14,8],
  [9,8,6,8],[10,9,4,5],[9,10,6,4],[8,7,8,10],
  [7,7,10,10],[7,7,10,10],[7,7,10,10],[7,7,10,10],
  [6,6,12,12],[7,6,10,6],[8,7,8,4],[10,1,5,12],
  [10,0,4,16],[4,8,16,8],[7,7,10,10],[8,0,8,8],
  [7,5,10,14],[3,4,18,16],[3,4,18,16],[3,4,18,16],
  [10,3,4,9],[7,5,10,14],[3,4,18,16],[7,3,10,17],
  [0,0,8,12],[0,0,8,12],[0,0,8,12],[0,0,8,12],[6,1,12,22]
]);
const PERSPECTIVE = Object.freeze({eastWest:4,northSouth:4});
const ROUND_SECTION = [-.7071,-.7071, -1,0, -.7071,.7071, 0,1, .7071,.7071, 1,0, .7071,-.7071, 0,-1];
const shade=(color,k)=>((Math.min(255,(color>>16&255)*k)<<16)|(Math.min(255,(color>>8&255)*k)<<8)|Math.min(255,(color&255)*k));

export function characterStackProjection(x,y,camera,out={}) {
  const factor=4*viewportPerspectiveLimit(camera,PERSPECTIVE)/1505;
  const dx=(x-camera.scrollX-camera.width/2)*factor;
  const dy=(y-camera.scrollY-camera.height/2)*factor;
  const limit=1/Math.sqrt(1+dx*dx+dy*dy);
  // A person keeps a readable upright silhouette throughout the viewport.
  // The previous signed vertical tilt crossed zero: head and feet swapped
  // screen order near the lower edge even though the character never turned.
  out.x=dx*limit*.16;
  out.y=-.48+dy*limit*.10;
  return out;
}

// Painted capsules follow projected bone endpoints. Their alpha silhouettes
// remain round in every heading, instead of revealing the sides of a box.
// All coordinates are written to the sprite's reusable scratch quad.
export function projectCharacterLimb(layer,m,ox,oy,out) {
  const q=layer.corners,h=layer.heights;
  const tx=m.getX(q[0],q[1])+ox*h[0],ty=m.getY(q[0],q[1])+oy*h[0];
  const bx=m.getX(q[2],q[3])+ox*h[1],by=m.getY(q[2],q[3])+oy*h[1];
  const length=Math.hypot(bx-tx,by-ty),dx=length>.001?(bx-tx)/length:0,dy=length>.001?(by-ty)/length:1;
  const scale=Math.hypot(m.a,m.b),rt=layer.widthTop*scale,rb=layer.widthBottom*scale;
  const px=-dy,py=dx,cap=.72;
  out[0]=tx-px*rt-dx*rt*cap;out[1]=ty-py*rt-dy*rt*cap;
  out[2]=bx-px*rb+dx*rb*cap;out[3]=by-py*rb+dy*rb*cap;
  out[4]=bx+px*rb+dx*rb*cap;out[5]=by+py*rb+dy*rb*cap;
  out[6]=tx+px*rt-dx*rt*cap;out[7]=ty+py*rt-dy*rt*cap;
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
    const surface=(n,frame,tint)=>Array.from({length:n},()=>part(frame,tint));
    this.shadow=part(0);
    this.legs=[-1,1].map(side=>({side,boots:[part(1,style.shoe),part(2,shade(style.shoe,1.2))],
      leg:surface(2,36,style.trouser),joints:new Float32Array(9)}));
    this.hips=[part(4,style.trouser),part(4,style.bodyDark)];
    this.body=surface(8,33,style.body);
    this.shoulders=part(6,shade(style.body,1.2));
    this.neck=part(10,style.skin);
    this.head=surface(16,35,style.skin);
    for(const i of [1,2,3,4,9,10,11,12]){this.head[i].frame=34;this.head[i].tint=style.hair;}
    this.hair=surface(2,style.cap?16:style.headwear==='beanie'?22:style.headwear==='cap'?16:12+(style.hairVariant||0),
      shade(style.cap?style.body:style.headwear?style.bodyDark:style.hair,1.1));
    this.peak=style.cap||style.headwear==='cap'?part(17):null;
    this.face=part(style.glasses?29:24,style.skin);
    this.front=part(style.cap?26:style.glasses?25:27,shade(style.body,1.45));
    this.back=part(30,shade(style.body,1.2));
    this.arms=[-1,1].map(side=>({side,sleeve:surface(2,36,style.sleeve),hand:[part(9,style.skin)],joints:new Float32Array(9)}));
    this.weapon=part(19);this.flash=part(23);this.cigarette=part(28);this.smoke=part(31);
  }

  limb(p,bx,by,bz,tx,ty,tz,br,tr,rotation) {
    const c=Math.cos(rotation),s=Math.sin(rotation),q=p.corners,h=p.heights;
    q[0]=q[6]=tx*c-ty*s;q[1]=q[7]=tx*s+ty*c;
    q[2]=q[4]=bx*c-by*s;q[3]=q[5]=bx*s+by*c;
    h[0]=h[3]=tz;h[1]=h[2]=bz;p.z=Math.max(bz,tz);p.alpha=1;
    p.limb=true;p.widthTop=tr;p.widthBottom=br;p.normalX=p.normalY=0;
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

  local(p,x,y,z,rotation,extra=0,sx=p.sx,sy=p.sy) {
    const c=Math.cos(rotation),s=Math.sin(rotation);
    this.place(p,x*c-y*s,x*s+y*c,z,rotation+extra,sx,sy);
  }

  // Connected tapered surfaces replace separated horizontal stamps. The same
  // knee/elbow coordinates are used by BOTH adjoining bones: no floating limbs.
  tube(parts,offset,count,bx,by,bz,tx,ty,tz,brx,bry,trx,try_,rotation,hostRotation) {
    const section=ROUND_SECTION,c=Math.cos(rotation),s=Math.sin(rotation);
    const wc=Math.cos(rotation+hostRotation),ws=Math.sin(rotation+hostRotation);
    for(let i=0;i<count;i++) {
      const j=(i+1)%count,ax=section[i*2],ay=section[i*2+1],ex=section[j*2],ey=section[j*2+1];
      const p=parts[offset+i],q=p.corners,h=p.heights;
      const x0=tx+ax*trx,y0=ty+ay*try_,x1=bx+ax*brx,y1=by+ay*bry;
      const x2=bx+ex*brx,y2=by+ey*bry,x3=tx+ex*trx,y3=ty+ey*try_;
      q[0]=x0*c-y0*s;q[1]=x0*s+y0*c;q[2]=x1*c-y1*s;q[3]=x1*s+y1*c;
      q[4]=x2*c-y2*s;q[5]=x2*s+y2*c;q[6]=x3*c-y3*s;q[7]=x3*s+y3*c;
      h[0]=h[3]=tz;h[1]=h[2]=bz;p.z=Math.max(bz,tz);p.alpha=1;
      const nx=-(ey-ay),ny=ex-ax,length=Math.hypot(nx,ny);
      p.normalX=(nx*wc-ny*ws)/length;p.normalY=(nx*ws+ny*wc)/length;
      // Shared vertex normals interpolate the light across adjacent surfaces;
      // adding rounded geometry alone still leaves a low-poly appearance.
      const lightA=.88+.13*((ax*wc-ay*ws)*-.6+(ax*ws+ay*wc)*-.8);
      const lightB=.88+.13*((ex*wc-ey*ws)*-.6+(ex*ws+ey*wc)*-.8);
      p.tintLeft=shade(p.tint,lightA);p.tintRight=shade(p.tint,lightB);
    }
  }

  panel(p,x,y,width,bottom,top,rotation,hostRotation,sortZ=top,topInset=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation),q=p.corners,h=p.heights;
    const left=x-width/2,right=x+width/2;
    q[0]=q[2]=left*c-y*s;q[1]=q[3]=left*s+y*c;
    q[4]=q[6]=right*c-y*s;q[5]=q[7]=right*s+y*c;
    q[0]-=topInset*s;q[1]+=topInset*c;q[6]-=topInset*s;q[7]+=topInset*c;
    h[0]=h[3]=top;h[1]=h[2]=bottom;p.z=sortZ;p.alpha=1;
    p.normalX=Math.sin(rotation+hostRotation);p.normalY=-Math.cos(rotation+hostRotation);
  }

  update(pose,{upperRotation=0,feetRotation=0,timeMs=0,phase=0,gaitPhase=null,
    moving=false,running=false,motionBlend=moving?1:0,runBlend=running?1:0,
    jumping=false,jumpProgress=0,hostRotation=0,idleMotion={},gesture=null,fallProgress=0,fallKind='shot'}={}) {
    const p=Math.max(0,Math.min(1,jumpProgress)),airborne=jumping?Math.sin(p*Math.PI):0;
    const crouch=jumping?(p<.16?(1-p/.16)*.7:p>.82?(p-.82)/.18*.65:0):0;
    const gait=Math.sin(gaitPhase??(timeMs*(running?.021:.014)+phase))*motionBlend;
    const bob=fallProgress>=.99?0:Math.abs(gait)*(.35+runBlend*.45)+Math.sin(timeMs*.00225+phase)*.16*(1-motionBlend);
    const bodyZ=bob-crouch*3+airborne*2.3,lean=-runBlend*motionBlend*.9;
    const core=upperRotation+(fallProgress>=.99?0:(pose.coreAttackRotation||0)+(idleMotion.coreRotation||0)*.4);
    this.place(this.shadow,0,0,0,-hostRotation,.85,1,jumping?0:1);
    for(const leg of this.legs) {
      const foot=leg.side<0?pose.feet.left:pose.feet.right;
      const lift=jumping?airborne*5:Math.max(0,-leg.side*gait)*(1.5+runBlend*1.25);
      const fy=jumping?airborne*2:foot.y,fx=foot.x,kx=leg.side*2.25;
      const ky=fy*.5-Math.max(0,-leg.side*gait)*1.4-airborne*2,kz=8.1+bodyZ*.5+lift*.35;
      leg.joints.set([fx,fy,2+lift,kx,ky,kz,leg.side*2.15,0,14+bodyZ]);
      for(let i=0;i<2;i++)this.local(leg.boots[i],fx,fy-1,.7+i*.95+lift,feetRotation,foot.rotation,.8,.8);
      this.limb(leg.leg[0],fx,fy,2+lift,kx,ky,kz,1.35,1.55,feetRotation);
      this.limb(leg.leg[1],kx,ky,kz,leg.side*2.15,0,14+bodyZ,1.55,1.85,feetRotation);
    }
    this.local(this.hips[0],0,0,13.5+bodyZ,feetRotation,0,.8,.85);
    this.local(this.hips[1],0,0,14+bodyZ,core,0,.85,.85);
    const shoulder=this.style.shoulderWidth*.37;
    this.tube(this.body,0,8,0,0,13.5+bodyZ,0,lean,23+bodyZ,3.8,2.55,shoulder,3.25,core,hostRotation);
    this.local(this.shoulders,0,lean,23.05+bodyZ,core,0,this.style.shoulderWidth/18,.78);
    this.local(this.neck,0,lean-.5,24+bodyZ,core,0,.7,.8);
    this.tube(this.head,0,8,0,lean-.5,24.6+bodyZ,0,lean,27.4+bodyZ,1.85,2,2.75,2.9,core,hostRotation);
    this.tube(this.head,8,8,0,lean,27.4+bodyZ,0,lean,29.7+bodyZ,2.75,2.9,2.3,2.5,core,hostRotation);
    this.local(this.hair[0],0,lean,29.8+bodyZ,core,0,.78,.78);
    this.local(this.hair[1],0,lean,30.4+bodyZ,core,0,.72,.74);
    if(this.peak)this.local(this.peak,0,lean,30.9+bodyZ,core,0,.8,.8);
    this.panel(this.face,0,lean-2.9,6,24.6+bodyZ,30+bodyZ,core,hostRotation,30.5+bodyZ,1.5);
    this.panel(this.front,0,lean-3.27,shoulder*1.7,13.7+bodyZ,23+bodyZ,core,hostRotation,23.1+bodyZ);
    this.panel(this.back,0,-lean-3.27,shoulder*1.7,13.7+bodyZ,23+bodyZ,core+Math.PI,hostRotation,23.1+bodyZ);
    for(const arm of this.arms) {
      const hand=arm.side<0?pose.hands.left:pose.hands.right;
      const sx=arm.side*shoulder,sy=lean,sz=22.3+bodyZ;
      let hx=hand.x+(jumping?arm.side*airborne*1.5:0),hy=hand.y+lean-(jumping?airborne:0);
      const ready=(pose.pistolVisible&&!pose.weaponLowered)||pose.pipeVisible||pose.attackKind;
      let hz=(ready?21.3:14.7)+bodyZ+airborne*2;
      if(motionBlend<.025&&!jumping&&!ready){hx=arm.side*(shoulder+1);hy=.5;}
      if(gesture&&arm.side>0){const t=gesture.raise||0;hx+=(2-hx)*t;hy+=(-4-hy)*t;hz+=(27+bodyZ-hz)*t;}
      if(fallProgress){hx+=arm.side*fallProgress*2;hy-=fallProgress*3;}
      const ex=(sx+hx)*.5+arm.side*.7,ey=(sy+hy)*.5+.65,ez=(sz+hz)*.5-1.2;
      arm.joints.set([sx,sy,sz,ex,ey,ez,hx,hy,hz]);
      this.limb(arm.sleeve[0],ex,ey,ez,sx,sy,sz,1.35,1.8,core);
      this.limb(arm.sleeve[1],hx,hy,hz,ex,ey,ez,1.05,1.35,core);
      this.local(arm.hand[0],hx,hy,hz+.25,core,hand.rotation,.85,.85);
      if(arm.side>0) {
        this.weapon.frame=pose.pipeVisible?20:19;
        this.local(this.weapon,hx,hy,hz+.9,core,hand.rotation,.85,.85);
        this.weapon.alpha=pose.pistolVisible||pose.pipeVisible?1:0;
        this.local(this.flash,hx,hy-4,hz+1,core,hand.rotation);
        this.flash.alpha=pose.muzzleFlash?1:0;
        this.local(this.cigarette,hx,hy,hz+1,core,hand.rotation,.8,.8);
        this.cigarette.alpha=gesture?.kind==='smoke'?1:0;
        this.local(this.smoke,hx+Math.sin(timeMs*.001)*1.5,hy-3,hz+2+(gesture?.exhale||0)*5,core,0,1+(gesture?.exhale||0),1);
        this.smoke.alpha=gesture?.kind==='smoke'?(gesture.exhale||0)*.65:0;
      }
    }
    if(fallProgress){
      const f=Math.max(0,Math.min(1,fallProgress)),c=Math.cos(upperRotation),s=Math.sin(upperRotation);
      for(const layer of this.layers){
        if(layer===this.shadow)continue;
        for(let i=0;i<4;i++){
          const z=layer.heights[i],slide=z*f*.78,side=fallKind==='vehicle'?slide:0,back=fallKind==='vehicle'?slide*.3:slide;
          layer.corners[i*2]+=side*c-back*s;layer.corners[i*2+1]+=side*s+back*c;
          layer.heights[i]=z*(1-f)+1.2*f;
        }
        layer.normalX*=1-f;layer.normalY*=1-f;
      }
      this.cigarette.alpha=0;this.smoke.alpha=0;this.flash.alpha=0;this.weapon.alpha=0;
    }
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
    this.limbQuad=new Float32Array(8);
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
      const q=layer.corners,h=layer.heights,f=src.frames[layer.frame],t=tint(layer.tintLeft??layer.tint,alpha*layer.alpha),r=tint(layer.tintRight??layer.tint,alpha*layer.alpha);
      if(layer.limb){
        const s=projectCharacterLimb(layer,m,ox,oy,src.limbQuad);
        p.batchQuad(src,s[0],s[1],s[2],s[3],s[4],s[5],s[6],s[7],f.u0,f.v0,f.u1,f.v1,t,t,r,r,0,texture,unit);
        continue;
      }
      p.batchQuad(src,m.getX(q[0],q[1])+ox*h[0],m.getY(q[0],q[1])+oy*h[0],
        m.getX(q[2],q[3])+ox*h[1],m.getY(q[2],q[3])+oy*h[1],m.getX(q[4],q[5])+ox*h[2],m.getY(q[4],q[5])+oy*h[2],
        m.getX(q[6],q[7])+ox*h[3],m.getY(q[6],q[7])+oy*h[3],f.u0,f.v0,f.u1,f.v1,t,t,r,r,0,texture,unit);
    }
    p.manager.postBatch(src);
  }
}

export function canStackCharacter(scene) {
  return Boolean(scene?.game?.renderer?.gl && scene.textures?.exists(CHARACTER_STACK_ATLAS.key));
}
