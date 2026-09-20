import {VEHICLE_STACK_SETTINGS, vehicleStackMagnitude} from './VehicleStackSettings.js';
import {CITY_PERSPECTIVE,CITY_PERSPECTIVE_MAX,perspectiveMagnitude} from './CityPerspective.js';

export function installPerspectiveSlider(scene){
 const panel=document.createElement('div');panel.setAttribute('role','group');panel.setAttribute('aria-label','Controles de perspectiva');
 panel.style.cssText='position:fixed;left:16px;bottom:18px;z-index:10000;background:#171719e8;color:#d4c7af;padding:10px 12px;border:1px solid #75654e;font:12px sans-serif;display:grid;gap:10px';
 const controls=[];
 const addSlider=(title,accessibleName,max,initial,onChange)=>{
  const row=document.createElement('label');row.style.cssText='display:grid;grid-template-columns:100px 130px 40px;gap:10px;align-items:center';
  const text=document.createElement('span');text.textContent=title;
  const input=document.createElement('input');input.type='range';input.min='0';input.max=String(max);input.step='1';input.value=String(initial);input.setAttribute('aria-label',accessibleName);input.style.cssText='width:130px;accent-color:#a44148';
  const value=document.createElement('output');value.textContent=initial+'%';value.style.textAlign='right';
  input.addEventListener('input',()=>{onChange(Number(input.value)/100);value.textContent=input.value+'%';});
  row.append(text,input,value);panel.append(row);
  controls.push({input,value,onChange,initial});
 };
 scene.cityPerspective={...CITY_PERSPECTIVE,...scene.cityPerspective};
 for(const [key,label]of [['northSouth','Norte–Sur'],['eastWest','Este–Oeste']]){
  scene.cityPerspective[key]=perspectiveMagnitude(scene.cityPerspective[key]);
  addSlider(label,`Paralaje ${label.toLowerCase()}`,CITY_PERSPECTIVE_MAX*100,scene.cityPerspective[key]*100,value=>{
   scene.cityPerspective[key]=perspectiveMagnitude(value);
  });
 }
 scene.vehicleStackMagnitude=vehicleStackMagnitude(scene.vehicleStackMagnitude);
 addSlider('Volumen coches','Intensidad de volumen de coches',VEHICLE_STACK_SETTINGS.maxMagnitude*100,scene.vehicleStackMagnitude*100,value=>{scene.vehicleStackMagnitude=vehicleStackMagnitude(value);});
 const reset=document.createElement('button');reset.type='button';reset.textContent='Restablecer perspectiva';reset.style.cssText='background:#242326;color:inherit;border:1px solid #75654e;padding:4px;cursor:pointer';
 reset.addEventListener('click',()=>{for(const c of controls){c.input.value=String(c.initial);c.value.textContent=c.initial+'%';c.onChange(c.initial/100);}});panel.append(reset);
 for(const event of ['pointerdown','pointerup','keydown','keyup','wheel'])panel.addEventListener(event,e=>e.stopPropagation());
 document.body.append(panel);scene.events.once('shutdown',()=>panel.remove());
 return panel;
}
