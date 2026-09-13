import { sampleByteCache } from "../audio/SampleByteCache.js";
import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";

const DEFAULT_TIMEOUT_MS = 15000;
const REPO_ROOT_URL = new URL("../../../", import.meta.url);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function withTimeout(promise, timeoutMs, label, windowRef = globalThis.window) {
  if (!windowRef?.setTimeout) return promise;
  return new Promise((resolve, reject) => {
    const timer = windowRef.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    Promise.resolve(promise).then(value => {
      windowRef.clearTimeout(timer);
      resolve(value);
    }, error => {
      windowRef.clearTimeout(timer);
      reject(error);
    });
  });
}

function mediaReady(media) {
  if (!media) return Promise.reject(new Error("Main-menu theme element is missing."));
  if (media.readyState >= 3) return Promise.resolve(true);
  media.load?.();
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve(true);
    };
    const failed = () => {
      cleanup();
      reject(new Error("Main-menu theme failed to preload."));
    };
    const cleanup = () => {
      media.removeEventListener?.("canplaythrough", done);
      media.removeEventListener?.("canplay", done);
      media.removeEventListener?.("error", failed);
    };
    media.addEventListener?.("canplaythrough", done, { once: true });
    media.addEventListener?.("canplay", done, { once: true });
    media.addEventListener?.("error", failed, { once: true });
  });
}

async function fetchIntoCache(url, fetchRef = globalThis.fetch) {
  if (typeof fetchRef !== "function") throw new Error(`Cannot preload ${url}: fetch unavailable.`);
  const response = await fetchRef(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Asset preload failed (${response.status}): ${url}`);
  await response.arrayBuffer();
  return true;
}

function repositoryAssetUrl(path) {
  try {
    return new URL(path, REPO_ROOT_URL).href;
  } catch {
    return path;
  }
}

export function titlePreloadUrls(documentRef = globalThis.document) {
  const audio = SAMPLE_AUDIO_IDS
    .flatMap(id => sampleAudioDefinition(id)?.files || [])
    .map(repositoryAssetUrl);
  const images = documentRef
    ? [...documentRef.querySelectorAll?.("#viceblood-title-screen img") || []].map(node => node.currentSrc || node.src)
    : [];
  return unique([...audio, ...images]);
}

export async function preloadTitleExperience({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  fetchRef = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  sampleCache = sampleByteCache
} = {}) {
  const theme = documentRef?.getElementById?.("viceblood-main-menu-theme") || null;
  const urls = unique([...(documentRef?.querySelectorAll?.("#viceblood-title-screen img") || [])].map(node => node.currentSrc || node.src));
  const startedAt = Date.now();
  windowRef.NBD_TITLE_PRELOAD_STATE = Object.freeze({ state: "loading", total: urls.length + 2, ready: 0, startedAt });

  let ready = 0;
  const markReady = () => {
    ready += 1;
    windowRef.NBD_TITLE_PRELOAD_STATE = Object.freeze({ state: "loading", total: urls.length + 2, ready, startedAt });
  };

  const jobs = [
    withTimeout(sampleCache.preload().then(value => { markReady(); return value; }), timeoutMs, "Sound package", windowRef),
    withTimeout(mediaReady(theme).then(value => { markReady(); return value; }), timeoutMs, "Main-menu theme", windowRef),
    ...urls.map(url => withTimeout(fetchIntoCache(url, fetchRef).then(value => { markReady(); return value; }), timeoutMs, `Asset ${url}`, windowRef))
  ];

  await Promise.all(jobs);
  const completedAt = Date.now();
  windowRef.NBD_TITLE_PRELOAD_STATE = Object.freeze({ state: "ready", total: jobs.length, ready: jobs.length, startedAt, completedAt });
  return true;
}
