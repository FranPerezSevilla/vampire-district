// Read-only, reproducible structure overview. Run before/after authored renewal.
import * as city from '../../phaser/src/data/generated/city-topology-v2.js';
import {writeFile,mkdir} from 'node:fs/promises';
const phase=process.argv[2]||'current';
const out=new URL('../../docs/art-direction/',import.meta.url);
await mkdir(out,{recursive:true});
const rect=(r,fill,stroke='none',extra='')=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const colours=['#829985','#8793af','#a396b1','#8c9b9e','#b19b7c','#988799','#969899','#859c90','#758f91','#ad8e76','#7f9099','#7b999b','#8b8980','#718895'];
const bounds=city.districtZones.map((d,i)=>({...d,buildings:city.buildings.filter(b=>b.districtId===d.id),colour:colours[i]}));
const report={world:city.CITY_WORLD,roadNodes:city.roadGraphNodes.length,roadEdges:city.roadGraphEdges.length,buildings:city.buildings.length,
 districts:bounds.map(d=>({id:d.id,name:d.name,volumes:d.buildings.length,footprintPercent:+(100*d.buildings.reduce((n,b)=>n+b.w*b.h,0)/(d.w*d.h)).toFixed(2),infill:d.buildings.filter(b=>b.id.startsWith('infill:')).length}))};
const adjacent=new Map(city.roadGraphNodes.map(n=>[n.id,[]]));
for(const e of city.roadGraphEdges){adjacent.get(e.from).push(e.to);adjacent.get(e.to).push(e.from);}
const seen=new Set(),components=[];
for(const id of adjacent.keys())if(!seen.has(id)){
 const queue=[id];seen.add(id);
 for(let i=0;i<queue.length;i++)for(const n of adjacent.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}
 components.push(queue.length);
}
report.roadConnectedComponents=components;
const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -60 4860 3690" width="1944" height="1476"><rect x="-30" y="-60" width="4860" height="3690" fill="#10171d"/>`];
for(const d of bounds)parts.push(rect(d,'none','#3b4650','stroke-width="3"'));
for(const s of city.sidewalks)parts.push(rect(s,s.bandKind==='pedestrian-court'?'#354c47':'#252d31'));
for(const r of city.roads)parts.push(rect(r,'#3d454b'));
for(const d of bounds)for(const b of d.buildings)parts.push(rect(b,b.landmark?'#d2ad62':d.colour,'#10171d','stroke-width="2"'));
for(const d of bounds)parts.push(`<text x="${d.x+14}" y="${d.y+35}" font-family="sans-serif" font-size="27" fill="#eeeeea">${d.name}</text>`);
parts.push('</svg>');
await writeFile(new URL(`city-districts-${phase}.svg`,out),parts.join('\n'));
await writeFile(new URL(`city-districts-${phase}.json`,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
