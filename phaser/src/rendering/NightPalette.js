// Presentation values shared by cached architecture, street surfaces and actors.
export const NIGHT = Object.freeze({ground:0x727e96,roof:0x68768c,prop:0x929ba8,
 amber:0xffbd64,headlamp:0xffe3ac,tail:0xe83225,red:0xf23a36,blue:0x526dff});

export function nightMaterialPixel(r,g,b,emissive=true){
 const warm=emissive?Math.max(0,Math.min(1,(r-g-7)/22,(g-b-12)/30,(g-88)/65)):0;
 const dark=[Math.max(0,r-9)*.44,Math.max(0,g-8)*.49,Math.max(0,b-5)*.62];
 return dark.map((v,i)=>Math.round(v*(1-warm)+[r,g,b][i]*warm));
}

// Once per resident facade, never a frame filter. Warm luminous panes retain
// their colour while masonry and trim share the same low ambient exposure.
export function gradeNightCanvas(canvas){
 const c=canvas.getContext('2d'),image=c.getImageData(0,0,canvas.width,canvas.height),d=image.data;
 for(let i=0;i<d.length;i+=4){
  const r=d[i],g=d[i+1],b=d[i+2];
  const warm=Math.max(0,Math.min(1,(r-g-7)/22,(g-b-12)/30,(g-88)/65)),cold=1-warm;
  d[i]=Math.max(0,r-9)*.44*cold+r*warm;
  d[i+1]=Math.max(0,g-8)*.49*cold+g*warm;
  d[i+2]=Math.max(0,b-5)*.62*cold+b*warm;
 }
 c.putImageData(image,0,0);
}
