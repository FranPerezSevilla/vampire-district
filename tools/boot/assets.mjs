import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER } from '../../phaser/src/data/balance.js';
import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from '../../phaser/src/audio/SampleAudioCatalog.js';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function createBootPayload(root = projectRoot) {
  const cityRoot = resolve(root, 'phaser/assets/city/current');
  const manifest = JSON.parse(await readFile(resolve(cityRoot, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.chunkIds) || !manifest.chunkIds.length) throw new Error('Invalid city manifest');
  const all = {}, fingerprint = createHash('sha256').update(JSON.stringify(manifest));
  for (const id of manifest.chunkIds) {
    const file = manifest.chunks[id]?.file;
    if (!/^chunks\/[0-9]+-[0-9]+\.json$/.test(file || '')) throw new Error(`Unsafe chunk path ${id}`);
    const bytes = await readFile(resolve(cityRoot, file));
    const chunk = JSON.parse(bytes);
    if (chunk.id !== id || !chunk.collections) throw new Error(`Invalid compiled chunk ${id}`);
    all[id] = chunk; fingerprint.update(id).update(bytes);
  }
  const column = Math.floor(PLAYER.startX / manifest.chunkSize), row = Math.floor(PLAYER.startY / manifest.chunkSize);
  const chunks = {};
  for (let y = Math.max(0, row - 1); y <= Math.min(manifest.rows - 1, row + 1); y++) {
    for (let x = Math.max(0, column - 1); x <= Math.min(manifest.columns - 1, column + 1); x++) {
      const id = `${x}:${y}`; if (!all[id]) throw new Error(`Missing start chunk ${id}`); chunks[id] = all[id];
    }
  }
  const files = [...new Set(SAMPLE_AUDIO_IDS.flatMap(id => sampleAudioDefinition(id).files))];
  const pieces = [], entries = {}; let offset = 0;
  for (const file of files) {
    const path = resolve(root, file);
    if (relative(root, path).startsWith(`..${sep}`)) throw new Error('Unsafe sample path');
    const bytes = await readFile(path);
    if (!bytes.length) throw new Error(`Empty sample ${file}`);
    entries[file] = { offset, length: bytes.length, sha256: hash(bytes) };
    pieces.push(bytes); offset += bytes.length;
  }
  const audioBytes = Buffer.concat(pieces);
  return { city: { manifest, chunks, version: fingerprint.digest('hex').slice(0, 24) },
    audio: { byteLength: audioBytes.length, sha256: hash(audioBytes), entries }, audioBytes };
}
