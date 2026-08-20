import { sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const FEED_LOOP_EVENT = "drainLoop";
const FEED_LOOP_DELAY_MS = 450;
const FEED_DUCK_KEY = "feeding";
const FEED_DUCK_RELEASE_MS = 320;

export class FeedingAudioLoopPolicy {
  constructor(scene) {
    this.scene = scene;
    this.source = null;
    this.gain = null;
    this.timer = null;
    this.duckReleaseTimer = null;
    this.generation = 0;

    scene.events?.on?.("feeding:started", this.onFeedingStarted, this);
    scene.events?.on?.("feeding:resolved", this.onFeedingStopped, this);
    scene.events?.on?.("feeding:cancelled", this.onFeedingStopped, this);
    scene.events?.on?.("feeding:interrupted", this.onFeedingStopped, this);
  }

  onFeedingStarted() {
    this.stopLoop();
    if (this.duckReleaseTimer != null) {
      window.clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    RawAudio.beginNarrativeDuck?.(FEED_DUCK_KEY);
    const generation = ++this.generation;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.startLoop(generation);
    }, FEED_LOOP_DELAY_MS);
  }

  onFeedingStopped() {
    this.generation += 1;
    this.stopLoop();
    if (this.duckReleaseTimer != null) window.clearTimeout(this.duckReleaseTimer);
    this.duckReleaseTimer = window.setTimeout(() => {
      this.duckReleaseTimer = null;
      RawAudio.endNarrativeDuck?.(FEED_DUCK_KEY);
    }, FEED_DUCK_RELEASE_MS);
  }

  async startLoop(generation) {
    if (generation !== this.generation || !this.scene.feedingSystem?.active) return;

    const definition = sampleAudioDefinition(FEED_LOOP_EVENT);
    const context = RawAudio.unlock?.();
    if (!definition?.loop || !context || !RawAudio.master) return;

    await RawAudio.loadSampleEvent?.(FEED_LOOP_EVENT);
    if (generation !== this.generation || !this.scene.feedingSystem?.active) return;

    const buffers = RawAudio.sampleBuffers?.get?.(FEED_LOOP_EVENT);
    if (!buffers?.length) return;

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffers[0];
      source.loop = true;
      gain.gain.value = Math.max(0, Number(definition.volume) || 0);
      source.connect(gain);
      gain.connect(RawAudio.sampleDestination?.(FEED_LOOP_EVENT) || RawAudio.master);
      source.onended = () => {
        if (this.source === source) {
          this.source = null;
          this.gain = null;
        }
      };
      this.source = source;
      this.gain = gain;
      source.start();
    } catch {
      this.source = null;
      this.gain = null;
    }
  }

  stopLoop() {
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.source) {
      try { this.source.stop(); } catch {}
      try { this.source.disconnect(); } catch {}
    }
    if (this.gain) {
      try { this.gain.disconnect(); } catch {}
    }
    this.source = null;
    this.gain = null;
  }

  destroy() {
    this.generation += 1;
    this.stopLoop();
    if (this.duckReleaseTimer != null) {
      window.clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    RawAudio.endNarrativeDuck?.(FEED_DUCK_KEY);
    this.scene.events?.off?.("feeding:started", this.onFeedingStarted, this);
    this.scene.events?.off?.("feeding:resolved", this.onFeedingStopped, this);
    this.scene.events?.off?.("feeding:cancelled", this.onFeedingStopped, this);
    this.scene.events?.off?.("feeding:interrupted", this.onFeedingStopped, this);
  }
}
