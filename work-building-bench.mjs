import {performance} from 'node:perf_hooks';
import {ChunkSpatialIndex} from './phaser/src/streaming/ChunkSpatialIndex.js';
import {chunkIdsForBounds,itemBounds} from './phaser/src/streaming/CityChunkManifest.js';
import {currentCityBlueprint} from './tools/city-compiler/current-city.js';
import {buildCityChunkFileSet} from './tools/city-compiler/chunk-files.js';
const f=buildCityChunkFileSet({id:'bench',world:currentCityBlueprint.world,runtime:currentCityBlueprint.runtime});
const index=new ChunkSpatialIndex(f.manifest,f.collections);
function intersects(a,b,m=0){return a.x<b.x+b.w+m&&a.x+a.w>b.x-m&&a.y<b.y+b.h+m&&a.y+a.h>b.y-m;}
let source=ChunkSpatialIndex.prototype.query.toString();const start=source.indexOf('    if (categoryKey === "buildings")');const end=source.indexOf('    const seen = new Set();',source.indexOf('      return result;',start));source=source.slice(0,start)+source.slice(end);
const old=Function('chunkIdsForBounds','itemBounds','intersects','return function '+source)(chunkIdsForBounds,itemBounds,intersects);
const queries=Array.from({length:64},(_,i)=>({x:1500+i*8,y:1200+(i%8)*12,w:480,h:480}));
const run=fn=>{let count=0;const t=performance.now();for(let i=0;i<20000;i++)count+=fn.call(index,'buildings',queries[i%queries.length]).length;return {ms:performance.now()-t,count}};
run(old);run(index.query);for(let i=0;i<3;i++)console.log(JSON.stringify({old:run(old),cached:run(index.query)}));

