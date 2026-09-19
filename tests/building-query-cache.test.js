import test from 'node:test';
import assert from 'node:assert/strict';
import {ChunkSpatialIndex} from '../phaser/src/streaming/ChunkSpatialIndex.js';
const manifest={world:{width:1024,height:512},chunkSize:512,chunkIds:['0:0','1:0'],chunks:{'0:0':{counts:{buildings:2}},'1:0':{counts:{buildings:2}}}};
const a={id:'a',x:20,y:20,w:20,h:20},shared={id:'shared',x:500,y:20,w:40,h:20},b={id:'b',x:700,y:20,w:20,h:20};
test('building candidates retain exact filtering, ordering, predicates and fresh results',()=>{
 const index=new ChunkSpatialIndex(manifest);index.hydrateChunk('0:0',{buildings:[a,shared]});index.hydrateChunk('1:0',{buildings:[shared,b]});
 const bounds={x:0,y:0,w:1000,h:100},opts={chunkIds:['1:0','0:0']};
 assert.deepEqual(index.query('buildings',bounds,opts),[shared,b,a]);
 index.query('buildings',bounds,opts).pop();assert.deepEqual(index.query('buildings',bounds,opts),[shared,b,a]);
 assert.deepEqual(index.query('buildings',{x:40,y:20,w:1,h:20},opts),[]);
 assert.deepEqual(index.query('buildings',{x:40,y:20,w:1,h:20},{...opts,margin:1}),[a]);
 let allowed='a';const predicate=item=>item.id===allowed;assert.deepEqual(index.query('buildings',bounds,{...opts,predicate}),[a]);allowed='b';assert.deepEqual(index.query('buildings',bounds,{...opts,predicate}),[b]);
});
test('building cache invalidates immediately on replacement, eviction and clear and stays bounded',()=>{
 const index=new ChunkSpatialIndex(manifest),bounds={x:0,y:0,w:1000,h:100},opts={chunkIds:['0:0','1:0']};
 index.hydrateChunk('0:0',{buildings:[a,shared]});index.hydrateChunk('1:0',{buildings:[shared,b]});index.query('buildings',bounds,opts);
 index.evictChunk('0:0');assert.deepEqual(index.query('buildings',bounds,opts),[shared,b]);
 index.hydrateChunk('1:0',{buildings:[a]});assert.deepEqual(index.query('buildings',bounds,opts),[a]);
 for(let i=0;i<80;i++)index.query('buildings',bounds,{chunkIds:['1:0',`missing-${i}`]});assert.ok(index.buildingCandidates.size<=32);
 index.clear();assert.deepEqual(index.query('buildings',bounds,opts),[]);
});
