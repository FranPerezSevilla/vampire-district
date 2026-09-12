import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBootPayload, projectRoot, hash } from './assets.mjs';
import { ChunkFileStore } from '../../phaser/src/streaming/ChunkFileStore.js';
import { ChunkStreamSystem } from '../../phaser/src/streaming/ChunkStreamSystem.js';
import { createSampleByteCache } from '../../phaser/src/audio/SampleByteCache.js';
import { PLAYER } from '../../phaser/src/data/balance.js';

const root = resolve(projectRoot, process.argv[2] || 'dist');
const boot = JSON.parse(await readFile(resolve(root, 'boot-assets.json')));
for (const path of boot.paths) assert.equal(hash(await readFile(resolve(root,path))),boot.hashes[path],path);
const prepared = JSON.parse(await readFile(resolve(root,'phaser/runtime-dist/boot-data.json')));
const authored = await createBootPayload();
assert.deepEqual(prepared.city,authored.city,'build seed must match all nine compiler-owned chunks and manifest');
assert.deepEqual(prepared.audio,authored.audio);
const pack = await readFile(resolve(root,prepared.audioPath));
assert.equal(hash(pack),prepared.audio.sha256);
let cityRequests = 0, audioRequests = 0;
const fileStore = new ChunkFileStore({seed:prepared.city,fetchImpl:()=>{cityRequests++;throw new Error('City network deliberately unavailable');}});
const scene = {player:{x:PLAYER.startX,y:PLAYER.startY},registry:new Map([['mainMenuActive',true]]),events:{once(){}},statePublisher:{setMany(){}},npcSystem:{npcs:[]},campaignSystem:{state:{world:{flags:{}}}}};
const stream = new ChunkStreamSystem(scene,{fileStore});
try {
  const began = performance.now(); await stream.prepareInitialView();
  assert.equal(stream.isReady(),true); assert.equal(cityRequests,0);
  assert.equal(stream.index.residentChunkIds().length,9);
  const cache = createSampleByteCache({pack:{...prepared.audio,url:prepared.audioPath},fetchRef:async()=>{
    audioRequests++; return {ok:true,arrayBuffer:async()=>pack.buffer.slice(pack.byteOffset,pack.byteOffset+pack.byteLength)};
  }});
  await cache.preload();
  for (const [file,entry] of Object.entries(prepared.audio.entries)) {
    assert.equal(hash(Buffer.from(await cache.get(file))),entry.sha256,file);
    assert.deepEqual(Buffer.from(await cache.get(file)),await readFile(resolve(projectRoot,file)),file);
  }
  assert.equal(audioRequests,1);
  const result = {verified:true,cityRequests,audioRequests,initialChunks:9,audioFiles:40,preparationAndVerificationMs:Math.round(performance.now()-began),browserExecuted:false};
  console.log(JSON.stringify(result,null,2));
} finally {stream.destroy();}
