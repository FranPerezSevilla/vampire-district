import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";

const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);

class RawAudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.cooldowns = Object.create(null);
    this.keysDown = new Set();
    this.stepTimer = null;
    this.lastStep = 0;
    this.listenersReady = false;
    this.sampleBuffers = new Map();
    this.sampleLoads = new Map();
    this.sampleCursor = Object.create(null);
    this.sampleLoops = new Map();
    this.sampleLoopWanted = new Set();
  }

  ensureListeners() {
    if (this.listenersReady || typeof window === "undefined") return;
    this.listenersReady = true;

    window.addEventListener("pointerdown", () => this.unlock(), { passive: true });
    window.addEventListener("keydown", event => {
      this.unlock();
      if (KEY_SET.has(event.key)) this.keysDown.add(event.key.toLowerCase());
      if (event.key === "Shift") this.keysDown.add("shift");
      this.startStepLoop();
    }, { passive: true });
    window.addEventListener("keyup", event => {
      if (KEY_SET.has(event.key)) this.keysDown.delete(event.key.toLowerCase());
      if (event.key === "Shift") this.keysDown.delete("shift");
    }, { passive: true });
  }

  unlock() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.20;
      this.master.connect(this.ctx.destination);
      this.preloadRegisteredSamples();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  preloadRegisteredSamples() {
    if (!this.ctx || typeof fetch !== "function") return;
    for (const id of SAMPLE_AUDIO_IDS) this.loadSampleEvent(id);
  }

  loadSampleEvent(name) {
    const definition = sampleAudioDefinition(name);
    if (!definition || !this.ctx || typeof fetch !== "function") return null;
    if (this.sampleBuffers.has(name)) return Promise.resolve(this.sampleBuffers.get(name));
    if (this.sampleLoads.has(name)) return this.sampleLoads.get(name);

    const context = this.ctx;
    const task = Promise.all(definition.files.map(async file => {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Audio sample failed to load: ${file}`);
      const encoded = await response.arrayBuffer();
      return context.decodeAudioData(encoded);
    })).then(buffers => {
      if (this.ctx !== context) return [];
      this.sampleBuffers.set(name, buffers);
      return buffers;
    }).catch(() => {
      this.sampleLoads.delete(name);
      return [];
    });

    this.sampleLoads.set(name, task);
    return task;
  }

  playSample(name, options = {}) {
    const definition = sampleAudioDefinition(name);
    if (!definition || !this.ctx || !this.master) return false;
    const buffers = this.sampleBuffers.get(name);
    if (!buffers?.length) {
      this.loadSampleEvent(name);
      return false;
    }

    try {
      const cursor = this.sampleCursor[name] || 0;
      const buffer = buffers[cursor % buffers.length];
      this.sampleCursor[name] = (cursor + 1) % buffers.length;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = Math.max(0, Number(options.sampleVolume ?? definition.volume) || 0);
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      return true;
    } catch {
      return false;
    }
  }

  startSampleLoop(name, options = {}) {
    const definition = sampleAudioDefinition(name);
    if (!definition?.loop) return false;
    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return false;

    this.sampleLoopWanted.add(name);
    if (this.sampleLoops.has(name)) return true;

    const buffers = this.sampleBuffers.get(name);
    if (!buffers?.length) {
      this.loadSampleEvent(name)?.then(() => {
        if (this.sampleLoopWanted.has(name)) this.startSampleLoop(name, options);
      });
      return false;
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffers[0];
      source.loop = true;
      gain.gain.value = Math.max(0, Number(options.sampleVolume ?? definition.volume) || 0);
      source.connect(gain);
      gain.connect(this.master);
      const handle = { source, gain };
      this.sampleLoops.set(name, handle);
      source.onended = () => {
        if (this.sampleLoops.get(name) === handle) this.sampleLoops.delete(name);
      };
      const delay = Math.max(0, Number(options.delay) || 0);
      source.start(ctx.currentTime + delay);
      return true;
    } catch {
      this.sampleLoops.delete(name);
      return false;
    }
  }

  stopSampleLoop(name) {
    this.sampleLoopWanted.delete(name);
    const handle = this.sampleLoops.get(name);
    if (!handle) return false;
    this.sampleLoops.delete(name);
    try { handle.source.stop(); } catch {}
    try { handle.source.disconnect(); } catch {}
    try { handle.gain.disconnect(); } catch {}
    return true;
  }

  startStepLoop() {
    if (this.stepTimer || typeof window === "undefined") return;
    this.stepTimer = window.setInterval(() => {
      if (!this.isMoving()) return;
      const now = performance.now();
      const sprint = this.keysDown.has("shift");
      const gap = sprint ? 145 : 230;
      if (now - this.lastStep < gap) return;
      this.lastStep = now;
      this.play(sprint ? "sprintStep" : "step");
    }, 40);
  }

  isMoving() {
    return ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].some(key => this.keysDown.has(key));
  }

  play(name, options = {}) {
    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return;

    const now = ctx.currentTime;
    const gap = options.cooldown ?? this.defaultCooldown(name);
    if (this.cooldowns[name] && this.cooldowns[name] > now) return;
    this.cooldowns[name] = now + gap;

    if (this.playSample(name, options)) return;

    switch (name) {
      case "step": return this.step(false);
      case "sprintStep": return this.step(true);
      case "dash": return this.dash();
      case "dashFail": return this.fail(150);
      case "whisper": return this.whisper(false);
      case "whisperFail": return this.fail(280);
      case "sense": return this.sense();
      case "weaponFire": return this.weaponFireFallback();
      case "stun": return this.hit(120, 0.055, 0.12);
      case "kill": return this.hit(70, 0.10, 0.18);
      case "drainStart": return this.drainStart();
      case "drainComplete": return this.drainComplete();
      case "drainCancel": return this.fail(120);
      case "bodyDrag": return this.scrape();
      case "bodyDrop": return this.hit(85, 0.045, 0.10);
      case "bodyHide": return this.hide();
      case "breakLight": return this.glass();
      case "routeRoof": return this.roofJump();
      case "routeClimb": return this.climb();
      case "routeSewer": return this.sewer();
      case "witnessWtf": return this.gasp();
      case "civilianScream": return this.gasp();
      case "witnessRun": return this.alarmBlip(520);
      case "witnessReport": return this.report();
      case "masqueradeFail": return this.masqueradeFail();
      case "police": return this.police();
      case "hunter": return this.hunter();
      case "missionComplete": return this.complete();
      case "menu": return this.uiTick(420);
      case "confirm": return this.uiTick(620);
      case "cancel": return this.uiTick(180);
      default: return this.uiTick(360);
    }
  }

  defaultCooldown(name) {
    if (name === "step" || name === "sprintStep") return 0.05;
    if (name === "police" || name === "hunter") return 1.2;
    if (name === "witnessWtf" || name === "witnessRun" || name === "civilianScream") return 0.9;
    return 0.12;
  }

  tone(freq, dur, options = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const when = ctx.currentTime + (options.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(freq, when);
    if (options.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), when + dur);
    filter.type = options.filterType || "lowpass";
    filter.frequency.setValueAtTime(options.filter || 2200, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.05, when + (options.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  noise(dur, options = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const samples = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const when = ctx.currentTime + (options.delay || 0);
    filter.type = options.filterType || "bandpass";
    filter.frequency.value = options.filter || 1200;
    filter.Q.value = options.q || 0.8;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.04, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  step(sprint) {
    this.noise(sprint ? 0.045 : 0.035, { volume: sprint ? 0.030 : 0.020, filter: sprint ? 190 : 150, filterType: "lowpass" });
    this.tone(sprint ? 86 : 70, 0.035, { volume: sprint ? 0.020 : 0.012, type: "triangle", filter: 260 });
  }

  dash() {
    this.noise(0.22, { volume: 0.075, filter: 900, filterType: "highpass" });
    this.tone(260, 0.18, { to: 70, volume: 0.055, type: "sawtooth", filter: 1400 });
  }

  whisper() {
    this.tone(420, 0.34, { to: 580, volume: 0.045, type: "sine", filter: 1600 });
    this.tone(630, 0.28, { delay: 0.04, to: 370, volume: 0.030, type: "triangle", filter: 1400 });
  }

  sense() {
    this.tone(110, 0.25, { to: 220, volume: 0.035, type: "sine", filter: 800 });
    this.tone(880, 0.12, { delay: 0.06, to: 440, volume: 0.025, type: "triangle", filter: 2400 });
  }

  weaponFireFallback() {
    this.noise(0.10, { volume: 0.12, filter: 1650, filterType: "highpass" });
    this.tone(190, 0.13, { to: 58, volume: 0.082, type: "square", filter: 1500 });
    this.tone(820, 0.05, { delay: 0.01, to: 210, volume: 0.035, type: "sawtooth", filter: 2500 });
  }

  hit(freq, vol, dur) {
    this.tone(freq, dur, { to: Math.max(30, freq * 0.55), volume: vol, type: "triangle", filter: 520 });
    this.noise(dur * 0.8, { volume: vol * 0.55, filter: 360, filterType: "lowpass" });
  }

  drainStart() {
    this.tone(92, 0.18, { volume: 0.040, type: "sine", filter: 600 });
    this.tone(92, 0.18, { delay: 0.28, volume: 0.030, type: "sine", filter: 600 });
    this.noise(0.42, { volume: 0.030, filter: 520, filterType: "bandpass" });
  }

  drainComplete() {
    this.tone(150, 0.42, { to: 52, volume: 0.080, type: "sawtooth", filter: 900 });
    this.noise(0.36, { volume: 0.070, filter: 300, filterType: "lowpass" });
  }

  scrape() {
    this.noise(0.20, { volume: 0.040, filter: 260, filterType: "bandpass", q: 1.8 });
  }

  hide() {
    this.noise(0.18, { volume: 0.035, filter: 180, filterType: "lowpass" });
    this.tone(210, 0.12, { to: 140, volume: 0.018, type: "triangle" });
  }

  glass() {
    this.noise(0.16, { volume: 0.075, filter: 2400, filterType: "highpass" });
    this.tone(1200, 0.08, { delay: 0.02, to: 430, volume: 0.030, type: "square", filter: 2600 });
  }

  roofJump() {
    this.noise(0.18, { volume: 0.035, filter: 700, filterType: "highpass" });
    this.tone(220, 0.22, { to: 90, volume: 0.032, type: "triangle" });
  }

  climb() {
    this.tone(190, 0.07, { volume: 0.028, type: "square", filter: 900 });
    this.tone(240, 0.06, { delay: 0.09, volume: 0.020, type: "square", filter: 900 });
  }

  sewer() {
    this.tone(80, 0.24, { to: 55, volume: 0.045, type: "sine", filter: 500 });
    this.noise(0.22, { volume: 0.026, filter: 320, filterType: "lowpass" });
  }

  gasp() {
    this.tone(720, 0.08, { to: 560, volume: 0.032, type: "triangle", filter: 2000 });
    this.noise(0.09, { volume: 0.025, filter: 1600, filterType: "highpass" });
  }

  alarmBlip(freq) {
    this.tone(freq, 0.10, { volume: 0.040, type: "square", filter: 1800 });
    this.tone(freq * 1.18, 0.10, { delay: 0.12, volume: 0.032, type: "square", filter: 1800 });
  }

  report() {
    this.alarmBlip(760);
    this.tone(190, 0.36, { delay: 0.08, to: 120, volume: 0.040, type: "sawtooth", filter: 800 });
  }

  masqueradeFail() {
    this.tone(70, 0.72, { volume: 0.095, type: "sawtooth", filter: 900 });
    this.tone(420, 0.28, { delay: 0.06, to: 120, volume: 0.055, type: "square", filter: 1400 });
    this.noise(0.55, { volume: 0.070, filter: 700, filterType: "bandpass" });
  }

  police() {
    this.alarmBlip(620);
  }

  hunter() {
    this.tone(58, 0.55, { to: 42, volume: 0.075, type: "sawtooth", filter: 600 });
    this.noise(0.28, { volume: 0.030, filter: 180, filterType: "lowpass" });
  }

  complete() {
    this.tone(260, 0.16, { volume: 0.032, type: "triangle" });
    this.tone(390, 0.18, { delay: 0.12, volume: 0.030, type: "triangle" });
    this.tone(520, 0.24, { delay: 0.26, volume: 0.026, type: "triangle" });
  }

  fail(freq) {
    this.tone(freq, 0.16, { to: Math.max(50, freq * 0.55), volume: 0.028, type: "square", filter: 900 });
  }

  uiTick(freq) {
    this.tone(freq, 0.045, { volume: 0.015, type: "triangle", filter: 1200 });
  }
}

export const RawAudio = new RawAudioBus();
RawAudio.ensureListeners();
