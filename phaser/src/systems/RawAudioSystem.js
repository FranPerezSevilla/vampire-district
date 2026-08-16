import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";

const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
const RAW_AUDIO_MASTER_GAIN = 0.20;
const NARRATIVE_DUCK_FACTOR = 0.54;
const MAX_VEHICLE_ENGINE_VOICES = 10;
const VEHICLE_ENGINE_PROFILES = Object.freeze({
  compact: Object.freeze({ idleHz: 48, redlineHz: 126, filterBase: 520, filterRange: 1050, volume: 0.115, wave: "sawtooth", harmonic: 0.18 }),
  sedan: Object.freeze({ idleHz: 43, redlineHz: 112, filterBase: 470, filterRange: 930, volume: 0.112, wave: "sawtooth", harmonic: 0.17 }),
  van: Object.freeze({ idleHz: 35, redlineHz: 88, filterBase: 390, filterRange: 760, volume: 0.125, wave: "square", harmonic: 0.14 }),
  police: Object.freeze({ idleHz: 47, redlineHz: 128, filterBase: 540, filterRange: 1100, volume: 0.118, wave: "sawtooth", harmonic: 0.19 })
});

class RawAudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.narrativeMaster = null;
    this.narrativeDuckKeys = new Set();
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
    this.sampleLoopTimers = new Map();
    this.vehicleEngineVoices = new Map();
    this.vehicleEngineFrame = 0;
    this.vehicleEngineFrameOpen = false;
    this.vehicleEnginePaused = false;
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
      this.master.gain.value = RAW_AUDIO_MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      this.narrativeMaster = this.ctx.createGain();
      this.narrativeMaster.gain.value = RAW_AUDIO_MASTER_GAIN;
      this.narrativeMaster.connect(this.ctx.destination);
      this.preloadRegisteredSamples();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  sampleDestination(name) {
    const definition = sampleAudioDefinition(name);
    return definition?.bus === "narrative"
      ? (this.narrativeMaster || this.master)
      : this.master;
  }

  updateNarrativeDuck(timeConstant = 0.04) {
    if (!this.ctx || !this.master) return false;
    const target = RAW_AUDIO_MASTER_GAIN * (this.narrativeDuckKeys.size ? NARRATIVE_DUCK_FACTOR : 1);
    const now = this.ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(target, now, Math.max(0.015, Number(timeConstant) || 0.04));
    } catch {
      this.master.gain.value = target;
    }
    return true;
  }

  beginNarrativeDuck(key = "default") {
    this.ensureListeners();
    this.unlock();
    this.narrativeDuckKeys.add(String(key || "default"));
    return this.updateNarrativeDuck(0.035);
  }

  endNarrativeDuck(key = "default") {
    this.narrativeDuckKeys.delete(String(key || "default"));
    return this.updateNarrativeDuck(0.12);
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
      gain.connect(this.sampleDestination(name));
      const delay = Math.max(0, Number(options.delay) || 0);
      source.start(this.ctx.currentTime + delay);
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
      gain.connect(this.sampleDestination(name));
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

  pulseSampleLoop(name, options = {}) {
    const hold = Math.max(0.16, Number(options.hold) || 0.34);
    const started = this.startSampleLoop(name, options);
    const previousTimer = this.sampleLoopTimers.get(name);
    if (previousTimer && typeof window !== "undefined") window.clearTimeout(previousTimer);
    if (typeof window !== "undefined") {
      const timer = window.setTimeout(() => {
        this.sampleLoopTimers.delete(name);
        this.stopSampleLoop(name);
      }, hold * 1000);
      this.sampleLoopTimers.set(name, timer);
    }
    if (!started && name === "vehicleSkidLoop") this.vehicleSkid();
    return started;
  }

  stopSampleLoop(name) {
    this.sampleLoopWanted.delete(name);
    const timer = this.sampleLoopTimers.get(name);
    if (timer && typeof window !== "undefined") window.clearTimeout(timer);
    this.sampleLoopTimers.delete(name);
    const handle = this.sampleLoops.get(name);
    if (!handle) return false;
    this.sampleLoops.delete(name);
    try { handle.source.stop(); } catch {}
    try { handle.source.disconnect(); } catch {}
    try { handle.gain.disconnect(); } catch {}
    return true;
  }

  beginVehicleEngineFrame({ paused = false } = {}) {
    this.vehicleEngineFrame += 1;
    this.vehicleEngineFrameOpen = true;
    this.vehicleEnginePaused = Boolean(paused);
    if (this.vehicleEnginePaused) this.stopAllVehicleEngines();
    return this.vehicleEngineFrame;
  }

  endVehicleEngineFrame() {
    if (!this.vehicleEngineFrameOpen) return;
    const frame = this.vehicleEngineFrame;
    for (const [id, voice] of [...this.vehicleEngineVoices.entries()]) {
      if (voice.frame !== frame) this.stopVehicleEngine(id);
    }
    this.vehicleEngineFrameOpen = false;
  }

  vehicleEngineProfile(profileId) {
    return VEHICLE_ENGINE_PROFILES[String(profileId || "")] || VEHICLE_ENGINE_PROFILES.sedan;
  }

  createVehicleEngineVoice(id, profileId, priority = 0, audibility = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const profile = this.vehicleEngineProfile(profileId);
    if (this.vehicleEngineVoices.size >= MAX_VEHICLE_ENGINE_VOICES) {
      const ranked = [...this.vehicleEngineVoices.entries()]
        .sort((left, right) => ((left[1].priority || 0) * 2 + (left[1].audibility || 0)) - ((right[1].priority || 0) * 2 + (right[1].audibility || 0)));
      const [quietestId, quietest] = ranked[0] || [];
      const incomingScore = Math.max(0, Number(priority) || 0) * 2 + Math.max(0, Number(audibility) || 0);
      const quietestScore = (quietest?.priority || 0) * 2 + (quietest?.audibility || 0);
      if (!quietestId || quietestScore >= incomingScore) return null;
      this.stopVehicleEngine(quietestId);
    }

    try {
      const primary = ctx.createOscillator();
      const secondary = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
      primary.type = profile.wave;
      secondary.type = "triangle";
      harmonicGain.gain.value = profile.harmonic;
      filter.type = "lowpass";
      filter.Q.value = 0.72;
      gain.gain.value = 0.0001;
      primary.connect(filter);
      secondary.connect(harmonicGain);
      harmonicGain.connect(filter);
      filter.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.master);
      } else {
        gain.connect(this.master);
      }
      const voice = { id, profileId, profile, primary, secondary, harmonicGain, filter, gain, panner, frame: this.vehicleEngineFrame, priority, audibility };
      this.vehicleEngineVoices.set(id, voice);
      primary.start();
      secondary.start();
      return voice;
    } catch {
      return null;
    }
  }

  updateVehicleEngine(id, options = {}) {
    const key = String(id || "");
    if (!key) return false;
    const audibility = Math.max(0, Math.min(1, Number(options.audibility) || 0));
    if (this.vehicleEnginePaused || audibility <= 0.002 || options.active === false) {
      this.stopVehicleEngine(key);
      return false;
    }

    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return false;
    const priority = Math.max(0, Number(options.priority) || 0);
    let voice = this.vehicleEngineVoices.get(key);
    if (!voice) voice = this.createVehicleEngineVoice(key, options.profileId, priority, audibility);
    if (!voice) return false;

    const profile = voice.profile;
    const rpm = Math.max(0.18, Math.min(1, Number(options.rpm) || 0.18));
    const load = Math.max(0.12, Math.min(1, Number(options.load) || 0.12));
    const frequency = profile.idleHz + (profile.redlineHz - profile.idleHz) * rpm;
    const gainTarget = Math.max(0.0001, profile.volume * audibility * (0.42 + rpm * 0.36 + load * 0.22));
    const filterTarget = profile.filterBase + profile.filterRange * (0.30 + rpm * 0.70);
    const panTarget = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    const now = ctx.currentTime;

    voice.primary.frequency.setTargetAtTime(Math.max(24, frequency), now, 0.035);
    voice.secondary.frequency.setTargetAtTime(Math.max(35, frequency * 2.01), now, 0.040);
    voice.filter.frequency.setTargetAtTime(Math.max(120, filterTarget), now, 0.055);
    voice.gain.gain.setTargetAtTime(gainTarget, now, 0.045);
    voice.panner?.pan?.setTargetAtTime?.(panTarget, now, 0.055);
    voice.frame = this.vehicleEngineFrame;
    voice.priority = priority;
    voice.audibility = audibility;
    voice.rpm = rpm;
    voice.load = load;
    voice.pan = panTarget;
    return true;
  }

  stopVehicleEngine(id) {
    const key = String(id || "");
    const voice = this.vehicleEngineVoices.get(key);
    if (!voice) return false;
    this.vehicleEngineVoices.delete(key);
    const ctx = this.ctx;
    const when = (ctx?.currentTime || 0) + 0.10;
    try { voice.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025); } catch {}
    try { voice.primary.stop(when); } catch {}
    try { voice.secondary.stop(when); } catch {}
    const disconnect = () => {
      try { voice.primary.disconnect(); } catch {}
      try { voice.secondary.disconnect(); } catch {}
      try { voice.harmonicGain.disconnect(); } catch {}
      try { voice.filter.disconnect(); } catch {}
      try { voice.gain.disconnect(); } catch {}
      try { voice.panner?.disconnect?.(); } catch {}
    };
    voice.primary.onended = disconnect;
    return true;
  }

  stopAllVehicleEngines() {
    for (const id of [...this.vehicleEngineVoices.keys()]) this.stopVehicleEngine(id);
  }

  vehicleEngineSnapshot() {
    return [...this.vehicleEngineVoices.values()].map(voice => ({
      id: voice.id,
      profileId: voice.profileId,
      rpm: Number(voice.rpm) || 0,
      load: Number(voice.load) || 0,
      pan: Number(voice.pan) || 0,
      audibility: Number(voice.audibility) || 0,
      priority: Number(voice.priority) || 0
    }));
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

    if (name === "vehicleSkidLoop" && sampleAudioDefinition(name)?.loop) {
      this.pulseSampleLoop(name, { ...options, hold: 0.34 });
      return;
    }

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
      case "vehicleDoorOpen": return this.vehicleDoorOpen();
      case "vehicleDoorClose": return this.vehicleDoorClose(options.delay);
      case "vehicleCollisionLight": return this.vehicleCollision(false);
      case "vehicleCollisionHeavy": return this.vehicleCollision(true);
      case "vehicleSkidLoop": return this.vehicleSkid();
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
    if (name === "vehicleSkidLoop") return 0.16;
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

  vehicleDoorOpen() {
    this.noise(0.10, { volume: 0.026, filter: 1180, filterType: "bandpass", q: 1.05 });
    this.tone(132, 0.13, { delay: 0.035, to: 66, volume: 0.026, type: "triangle", filter: 560 });
  }

  vehicleDoorClose(delay = 0) {
    const baseDelay = Math.max(0, Number(delay) || 0);
    this.noise(0.12, { delay: baseDelay, volume: 0.040, filter: 760, filterType: "bandpass", q: 0.82 });
    this.tone(96, 0.17, { delay: baseDelay + 0.015, to: 44, volume: 0.045, type: "triangle", filter: 420 });
  }

  vehicleSkid() {
    this.noise(0.22, { volume: 0.050, filter: 1850, filterType: "bandpass", q: 1.35 });
    this.noise(0.16, { delay: 0.025, volume: 0.026, filter: 2800, filterType: "highpass", q: 0.9 });
    this.tone(1180, 0.16, { to: 720, volume: 0.014, type: "sawtooth", filter: 2400 });
  }

  vehicleCollision(heavy = false) {
    const duration = heavy ? 0.28 : 0.16;
    this.noise(duration, {
      volume: heavy ? 0.095 : 0.058,
      filter: heavy ? 680 : 980,
      filterType: "bandpass",
      q: heavy ? 0.68 : 0.82
    });
    this.tone(heavy ? 72 : 108, duration * 0.88, {
      to: heavy ? 38 : 58,
      volume: heavy ? 0.075 : 0.042,
      type: "triangle",
      filter: heavy ? 420 : 620
    });
    this.noise(heavy ? 0.19 : 0.11, {
      delay: 0.025,
      volume: heavy ? 0.038 : 0.022,
      filter: heavy ? 1900 : 2300,
      filterType: "highpass",
      q: 0.9
    });
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