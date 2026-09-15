import { bootAssets } from "../boot/BootAssets.js";
import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from "./SampleAudioCatalog.js";

const root = new URL("../../../", import.meta.url);
export const sampleFiles = [...new Set(SAMPLE_AUDIO_IDS.flatMap(id => sampleAudioDefinition(id).files))];

// Encoded bytes only. RawAudio retains ownership of decoding, variants and
// playback. The preloader and playback share one fetch, even if HTTP cache is off.
export function createSampleByteCache({ pack = bootAssets?.audio, fetchRef = (...args) => globalThis.fetch(...args), timeoutMs = 15000 } = {}) {
  const bytes = new Map(), requests = new Map();
  let packed = null;
  const fetchBytes = async url => {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchRef(url, { cache: pack ? "force-cache" : "default", signal: controller.signal });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}: ${url}`);
          return response.arrayBuffer();
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error(`Audio download timed out: ${url}`)); }, timeoutMs); })
      ]);
    } finally { clearTimeout(timer); }
  };
  const getPack = () => packed ||= fetchBytes(pack.url).then(buffer => {
    if (buffer.byteLength !== pack.byteLength) throw new Error("Incomplete audio package");
    for (const [file, entry] of Object.entries(pack.entries)) {
      if (!Number.isInteger(entry.offset) || !Number.isInteger(entry.length) || entry.offset < 0 || entry.length <= 0 || entry.offset + entry.length > buffer.byteLength) throw new Error(`Invalid audio entry: ${file}`);
      bytes.set(file, buffer.slice(entry.offset, entry.offset + entry.length));
    }
  }).catch(error => { packed = null; throw error; });
  const get = async file => {
    if (!sampleFiles.includes(file)) throw new Error(`Unregistered audio sample: ${file}`);
    if (!bytes.has(file)) {
      if (pack) {
        if (!pack.entries[file]) throw new Error(`Missing audio entry: ${file}`);
        await getPack();
      } else {
        if (!requests.has(file)) requests.set(file, fetchBytes(new URL(file, root).href).then(buffer => bytes.set(file, buffer)).finally(() => requests.delete(file)));
        await requests.get(file);
      }
    }
    // decodeAudioData may detach its input. Never expose the shared cached buffer.
    return bytes.get(file).slice(0);
  };
  const preload = async () => {
    if (pack) { await getPack(); return; }
    let cursor = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < sampleFiles.length) await get(sampleFiles[cursor++]);
    }));
  };
  return { get, preload, snapshot: () => ({ cached: bytes.size, packed: Boolean(pack), files: sampleFiles.length }) };
}
export const sampleByteCache = createSampleByteCache();
