import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createBootPayload, projectRoot, hash } from '../tools/boot/assets.mjs';
import { createSampleByteCache, sampleFiles } from '../phaser/src/audio/SampleByteCache.js';
import { ChunkFileStore, DEFAULT_CITY_MANIFEST_URL } from '../phaser/src/streaming/ChunkFileStore.js';
import { ChunkStreamSystem } from '../phaser/src/streaming/ChunkStreamSystem.js';
import { PLAYER } from '../phaser/src/data/balance.js';

const payload = await createBootPayload();
const response = value => ({ok:true,status:200,json:async()=>value});
const packResponse = () => ({ok:true,status:200,arrayBuffer:async()=>payload.audioBytes.buffer.slice(payload.audioBytes.byteOffset,payload.audioBytes.byteOffset+payload.audioBytes.length)});
const seedStore = options => new ChunkFileStore({seed:payload.city,...options});
const scene = () => ({player:{x:PLAYER.startX,y:PLAYER.startY},registry:new Map([['mainMenuActive',true]]),events:{once(){}},npcSystem:{npcs:[]},statePublisher:{setMany(){}},campaignSystem:{state:{world:{flags:{}}}}});

test('compiler-derived boot seed gives a ready initial city with blocked network and zero scene frames',async t=>{
  let requests=0; const store=seedStore({fetchImpl:()=>{requests++;throw new Error('Network blocked');}});
  const stream=new ChunkStreamSystem(scene(),{fileStore:store}); t.after(()=>stream.destroy());
  await stream.prepareInitialView();
  assert.equal(requests,0);assert.equal(stream.isReady(),true);assert.equal(stream.index.residentChunkIds().length,9);
  assert.ok(stream.query('roads',{x:1200,y:1200,w:800,h:800}).length);
  for(let i=0;i<30;i++) stream.update();
  assert.equal(requests,0,'prefetch stays off the title critical path');
});
test('embedded city bytes and IDs match compiler-authored files without simplified geometry',async()=>{
  for(const [id,chunk] of Object.entries(payload.city.chunks)) {
    assert.deepEqual(chunk,JSON.parse(await readFile(new URL(`../phaser/assets/city/current/${payload.city.manifest.chunks[id].file}`,import.meta.url))));
  }
  assert.equal(Object.keys(payload.city.chunks).length,9);assert.match(payload.city.version,/^[a-f0-9]{24}$/);
});
test('custom city manifests do not accidentally use the production city seed',async t=>{
  let calls=0;const store=seedStore({manifestUrl:'https://example.test/custom/manifest.json',fetchImpl:async()=>{calls++;return response(payload.city.manifest);}});t.after(()=>store.destroy());
  assert.equal(store.seed,null);await store.loadManifest();assert.equal(calls,1);
});
test('deferred surrounding chunks start after title handoff, with at most four concurrent reads',async t=>{
  let active=0,maximum=0; const store=seedStore({fetchImpl:async url=>{active++;maximum=Math.max(active,maximum);await delay(3);active--;const id=new URL(url).pathname.match(/(\d+)-(\d+)\.json$/).slice(1).join(':');return response({id,collections:{}});}});
  const s=scene(),stream=new ChunkStreamSystem(s,{fileStore:store});t.after(()=>stream.destroy());
  await stream.prepareInitialView();assert.equal(store.stats.chunkRequests,0);s.registry.set('mainMenuActive',false);stream.update();await Promise.all([...stream.loadPromises.values()]);
  assert.ok(store.stats.chunkRequests>0);assert.ok(maximum<=4);assert.match(store.chunkUrl('4:4'),new RegExp(`v=${payload.city.version}`));
});
test('uncached requests use browser cache and one shared manifest request',async t=>{
  const calls=[];const store=new ChunkFileStore({manifestUrl:'https://example.test/city/manifest.json',fetchImpl:async(url,opts)=>{calls.push({url,cache:opts.cache});await delay(2);return response(payload.city.manifest);}});t.after(()=>store.destroy());
  await Promise.all([store.loadManifest(),store.loadManifest(),store.loadManifest()]);assert.equal(calls.length,1);assert.equal(calls[0].cache,'default');
});
test('a stalled city transport is bounded even when fetch ignores AbortSignal',async t=>{
  const store=seedStore({maxConcurrent:1,maxRetries:0,requestTimeoutMs:25,fetchImpl:()=>new Promise(()=>{})});t.after(()=>store.destroy());
  await assert.rejects(store.loadChunk('4:4'),/City request timed out/);await delay(0);assert.equal(store.activeRequests,0);
});
test('cancelled queued requests never reach the network or become cached',async t=>{
  let calls=0;const store=seedStore({maxConcurrent:1,maxRetries:0,requestTimeoutMs:30,fetchImpl:()=>{calls++;return new Promise(()=>{});}});t.after(()=>store.destroy());
  const first=store.loadChunk('4:4');const second=store.loadChunk('4:3');const secondCheck=assert.rejects(second,{name:'AbortError'});assert.equal(store.cancel('4:3'),true);
  await secondCheck;await assert.rejects(first,/timed out/);assert.equal(calls,1);assert.equal(store.has('4:3'),false);
});
test('all forty original sounds are transported losslessly with exactly one fetch',async()=>{
  let calls=0;const cache=createSampleByteCache({pack:{...payload.audio,url:'samples.bin'},fetchRef:async()=>{calls++;return packResponse();}});
  await Promise.all([cache.preload(),cache.preload(),cache.get(sampleFiles[0])]);
  for(const file of sampleFiles) assert.equal(hash(Buffer.from(await cache.get(file))),payload.audio.entries[file].sha256,file);
  assert.equal(calls,1);assert.equal(cache.snapshot().cached,40);
});
test('audio decoding receives owned buffers and cannot detach or modify the shared cache',async()=>{
  const cache=createSampleByteCache({pack:{...payload.audio,url:'samples.bin'},fetchRef:async()=>packResponse()});const first=await cache.get(sampleFiles[0]);const original=hash(Buffer.from(first));
  structuredClone(first,{transfer:[first]});assert.equal(first.byteLength,0);assert.equal(hash(Buffer.from(await cache.get(sampleFiles[0]))),original);
});
test('truncated audio package and missing entries fail explicitly',async()=>{
  const cache=createSampleByteCache({pack:{...payload.audio,url:'samples.bin'},fetchRef:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(7)})});await assert.rejects(cache.preload(),/Incomplete audio/);
  const missing=createSampleByteCache({pack:{...payload.audio,url:'samples.bin',entries:{}},fetchRef:async()=>packResponse()});await assert.rejects(missing.get(sampleFiles[0]),/Missing audio entry/);
});
test('packed audio timeout is bounded and a later retry can succeed',async()=>{
  let stalled=true;const cache=createSampleByteCache({pack:{...payload.audio,url:'samples.bin'},timeoutMs:25,fetchRef:async()=>stalled?new Promise(()=>{}):packResponse()});
  await assert.rejects(cache.preload(),/Audio download timed out/);stalled=false;await cache.preload();assert.equal(cache.snapshot().cached,40);
});
test('native source URLs remain module-relative while build-time packing owns relocation',()=>{
  assert.match(DEFAULT_CITY_MANIFEST_URL,/\/phaser\/assets\/city\/current\/manifest\.json$/);
});

