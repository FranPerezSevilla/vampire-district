import {approachInfluence} from './LandmarkPerspective.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function landmarkGroups(buildings){
 const roots=buildings.filter(b=>!b.parentBuildingId&&!b.campusBarrier&&(b.landmark||['hospital','police','club'].includes(b.id)));
 return roots.map(root=>({root,members:buildings.filter(b=>!b.campusBarrier&&!b.dormer&&!b.roofTier&&(b.id===root.id||b.parentBuildingId===root.id||root.siteId&&b.siteId===root.siteId))}));
}
export function frontageInfluence(player,members){
 if(!player||members.some(b=>player.x>b.x&&player.x<b.x+b.w&&player.y>b.y&&player.y<b.y+b.h))return 0;
 let value=0;
 for(const b of members){
  const distance=player.y-(b.y+b.h),outside=Math.max(b.x-player.x,player.x-b.x-b.w,0);
  if(distance<0)continue;
  value=Math.max(value,(1-smooth((distance-10)/38))*(1-smooth(outside/20)));
 }
 return value;
}
export function updateFrontage(player,members,previous,deltaMs,magnitude){
 return {amount:approachInfluence(previous?.amount||0,frontageInfluence(player,members)*magnitude,deltaMs),direction:{nx:0,ny:1}};
}
export function installPerspectiveSlider(scene){
 const panel=document.createElement('label');panel.setAttribute('aria-label','Perspectiva de enclaves');
 panel.style.cssText='position:fixed;left:16px;bottom:18px;z-index:10000;background:#171719e8;color:#d4c7af;padding:10px 12px;border:1px solid #75654e;font:12px sans-serif;display:flex;gap:10px;align-items:center';
 const text=document.createElement('span');text.textContent='Perspectiva';
 const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value='75';input.setAttribute('aria-label','Intensidad de perspectiva especial');
 const value=document.createElement('output');value.textContent='75%';
 scene.landmarkPerspectiveMagnitude=.75;
 input.addEventListener('input',()=>{scene.landmarkPerspectiveMagnitude=Number(input.value)/100;value.textContent=input.value+'%';});
 for(const event of ['pointerdown','pointerup','keydown','keyup','wheel'])panel.addEventListener(event,e=>e.stopPropagation());
 panel.append(text,input,value);document.body.append(panel);scene.events.once('shutdown',()=>panel.remove());
 return panel;
}
