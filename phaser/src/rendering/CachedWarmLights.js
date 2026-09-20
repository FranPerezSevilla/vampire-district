// Two reusable soft light stamps. Created once per material owner, never per frame.
// Gradients are intentional lighting, independent from authored architectural art.
export class CachedWarmLights {
 constructor(createCanvas=()=>document.createElement('canvas')){this.createCanvas=createCanvas;this.stamps=new Map();}
 stamp(kind){
  if(this.stamps.has(kind))return this.stamps.get(kind);
  const canvas=this.createCanvas();canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');
  if(kind==='beam'){
   // Soft-edged downlight: narrow at the fixture and wider as it falls.
   const fall=c.createLinearGradient(0,0,0,128);
   fall.addColorStop(0,'rgba(255,218,159,.8)');
   fall.addColorStop(.22,'rgba(255,208,133,.7)');
   fall.addColorStop(.65,'rgba(231,171,96,.25)');
   fall.addColorStop(1,'rgba(231,171,96,0)');
   c.fillStyle=fall;c.fillRect(0,0,128,128);
   c.globalCompositeOperation='destination-in';
   for(let y=0;y<128;y++){
    const radius=9+y*.43,g=c.createLinearGradient(64-radius,0,64+radius,0);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.35,'rgba(0,0,0,.85)');
    g.addColorStop(.65,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(0,y,128,1);
   }
  }else{
   const g=c.createRadialGradient(64,64,0,64,64,64);
   g.addColorStop(0,'rgba(255,229,181,1)');g.addColorStop(.18,'rgba(255,216,152,.65)');
   g.addColorStop(.5,'rgba(236,172,91,.16)');g.addColorStop(1,'rgba(236,172,91,0)');
   c.fillStyle=g;c.fillRect(0,0,128,128);
  }
  this.stamps.set(kind,canvas);return canvas;
 }
 draw(ctx,kind,x,y,rx,ry,strength){
  ctx.save();ctx.globalAlpha=strength;
  ctx.drawImage(this.stamp(kind),x-rx,kind==='beam'?y:y-ry,rx*2,kind==='beam'?ry:ry*2);
  ctx.restore();
 }
 destroy(){this.stamps.clear();}
}