test('the real title preloader and playback share the same packed audio download',async()=>{
  const {preloadTitleExperience}=await import('../phaser/src/ui/TitleAssetPreloader.js');
  let audioRequests=0, imageRequests=0;
  const cache=createSampleByteCache({pack:{...payload.audio,url:'samples.bin'},fetchRef:async()=>{audioRequests++;return packResponse();}});
  const win={setTimeout,clearTimeout};
  await preloadTitleExperience({windowRef:win,documentRef:{getElementById:()=>({readyState:3}),querySelectorAll:()=>[{src:'logo.svg'},{src:'logo.svg'}]},
    sampleCache:cache,fetchRef:async url=>{assert.equal(url,'logo.svg');imageRequests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
  await cache.get(sampleFiles[0]);
  assert.equal(audioRequests,1);assert.equal(imageRequests,1);assert.equal(win.NBD_TITLE_PRELOAD_STATE.state,'ready');
});
test('RawAudio limits sample decoding to two concurrent operations',async()=>{
  const {RawAudio}=await import('../phaser/src/systems/RawAudioSystem.js');let active=0,max=0;
  const context={async decodeAudioData(buffer){active++;max=Math.max(max,active);await delay(2);active--;return buffer.byteLength;}};
  const values=await Promise.all(Array.from({length:40},()=>RawAudio.decodeSample(context,new ArrayBuffer(4))));
  assert.equal(max,2);assert.ok(values.every(n=>n===4));
});
