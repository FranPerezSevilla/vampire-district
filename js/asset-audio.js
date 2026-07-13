(() => {
  "use strict";

  const STORAGE_KEY = "vampire-district-audio-settings";
  const DEFAULT_SETTINGS = {
    enabled: true,
    masterVolume: 0.85,
    sfxVolume: 0.9
  };

  const EVENT_NAMES = [
    "footstep",
    "sprintStep",
    "drag",
    "dash",
    "whisper",
    "sense",
    "feedStart",
    "feedFinish",
    "brutalFeed",
    "glass",
    "rooftopJump",
    "roofDrop",
    "landingLight",
    "landingHeavy",
    "alert",
    "police",
    "hunterReveal",
    "bodyHide",
    "missionComplete"
  ];

  const lastPlayed = Object.create(null);
  const pools = new Map();
  let roundRobin = Object.create(null);
  let settings = loadSettings();

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("vd-audio-settings-changed", { detail: getSettings() }));
  }

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function library() {
    return window.VD_AUDIO_LIBRARY || { events: {}, all: [], unmapped: [] };
  }

  function eventFiles(name) {
    const events = library().events || {};
    return Array.isArray(events[name]) ? events[name].filter(Boolean) : [];
  }

  function canPlayNow(name) {
    const now = performance.now();
    const gap = name.includes("step") ? 95 : name === "alert" ? 320 : 35;
    if ((lastPlayed[name] || 0) + gap > now) return false;
    lastPlayed[name] = now;
    return true;
  }

  function makeAudio(path) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    return audio;
  }

  function getPool(path) {
    if (!pools.has(path)) {
      pools.set(path, [makeAudio(path), makeAudio(path), makeAudio(path)]);
    }
    return pools.get(path);
  }

  function pickFile(name) {
    const files = eventFiles(name);
    if (!files.length) return "";
    const idx = roundRobin[name] || 0;
    roundRobin[name] = (idx + 1) % files.length;
    return files[idx % files.length];
  }

  function play(name, intensity = 1, opts = {}) {
    if (!settings.enabled && !opts.force) return true;
    if (!canPlayNow(name) && !opts.force) return true;

    const file = opts.path || pickFile(name);
    if (!file) {
      // Intentionally silent: many prototype events are currently unmapped after review.
      if (opts.force) console.warn(`[VD audio] No approved asset mapped for event: ${name}`);
      return true;
    }

    const pool = getPool(file);
    const audio = pool.find((item) => item.paused || item.ended) || pool[0];
    const volume = clamp01(settings.masterVolume * settings.sfxVolume * Number(intensity || 1));

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch((err) => console.warn(`[VD audio] Could not play ${file}`, err));
      }
    } catch (err) {
      console.warn(`[VD audio] Could not play ${file}`, err);
    }

    return true;
  }

  function preload() {
    const files = new Set();
    for (const name of EVENT_NAMES) {
      for (const file of eventFiles(name)) files.add(file);
    }
    for (const file of files) getPool(file);
  }

  function getSettings() {
    return { ...settings };
  }

  function setSettings(next = {}) {
    settings = {
      ...settings,
      enabled: next.enabled === undefined ? settings.enabled : Boolean(next.enabled),
      masterVolume: next.masterVolume === undefined ? settings.masterVolume : clamp01(next.masterVolume),
      sfxVolume: next.sfxVolume === undefined ? settings.sfxVolume : clamp01(next.sfxVolume)
    };
    saveSettings();
  }

  function mappedEvents() {
    const events = library().events || {};
    return EVENT_NAMES.map((name) => ({
      name,
      files: Array.isArray(events[name]) ? events[name] : []
    }));
  }

  window.VD_AUDIO_EVENTS = EVENT_NAMES;
  window.VD_ASSET_AUDIO = {
    play,
    preload,
    getSettings,
    setSettings,
    mappedEvents,
    eventFiles,
    get library() {
      return library();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preload, { once: true });
  } else {
    preload();
  }
})();
