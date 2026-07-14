(() => {
    "use strict";

    // =========================================================
    // Night Blood District
    // Single-file top-down HTML + CSS + vanilla JS prototype.
    //
    // File layout:
    // 01. DOM / CANVAS / GLOBAL CONFIG
    // 02. BALANCE / FEATURES / FUTURE ASSET FLAGS
    // 03. INPUT
    // 04. GAME STATE
    // 05. MAP DATA
    // 06. NPC DATA
    // 07. SMALL UTILS
    // 08. AUDIO SCAFFOLDING
    // 09. GAMEPLAY SYSTEMS
    // 10. AI
    // 11. RENDERING
    // 12. UI
    // 13. MAIN LOOP
    //
    // Intention: keep this as one portable index.html, but organized
    // like a small project so it remains easy to edit with ChatGPT.
    // =========================================================

    // ---------------------------------------------------------
    // 01. DOM / CANVAS / GLOBAL CONFIG
    // ---------------------------------------------------------

    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const ui = {
      hungerFill: document.getElementById("hungerFill"),
      hungerValue: document.getElementById("hungerValue"),
      exposureFill: document.getElementById("exposureFill"),
      exposureValue: document.getElementById("exposureValue"),
      dashState: document.getElementById("dashState"),
      missionText: document.getElementById("missionText"),
      layerText: document.getElementById("layerText"),
      visibilityText: document.getElementById("visibilityText"),
      messageLine: document.getElementById("messageLine"),
      legendLine: document.getElementById("legendLine"),
      startOverlay: document.getElementById("startOverlay"),
      startButton: document.getElementById("startButton")
    };

    let VIEW_W = canvas.width;
    let VIEW_H = canvas.height;
    const WORLD_W = 960;
    const WORLD_H = 640;

    const LAYER = {
      SEWER: -1,
      STREET: 0,
      ROOF_LOW: 1,
      ROOF_HIGH: 2
    };

    const LAYER_NAME = {
      [-1]: "Sewers",
      [0]: "Street",
      [1]: "Low rooftop",
      [2]: "High rooftop"
    };

    // ---------------------------------------------------------
    // 02. BALANCE / FEATURES / FUTURE ASSET FLAGS
    // ---------------------------------------------------------
    // Keep numbers here whenever possible. If something feels wrong
    // during playtesting, this is the first place to tweak.

    const BALANCE = {
      // Player
      startHunger: 48,
      playerBaseSpeed: 72,
      playerSprintMultiplier: 1.55,
      bodyDragMultiplier: 0.56,

      // Powers: powers are always available if off cooldown, but they increase hunger.
      dashHunger: 12,
      whisperHunger: 8,
      senseHunger: 3,
      dashBaseDistance: 72,
      dashBaseCooldown: 3.0,

      // Feeding
      targetFeedRelief: 60,
      civilianFeedRelief: 40,

      // Threat pressure
      exposurePerLevel: 25,
      maxPolice: 4,
      maxHunters: 2,
      maxDynamicCivilians: 3,
      maxTotalLivingCivilians: 15,
      dynamicEventMinDelay: 24,
      dynamicEventMaxDelay: 38,
      hunterRouteBlockMinLevel: 4,
      policeChaseSpeedMul: 0.72,
      hunterChaseSpeedMul: 0.82,
      enemyLostSightMul: 0.64,
      policeInvestigationSpeedMul: 0.46,
      hunterInvestigationSpeedMul: 0.52,

      // Cinematic traversal
      cinematicSlowdown: 0.045
    };

    const FEATURES = {
      useSprites: false,
      proceduralAudio: true
    };

    const SPRITES = {
      // Future-ready: keep these null while drawing characters by code.
      vampire: null,
      journalist: null,
      civilian: null,
      police: null,
      hunter: null,
      lamp: null,
      camera: null
    };

    // ---------------------------------------------------------
    // 03. PROCEDURAL AUDIO
    // ---------------------------------------------------------
    // One-file friendly: no .wav/.mp3 assets. Everything is generated via Web Audio.
    // Browsers require a user gesture, so AudioBus.unlock() is called when the order starts.

    const AudioBus = {
      ctx: null,
      master: null,
      ambience: null,
      lastPlayed: Object.create(null),
      enabled: FEATURES.proceduralAudio,

      unlock() {
        if (!this.enabled) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!this.ctx) {
          this.ctx = new AudioCtx();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.20;
          this.master.connect(this.ctx.destination);
          this.startAmbience();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
      },

      now() {
        return this.ctx ? this.ctx.currentTime : 0;
      },

      canPlay(name, minGap = 0.04) {
        const t = this.now();
        if ((this.lastPlayed[name] || 0) + minGap > t) return false;
        this.lastPlayed[name] = t;
        return true;
      },

      makeGain(gain = 0.3, delay = 0, duration = 0.18, curve = "fast") {
        const t = this.now() + delay;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
        const end = t + duration;
        if (curve === "hold") g.gain.setValueAtTime(gain, Math.max(t + 0.014, end - 0.06));
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        g.connect(this.master);
        return { gain: g, start: t, end };
      },

      tone(freq = 220, gain = 0.15, duration = 0.15, type = "sine", opts = {}) {
        if (!this.ctx) return;
        const env = this.makeGain(gain, opts.delay || 0, duration, opts.curve || "fast");
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, env.start);
        if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), env.end);
        if (opts.detune) osc.detune.setValueAtTime(opts.detune, env.start);
        osc.connect(env.gain);
        osc.start(env.start);
        osc.stop(env.end + 0.02);
      },

      noise(gain = 0.18, duration = 0.16, opts = {}) {
        if (!this.ctx) return;
        const sr = this.ctx.sampleRate;
        const length = Math.max(1, Math.floor(sr * duration));
        const buffer = this.ctx.createBuffer(1, length, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, opts.decay ?? 0.8);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        let node = src;
        if (opts.filter) {
          const f = this.ctx.createBiquadFilter();
          f.type = opts.filter.type || "bandpass";
          f.frequency.value = opts.filter.freq || 900;
          f.Q.value = opts.filter.q || 0.8;
          node.connect(f);
          node = f;
        }
        const env = this.makeGain(gain, opts.delay || 0, duration, opts.curve || "fast");
        node.connect(env.gain);
        src.start(env.start);
        src.stop(env.end + 0.02);
      },

      startAmbience() {
        if (!this.ctx || this.ambience) return;
        const hum = this.ctx.createOscillator();
        const humGain = this.ctx.createGain();
        hum.type = "sine";
        hum.frequency.value = 48;
        humGain.gain.value = 0.018;
        hum.connect(humGain);
        humGain.connect(this.master);
        hum.start();

        const high = this.ctx.createOscillator();
        const highGain = this.ctx.createGain();
        high.type = "triangle";
        high.frequency.value = 96;
        highGain.gain.value = 0.006;
        high.connect(highGain);
        highGain.connect(this.master);
        high.start();
        this.ambience = { hum, humGain, high, highGain };
      },

      update(dt) {
        if (!this.enabled || !this.ctx || !this.ambience) return;
        const t = this.now();
        const layer = player.layer;
        const level = exposureLevel();
        const hunger = player.hunger / 100;
        let humFreq = 48;
        let humGain = 0.018;
        let highGain = 0.006;
        if (layer === LAYER.SEWER) { humFreq = 38; humGain = 0.025; highGain = 0.002; }
        else if (layer > LAYER.STREET) { humFreq = 62; humGain = 0.012; highGain = 0.010; }
        if (player.inSafehouse) { humFreq = 42; humGain = 0.010; highGain = 0.001; }
        humGain += level * 0.002 + hunger * 0.006;
        this.ambience.hum.frequency.setTargetAtTime(humFreq + level * 2, t, 0.25);
        this.ambience.humGain.gain.setTargetAtTime(humGain, t, 0.4);
        this.ambience.highGain.gain.setTargetAtTime(highGain + (level >= 3 ? 0.008 : 0), t, 0.4);
      },

      play(name, intensity = 1) {
        // Kenney/repo asset audio replaces the procedural hardcoded event sounds.
        // When the asset runtime is loaded, do not fall back to procedural tones/noise.
        if (window.VD_ASSET_AUDIO) {
          window.VD_ASSET_AUDIO.play(name, intensity);
          return;
        }
        if (!this.enabled) return;
        this.unlock();
        if (!this.ctx || this.ctx.state !== "running") return;
        intensity = Math.max(0.1, Math.min(2, intensity));
        const shortGap = name.includes("step") ? 0.10 : name === "alert" ? 0.35 : 0.04;
        if (!this.canPlay(name, shortGap)) return;

        switch (name) {
          case "footstep":
            this.noise(0.045 * intensity, 0.045, { filter: { type: "lowpass", freq: 360, q: 0.7 }, decay: 1.4 });
            this.tone(72, 0.025 * intensity, 0.035, "sine");
            break;
          case "sprintStep":
            this.noise(0.075 * intensity, 0.055, { filter: { type: "lowpass", freq: 460, q: 0.8 }, decay: 1.2 });
            this.tone(86, 0.032 * intensity, 0.038, "sine");
            break;
          case "drag":
            this.noise(0.070 * intensity, 0.18, { filter: { type: "lowpass", freq: 260, q: 0.9 }, decay: 0.7 });
            break;
          case "dash":
            this.noise(0.16 * intensity, 0.32, { filter: { type: "bandpass", freq: 900, q: 0.9 }, decay: 0.55 });
            this.tone(90, 0.12 * intensity, 0.35, "sawtooth", { to: 34 });
            this.tone(680, 0.05 * intensity, 0.16, "sine", { to: 220, delay: 0.02 });
            break;
          case "whisper":
            this.noise(0.10 * intensity, 0.42, { filter: { type: "bandpass", freq: 1250, q: 1.6 }, decay: 0.35 });
            this.tone(310, 0.055 * intensity, 0.38, "sine", { to: 180 });
            break;
          case "sense":
            this.tone(520, 0.055 * intensity, 0.12, "sine");
            this.tone(780, 0.045 * intensity, 0.13, "sine", { delay: 0.07 });
            this.tone(1040, 0.035 * intensity, 0.16, "sine", { delay: 0.14 });
            break;
          case "feedStart":
            this.tone(130, 0.08 * intensity, 0.18, "triangle", { to: 82 });
            this.noise(0.05 * intensity, 0.20, { filter: { type: "lowpass", freq: 520, q: 0.6 } });
            break;
          case "feedFinish":
            this.tone(74, 0.13 * intensity, 0.24, "sine", { to: 54 });
            this.noise(0.055 * intensity, 0.18, { filter: { type: "lowpass", freq: 420, q: 0.8 } });
            break;
          case "brutalFeed":
            this.tone(62, 0.16 * intensity, 0.32, "sawtooth", { to: 38 });
            this.noise(0.14 * intensity, 0.24, { filter: { type: "bandpass", freq: 620, q: 0.8 } });
            break;
          case "glass":
            this.noise(0.16 * intensity, 0.22, { filter: { type: "highpass", freq: 1500, q: 0.7 }, decay: 1.6 });
            this.tone(1600, 0.045 * intensity, 0.08, "square", { to: 900 });
            break;
          case "rooftopJump":
            this.noise(0.11 * intensity, 0.42, { filter: { type: "bandpass", freq: 650, q: 0.7 }, decay: 0.35 });
            this.tone(140, 0.070 * intensity, 0.36, "triangle", { to: 260 });
            break;
          case "roofDrop":
            this.noise(0.12 * intensity, 0.52, { filter: { type: "bandpass", freq: 520, q: 0.65 }, decay: 0.30 });
            this.tone(170, 0.075 * intensity, 0.45, "triangle", { to: 55 });
            break;
          case "landingLight":
            this.tone(92, 0.10 * intensity, 0.12, "sine", { to: 62 });
            this.noise(0.06 * intensity, 0.10, { filter: { type: "lowpass", freq: 700, q: 0.7 } });
            break;
          case "landingHeavy":
            this.tone(52, 0.20 * intensity, 0.28, "sine", { to: 32 });
            this.noise(0.14 * intensity, 0.30, { filter: { type: "lowpass", freq: 520, q: 0.85 } });
            break;
          case "alert":
            this.tone(430, 0.08 * intensity, 0.10, "square");
            this.tone(310, 0.06 * intensity, 0.12, "square", { delay: 0.11 });
            break;
          case "police":
            this.tone(380, 0.075 * intensity, 0.12, "square");
            this.tone(500, 0.065 * intensity, 0.12, "square", { delay: 0.13 });
            break;
          case "hunterReveal":
            this.tone(58, 0.16 * intensity, 0.55, "sawtooth", { to: 42 });
            this.noise(0.08 * intensity, 0.45, { filter: { type: "bandpass", freq: 320, q: 1.4 } });
            break;
          case "bodyHide":
            this.noise(0.07 * intensity, 0.20, { filter: { type: "lowpass", freq: 300, q: 0.8 } });
            this.tone(82, 0.04 * intensity, 0.12, "sine");
            break;
          case "missionComplete":
            this.tone(174, 0.08 * intensity, 0.45, "sine");
            this.tone(261, 0.06 * intensity, 0.55, "sine", { delay: 0.08 });
            this.tone(392, 0.045 * intensity, 0.62, "sine", { delay: 0.16 });
            break;
        }
      }
    };

    // ---------------------------------------------------------
    // 04. INPUT
    // ---------------------------------------------------------

    const keys = Object.create(null);
    const pressed = Object.create(null);

    window.addEventListener("keydown", (ev) => {
      const k = ev.key.toLowerCase();
      keys[k] = true;
      if (!ev.repeat) pressed[k] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(ev.key.toLowerCase())) {
        ev.preventDefault();
      }
    });

    window.addEventListener("keyup", (ev) => {
      keys[ev.key.toLowerCase()] = false;
    });

    const camera = { x: 0, y: 0 };

    function resizeGameCanvas() {
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      // Dynamic camera zoom:
      // - most layers stay close to the vampire for tension and readability.
      // - the high rooftop pulls back to show the district panorama.
      const hasPlayer = typeof player !== "undefined";
      const panoramic = hasPlayer && player.layer === LAYER.ROOF_HIGH;
      const pixelScale = rect.width < 700
        ? (panoramic ? 2.45 : 3.55)
        : (panoramic ? 2.05 : 3.25);
      VIEW_W = Math.max(panoramic ? 430 : 300, Math.floor(rect.width / pixelScale));
      VIEW_H = Math.max(panoramic ? 230 : 150, Math.floor(rect.height / pixelScale));
      if (canvas.width !== VIEW_W || canvas.height !== VIEW_H) {
        canvas.width = VIEW_W;
        canvas.height = VIEW_H;
        ctx.imageSmoothingEnabled = false;
      }
      updateCamera();
    }

    window.addEventListener("resize", resizeGameCanvas);

    // ---------------------------------------------------------
    // 04. GAME STATE
    // ---------------------------------------------------------

    const player = {
      x: 150,
      y: 146,
      w: 10,
      h: 12,
      layer: LAYER.ROOF_HIGH,
      inSafehouse: true,
      speed: BALANCE.playerBaseSpeed,
      hunger: BALANCE.startHunger,
      exposure: 0,
      dashCooldown: 0,
      lureCooldown: 0,
      senseCooldown: 0,
      bloodSenseTimer: 0,
      dashFlash: 0,
      beastFlash: 0,
      lastDir: { x: 1, y: 0 }
    };

    const state = {
      time: 0,
      message: "You wake on the rooftop refuge. Press E at the terrace exit to enter the district.",
      messageTimer: 5,
      mission: 1,
      missionDone: false,
      orderReportOpen: false,
      orderReportAccepted: false,
      freeRoam: false,
      gameStarted: false,
      targetFed: false,
      usedBloodSense: false,
      usedWhisper: false,
      targetLured: false,
      tutorialShown: Object.create(null),
      lastAlert: null,
      feedCount: 0,
      feeding: null,
      draggingBody: null,
      dragWitnessTimer: 0,
      lureHintTimer: 0,
      beastUrge: 0,
      lastBeastLevel: 0,
      noises: [],
      nextNoiseId: 1,
      bloodStains: [],
      nextBloodStainId: 1,
      footstepNoiseTimer: 0,
      dragNoiseTimer: 0,
      dragBloodTimer: 0,
      stepSoundTimer: 0,
      lastNoiseMessageAt: 0,
      lastBloodMessageAt: 0,
      nextRouteBlockAt: 0,
      nextDynamicEventAt: 11,
       nextRatSpawnAt: 8,
       dynamicEventCount: 0,
       lampBreakWindowUntil: 0,
       lampBreakChainCount: 0,
      showHelp: true,
      helpPulse: 0,
      fxTrails: [],
      fxBursts: [],
      fogClouds: [],
      shake: 0,
      cinematic: null,
      localHeat: Object.create(null),
      stats: {
        hungerFromPowers: 0,
        feeds: 0,
        brutalFeeds: 0,
        bodiesHidden: 0,
        bodiesDiscovered: 0,
        witnessesReported: 0,
        witnessesIntercepted: 0,
        lightsBroken: 0,
        huntersRevealed: 0,
        bloodStainsCreated: 0,
        camerasBroken: 0,
        cameraFlags: 0,
        policeResponses: 0,
        dynamicEvents: 0,
        maxLocalHeat: 0
      }
    };

    // ---------------------------------------------------------
    // 05. MAP DATA
    // ---------------------------------------------------------
    // Simple data-first rectangles. The goal is to be able to move,
    // delete, or add locations without touching rendering/AI code.
    // On the street layer, buildings block movement.
    // On rooftop layers, rooftop rectangles become walkable areas.

    const buildings = [
      { id: "refugeTower", name: "ROOFTOP REFUGE", x: 86, y: 86, w: 150, h: 128, color: "#20122f", trim: "#d7c8ff", sign: "REFUGE" },
      { id: "club", name: "CLUB", x: 590, y: 374, w: 170, h: 112, color: "#241126", trim: "#d11fb9", sign: "CLUB" },
      { id: "church", name: "CHURCH", x: 708, y: 438, w: 156, h: 112, color: "#1b1824", trim: "#8b6f9e", sign: "CHURCH" },
      { id: "police", name: "POLICE STATION", x: 690, y: 88, w: 174, h: 122, color: "#14223a", trim: "#4da3ff", sign: "POLICE" },
      { id: "marketBlock", name: "MARKET BLOCK", x: 280, y: 92, w: 130, h: 150, color: "#181a2a", trim: "#777d99", sign: "MARKET" },
      { id: "tenementNorth", name: "TENEMENT", x: 528, y: 92, w: 122, h: 148, color: "#171827", trim: "#7f849a", sign: "FLATS" },
      { id: "warehouse", name: "WAREHOUSE", x: 106, y: 410, w: 154, h: 98, color: "#171716", trim: "#6e5b37", sign: "WARE" },
      { id: "shops", name: "SHOPS", x: 294, y: 414, w: 140, h: 110, color: "#181322", trim: "#8a5ca8", sign: "SHOPS" },
      { id: "oldBlock", name: "OLD BLOCK", x: 532, y: 504, w: 130, h: 86, color: "#18151f", trim: "#5b5167", sign: "OLD" }
    ];

    const roofAreas = {
      [LAYER.ROOF_LOW]: [
        { id: "refugeLowerRoof", x: 92, y: 176, w: 148, h: 62, color: "#2d3045" },
        { id: "marketRoof", x: 286, y: 98, w: 118, h: 138, color: "#303246" },
        { id: "clubRoof", x: 596, y: 380, w: 158, h: 98, color: "#30263e" }
      ],
      [LAYER.ROOF_HIGH]: [
        { id: "refugeHighRoof", x: 96, y: 92, w: 140, h: 112, color: "#3a3a52" }
      ]
    };

    const sewerTunnels = [
      // Sewer level mirrors the two big avenues and the main alley network above.
      { x: 426, y: 42, w: 92, h: 560 },
      { x: 72, y: 292, w: 820, h: 92 },
      { x: 116, y: 426, w: 680, h: 76 },
      { x: 156, y: 150, w: 84, h: 285 },
      { x: 704, y: 156, w: 84, h: 315 },
      { x: 302, y: 190, w: 330, h: 62 }
    ];

    const hiddenZones = [
      // The district is dark by default. Active lights carve danger zones out of this darkness.
      { name: "district darkness", x: 0, y: 0, w: WORLD_W, h: WORLD_H, strength: 0.50 },
      { name: "north alley", x: 246, y: 244, w: 474, h: 44, strength: 0.72 },
      { name: "south service alley", x: 88, y: 502, w: 790, h: 44, strength: 0.74 },
      { name: "warehouse alley", x: 96, y: 382, w: 196, h: 44, strength: 0.68 },
      { name: "church rear", x: 690, y: 550, w: 188, h: 34, strength: 0.68 },
      { name: "club rear", x: 584, y: 486, w: 190, h: 34, strength: 0.64 }
    ];

    const lightPosts = [
      // Lights define the dangerous visible parts of the district.
      { id: "lampCrossA", x: 472, y: 324, radius: 78, broken: false, name: "crossroad streetlight" },
      { id: "lampCrossB", x: 504, y: 324, radius: 78, broken: false, name: "east crossroad streetlight" },
      { id: "lampPolice", x: 740, y: 240, radius: 78, broken: false, name: "police avenue streetlight" },
      { id: "lampClub", x: 638, y: 362, radius: 70, broken: false, name: "club streetlight" },
      { id: "lampChurch", x: 716, y: 420, radius: 72, broken: false, name: "church streetlight" },
      { id: "lampWarehouse", x: 222, y: 380, radius: 64, broken: false, name: "warehouse streetlight" },
      { id: "lampNorth", x: 432, y: 168, radius: 66, broken: false, name: "north avenue streetlight" }
    ];

    const bodyHideSpots = [
      // Bodies are hidden in dumpsters placed in alleys, not generic abstract spots.
      { id: "dumpsterNorthAlley", name: "north alley dumpster", layer: LAYER.STREET, x: 318, y: 262, r: 34, color: "#78c7a3" },
      { id: "dumpsterWarehouse", name: "warehouse dumpster", layer: LAYER.STREET, x: 176, y: 392, r: 34, color: "#78c7a3" },
      { id: "dumpsterClubRear", name: "club rear dumpster", layer: LAYER.STREET, x: 676, y: 502, r: 36, color: "#78c7a3" },
      { id: "dumpsterChurchRear", name: "church rear dumpster", layer: LAYER.STREET, x: 782, y: 558, r: 36, color: "#78c7a3" },
      { id: "dumpsterSouthService", name: "south service dumpster", layer: LAYER.STREET, x: 380, y: 528, r: 34, color: "#78c7a3" }
    ];

    const localZones = [
      // Local heat: the city remembers where you caused trouble.
      { id: "cross", name: "Central crossroad", x: 392, y: 244, w: 170, h: 170, color: "#ffb02e" },
      { id: "northAvenue", name: "North avenue", x: 400, y: 38, w: 150, h: 250, color: "#ffb02e" },
      { id: "eastAvenue", name: "East avenue", x: 520, y: 292, w: 374, h: 116, color: "#ffb02e" },
      { id: "westAvenue", name: "West avenue", x: 64, y: 292, w: 360, h: 116, color: "#ffb02e" },
      { id: "club", name: "Club", x: 574, y: 350, w: 208, h: 168, color: "#d11fb9" },
      { id: "church", name: "Church", x: 680, y: 420, w: 210, h: 176, color: "#8b6f9e" },
      { id: "police", name: "Police station", x: 670, y: 70, w: 220, h: 204, color: "#4da3ff" },
      { id: "alleys", name: "Alleys", x: 80, y: 232, w: 820, h: 330, color: "#a75cff" },
      { id: "refuge", name: "Rooftop refuge", x: 80, y: 80, w: 180, h: 170, color: "#78c7a3" },
      { id: "roofs", name: "Rooftops", x: 80, y: 80, w: 720, h: 430, color: "#d7c8ff", layer: "roof" },
      { id: "sewer", name: "Sewers", x: 70, y: 40, w: 830, h: 560, color: "#78c7a3", layer: "sewer" }
    ];

    const cameras = [
      // Fixed surveillance cameras removed: the city reacts through witnesses, police heat and wanted level.
    ];

    const interactables = [
      {
        id: "safehouseDoor",
        label: "Rooftop refuge",
        layer: LAYER.ROOF_HIGH,
        x: 150, y: 146, r: 34,
        prompt: () => player.inSafehouse ? "E: leave rooftop refuge" : "Rooftop refuge: safe zone",
        action: () => {
          player.inSafehouse = false;
          player.layer = LAYER.ROOF_HIGH;
          player.x = 170; player.y = 148;
          say("You step out onto the high rooftop. Below: two bright avenues, dark alleys, police north-east and church south-east.", 5);
        }
      },
      {
        id: "clubDoor",
        label: "Nightclub",
        layer: LAYER.STREET,
        x: 642, y: 404, r: 30,
        prompt: () => "Nightclub: the journalist is meeting a source outside",
        action: () => say("Too many eyes inside. The journalist is outside, waiting near the pink lights.", 3)
      },
      {
        id: "policeStation",
        label: "Police station",
        layer: LAYER.STREET,
        x: 780, y: 170, r: 32,
        prompt: () => "Police station: patrols deploy from here when exposure rises",
        action: () => addExposure(16, "You loiter outside the police station. Patrols mark you.")
      },
      {
        id: "sewerIn",
        label: "Sewer access",
        layer: LAYER.STREET,
        x: 472, y: 326, r: 26,
        prompt: () => "E: go down to the sewers",
        action: () => {
          cleanBloodAround(player.x, player.y, LAYER.STREET, 64, "The filthy sewer runoff dilutes part of the trail.");
          player.layer = LAYER.SEWER;
          player.inSafehouse = false;
          player.x = 612; player.y = 346;
          say("You descend into the sewers. Here you can break pursuit and wash away trails.", 4);
        }
      },
      {
        id: "sewerOutMain",
        label: "Sewer exit",
        layer: LAYER.SEWER,
        x: 472, y: 326, r: 26,
        prompt: () => "E: climb up to the street",
        action: () => {
          player.layer = LAYER.STREET;
          player.x = 612; player.y = 352;
          say("You emerge from a manhole beside the alley.", 3);
        }
      },
      {
        id: "sewerOutHome",
        label: "Tunnel to rooftop refuge",
        layer: LAYER.SEWER,
        x: 176, y: 180, r: 26,
        prompt: () => "E: climb into the safehouse",
        action: () => {
          cleanBloodAround(player.x, player.y, LAYER.SEWER, 120, "The sewer water washes away nearby stains.");
          player.layer = LAYER.STREET;
          player.inSafehouse = true;
          player.x = 135; player.y = 455;
          cleanBloodAround(player.x, player.y, LAYER.STREET, 95, "You climb into the safehouse and clean the entry trail.");
          say("You climb through the safehouse private tunnel.", 3);
        }
      },
      {
        id: "fireEscape",
        label: "Fire escape",
        layer: LAYER.STREET,
        x: 176, y: 244, r: 28,
        prompt: () => "E: climb the fire escape",
        action: () => {
          player.layer = LAYER.ROOF_LOW;
          player.x = 166; player.y = 206;
          say("You climb toward the rooftop refuge. The crossroad glows below.", 4);
        }
      },
      {
        id: "fireEscapeDown",
        label: "Climb down",
        layer: LAYER.ROOF_LOW,
        x: 166, y: 206, r: 24,
        prompt: () => "E: climb down to the street",
        action: () => {
          player.layer = LAYER.STREET;
          player.x = 176; player.y = 244;
          say("You climb down into the west alley.", 3);
        }
      },
      {
        id: "roofJumpA",
        label: "Rooftop jump",
        layer: LAYER.ROOF_LOW,
        x: 458, y: 218, r: 24,
        prompt: () => "E: jump to the neighboring roof",
        action: () => {
          const sx = player.x, sy = player.y;
          const ex = 516, ey = 218;
          addFxTrail(sx, sy, ex, ey, LAYER.ROOF_LOW, "jump", 0.42);
          addFxBurst(sx, sy, LAYER.ROOF_LOW, "land", 10, 0.22);
          startCinematic("jump", ex, ey, LAYER.ROOF_LOW, { startX: sx, startY: sy, endX: ex, endY: ey, startLayer: LAYER.ROOF_LOW, endLayer: LAYER.ROOF_LOW, movePlayer: true, duration: 0.92, zoom: 0.34, lift: 20, airScale: 0.98, anticipation: 0.24, anticipationBack: 9, anticipationSquash: 0.18, landAt: 0.88, freeze: 0.08, landingBurstSize: 20, landingShake: 0.16 });
          AudioBus.play("rooftopJump");
          createNoise(487, 230, LAYER.ROOF_LOW, 76, 2.4, "drop", { exposure: false });
          addExposure(publicWitnesses(100) > 0 ? 5 : 0, "An impossible rooftop jump raises suspicion.");
          say("You spring high over the gap in a burst of slow-motion grace.", 3);
        }
      },
      {
        id: "roofJumpB",
        label: "Jump back",
        layer: LAYER.ROOF_LOW,
        x: 516, y: 218, r: 24,
        prompt: () => "E: jump back",
        action: () => {
          const sx = player.x, sy = player.y;
          const ex = 458, ey = 218;
          addFxTrail(sx, sy, ex, ey, LAYER.ROOF_LOW, "jump", 0.42);
          addFxBurst(sx, sy, LAYER.ROOF_LOW, "land", 10, 0.22);
          startCinematic("jump", ex, ey, LAYER.ROOF_LOW, { startX: sx, startY: sy, endX: ex, endY: ey, startLayer: LAYER.ROOF_LOW, endLayer: LAYER.ROOF_LOW, movePlayer: true, duration: 0.92, zoom: 0.34, lift: 20, airScale: 0.98, anticipation: 0.24, anticipationBack: 9, anticipationSquash: 0.18, landAt: 0.88, freeze: 0.08, landingBurstSize: 20, landingShake: 0.16 });
          AudioBus.play("rooftopJump");
          createNoise(487, 230, LAYER.ROOF_LOW, 70, 2.2, "drop", { exposure: false });
          say("You spring back across the gap in slow motion.", 3);
        }
      },
      {
        id: "toHighRoof",
        label: "Upper ladder",
        layer: LAYER.ROOF_LOW,
        x: 625, y: 188, r: 24,
        prompt: () => "E: climb to high rooftop",
        action: () => {
          player.layer = LAYER.ROOF_HIGH;
          player.x = 674; player.y = 190;
          say("You climb to a higher rooftop. A good place to lose them.", 4);
        }
      },
      {
        id: "fromHighRoof",
        label: "Drop to low rooftop",
        layer: LAYER.ROOF_HIGH,
        x: 674, y: 190, r: 24,
        prompt: () => "E: descend to low rooftop",
        action: () => {
          player.layer = LAYER.ROOF_LOW;
          player.x = 625; player.y = 188;
          say("You descend to the low rooftop.", 3);
        }
      },
      {
        id: "roofDrop",
        label: "Drop into alley",
        layer: LAYER.ROOF_LOW,
        x: 432, y: 268, r: 24,
        prompt: () => "E: drop into the back alley",
        action: () => {
          const sx = player.x, sy = player.y;
          const ex = 432, ey = 318;
          addFxTrail(sx, sy, ex, ey, LAYER.STREET, "drop", 0.44);
          addFxBurst(sx, sy, LAYER.ROOF_LOW, "drop", 12, 0.24);
          startCinematic("drop", ex, ey, LAYER.STREET, { startX: sx, startY: sy, endX: ex, endY: ey, startLayer: LAYER.ROOF_LOW, endLayer: LAYER.STREET, movePlayer: true, duration: 1.02, zoom: 0.42, lift: 31, airScale: 1.12, anticipation: 0.22, anticipationBack: 7, anticipationSquash: 0.15, landAt: 0.86, freeze: 0.10, landingBurstSize: 28, landingShake: 0.36, landingBurstStyle: "drop", dust: true });
          AudioBus.play("roofDrop");
          createNoise(ex, ey, LAYER.STREET, 132, 4.1, "drop");
          say("You throw yourself off the rooftop and hammer down into the back alley, kicking up dust.", 3);
        }
      }
    ];

    // ---------------------------------------------------------
    // 06. NPC DATA
    // ---------------------------------------------------------

    const npcs = [];
    let npcId = 1;

    function makeNpc(type, x, y, opts = {}) {
      const data = {
        id: npcId++, type, x, y,
        w: 9, h: 11,
        layer: opts.layer ?? LAYER.STREET,
        dead: false,
        stunned: false,
        speed: opts.speed ?? (type === "hunter" ? 46 : type === "police" ? 34 : 13),
        vx: 0, vy: 0,
        aiTimer: opts.aiTimer ?? 0,
        waitTimer: opts.waitTimer ?? 0,
        fleeTimer: 0,
        active: opts.active ?? (type === "civilian" || type === "target"),
        hidden: Boolean(opts.hidden),
        revealed: !opts.hidden,
        behavior: opts.behavior || "wander",
        patrol: opts.patrol || null,
        patrolIndex: opts.patrolIndex || 0,
        luredTimer: 0,
        suspiciousTimer: 0,
        dirX: opts.dirX ?? 0,
        dirY: opts.dirY ?? 1,
        chaseTimer: 0,
        lostTimer: 0,
        corpseDiscovered: false,
        alarmed: false,
        alarmTimer: 0,
        reportTarget: null,
        reportSeverity: 0,
        hasReported: false,
        witnessReason: "",
        lastKnown: { x, y },
        investigatingNoise: null,
        investigateTimer: 0,
        investigatingBlood: null,
        bloodTrackTimer: 0,
        blockingRoute: null,
        blockTimer: 0,
        alertTimer: 0,
        dragged: false,
        hiddenBody: false,
        bodyHiddenIn: "",
        eventNpc: Boolean(opts.eventNpc),
        tempLife: opts.tempLife ?? 0
      };
      if (type === "target") data.speed = opts.speed ?? 7;
      if (data.behavior === "loiter") {
        data.waitTimer = opts.waitTimer ?? 999;
        data.speed = opts.speed ?? 5;
      }
      return data;
    }


    function makeRat(x, y) {
      const rat = makeNpc("rat", x, y, { layer: LAYER.SEWER, behavior: "wander", speed: 20, eventNpc: true, tempLife: 28 });
      rat.w = 6;
      rat.h = 5;
      return rat;
    }

    // Civiles alrededor del distrito. Mezclamos peatones y gente apostada junto a paredes.
    [
      // Pedestrians mostly use the two avenues. Alleys stay useful but not empty.
      [430, 132], [520, 170], [360, 326], [586, 326], [670, 326], [246, 326],
      [642, 406], [720, 456], [206, 524], [420, 526], [810, 326]
    ].forEach(([x, y]) => npcs.push(makeNpc("civilian", x, y, { behavior: "wander" })));

    // Awkward witnesses: they do not rush you, but watch from walls and corners.
    npcs.push(makeNpc("civilian", 324, 262, { behavior: "loiter", dirX: 1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 674, 502, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));
    npcs.push(makeNpc("civilian", 784, 558, { behavior: "loiter", dirX: -1, dirY: -1, waitTimer: 999 }));

    // The journalist starts beside the club side shadow: visible enough to find, isolated enough to eliminate.
    npcs.push(makeNpc("target", 638, 370, { behavior: "loiter", dirX: -1, dirY: 0, waitTimer: 999 }));

    // Police are not visible from the start anymore. They spawn only when exposure reaches wanted levels.

    // Hunters hidden: no se dibujan ni patrullan hasta que se revelan.
    npcs.push(makeNpc("hunter", 742, 474, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: 0 }));
    npcs.push(makeNpc("hunter", 810, 532, { active: false, hidden: true, behavior: "ambush", dirX: -1, dirY: -1 }));

    const reportPoints = [
      { id: "policeDoor", name: "the police station", x: 780, y: 170, severityBonus: 10 },
      { id: "centralCross", name: "the central crossroad", x: 488, y: 326, severityBonus: 6 },
      { id: "clubCrowd", name: "the club queue", x: 642, y: 404, severityBonus: 4 }
    ];

    const hunterBlockPoints = [
      { id: "blockFireEscape", name: "the refuge fire escape", x: 176, y: 244, layer: LAYER.STREET },
      { id: "blockSewerCross", name: "the crossroad manhole", x: 472, y: 326, layer: LAYER.STREET },
      { id: "blockClubAlley", name: "the club rear alley", x: 676, y: 502, layer: LAYER.STREET },
      { id: "blockChurch", name: "the church gate", x: 742, y: 474, layer: LAYER.STREET }
    ];

    // ---------------------------------------------------------
    // Geometry utilities
    // ---------------------------------------------------------

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function pointInRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
    function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
    function rectFor(x, y, w = player.w, h = player.h) { return { x: x - w / 2, y: y - h / 2, w, h }; }

    function say(text, seconds = 2.5) {
      state.message = text;
      state.messageTimer = seconds;
    }

    function targetNpc() {
      return npcs.find(n => n.type === "target");
    }

    function targetBodyVisible() {
      const t = targetNpc();
      return Boolean(t && t.dead && !t.hiddenBody);
    }

    function targetBodyHidden() {
      const t = targetNpc();
      return Boolean(t && t.dead && t.hiddenBody);
    }

    function markTutorial(key, text, seconds = 3) {
      if (state.tutorialShown[key]) return false;
      state.tutorialShown[key] = true;
      say(text, seconds);
      return true;
    }

    function alertTag(reason) {
      if (!reason) return "risk";
      const r = reason.toLowerCase();
            if (r.includes("witness") || r.includes("sees") || r.includes("seen")) return "witness";
      if (r.includes("noise") || r.includes("heard")) return "noise";
      if (r.includes("body")) return "body";
      if (r.includes("blood") || r.includes("trail")) return "trail";
      if (r.includes("hunter")) return "hunter";
      if (r.includes("police")) return "police";
      return "exposure";
    }

    function exposureLevel() {
      return clamp(Math.floor(player.exposure / BALANCE.exposurePerLevel), 0, 5);
    }

    function forceExposureLevel(level, reason = "") {
      const target = clamp(level, 0, 5) * BALANCE.exposurePerLevel;
      if (player.exposure < target) addExposure(target - player.exposure, reason);
    }

    function beastStage() {
      // The Beast is not another meter: it is the playable interpretation of the hunger bar.
      if (player.hunger >= 95) {
        return {
          level: 3,
          name: "FRENZY",
          ui: "Frenzy",
          moveMul: 1.18,
          dashMul: 1.34,
          dashCooldownMul: 0.55,
          whisperRangeMul: 1.35,
          whisperCooldownMul: 0.62,
          feedSpeedMul: 1.45,
          exposureMul: 1.38
        };
      }
      if (player.hunger >= 82) {
        return {
          level: 2,
          name: "THE BEAST",
          ui: "Beast close",
          moveMul: 1.10,
          dashMul: 1.18,
          dashCooldownMul: 0.75,
          whisperRangeMul: 1.18,
          whisperCooldownMul: 0.82,
          feedSpeedMul: 1.20,
          exposureMul: 1.18
        };
      }
      if (player.hunger >= 62) {
        return {
          level: 1,
          name: "HUNGER",
          ui: "Hunger alta",
          moveMul: 1.04,
          dashMul: 1.06,
          dashCooldownMul: 0.92,
          whisperRangeMul: 1.08,
          whisperCooldownMul: 0.92,
          feedSpeedMul: 1.07,
          exposureMul: 1.06
        };
      }
      return {
        level: 0,
        name: "CONTROL",
        ui: "Control",
        moveMul: 1,
        dashMul: 1,
        dashCooldownMul: 1,
        whisperRangeMul: 1,
        whisperCooldownMul: 1,
        feedSpeedMul: 1,
        exposureMul: 1
      };
    }

    function addExposure(amount, reason) {
      if (amount <= 0) return;
      const before = exposureLevel();
      const beast = beastStage();
      const multiplier = player.inSafehouse ? 1 : beast.exposureMul;
      const finalAmount = Math.max(1, Math.round(amount * multiplier));
      player.exposure = clamp(player.exposure + finalAmount, 0, 100);
      addLocalHeat(finalAmount * 0.42, null, player.x, player.y, player.layer);
      const after = exposureLevel();
      if (reason) {
        state.lastAlert = { text: reason, tag: alertTag(reason), timer: 5.0 };
        AudioBus.play("alert", Math.min(1.6, 0.8 + finalAmount / 18));
        say(`ALERT (${alertTag(reason)}): ${reason}`, 3.5);
      }
      if (beast.level >= 2 && finalAmount > amount + 1 && state.messageTimer <= 3.4) {
        say(`${reason || "Risky action"} The Beast makes it harder to hide.`, 3.5);
      }
      if (after > before) {
        if (after === 1) say("Exposure 1: civilians get nervous. You are not wanted yet.", 3);
        if (after === 2) { AudioBus.play("police", 1.0); say("Exposure 2: police are dispatched. The chase can start.", 3); }
        if (after === 3) { AudioBus.play("police", 1.15); say("Exposure 3: police pressure rises. Escape routes matter.", 3); }
        if (after === 4) { AudioBus.play("hunterReveal", 0.85); say("Exposure 4: the situation is too strange. Hunters start paying attention.", 3); }
        if (after >= 5) { AudioBus.play("alert", 1.4); say("Blood hunt level: the district is no longer treating this as normal crime.", 3); }
      }
    }

    // ---------------------------------------------------------
    // Local heat / wanted level / reactive city
    // ---------------------------------------------------------

    function currentLocalZoneAt(x = player.x, y = player.y, layer = player.layer) {
      if (layer === LAYER.SEWER) return localZones.find(z => z.id === "sewer");
      if (layer > LAYER.STREET) return localZones.find(z => z.id === "roofs");
      // Search backwards so specific zones win over the main street.
      for (let i = localZones.length - 1; i >= 0; i--) {
        const z = localZones[i];
        if (z.layer) continue;
        if (pointInRect(x, y, z)) return z;
      }
      return { id: "district", name: "District", x: 0, y: 0, w: WORLD_W, h: WORLD_H, color: "#ffb02e" };
    }

    function heatValue(zoneId) {
      return clamp(state.localHeat[zoneId] || 0, 0, 100);
    }

    function addLocalHeat(amount, reason = null, x = player.x, y = player.y, layer = player.layer) {
      if (amount <= 0) return 0;
      const zone = currentLocalZoneAt(x, y, layer);
      if (!zone) return 0;
      const before = heatValue(zone.id);
      const after = clamp(before + amount, 0, 100);
      state.localHeat[zone.id] = after;
      state.stats.maxLocalHeat = Math.max(state.stats.maxLocalHeat, Math.round(after));
      if (reason && before < 45 && after >= 45) say(`${zone.name} heats up: ${reason}`, 3);
      return after;
    }

    function coolLocalHeat(dt) {
      for (const id of Object.keys(state.localHeat)) {
        const decay = id === "safe" || id === "sewer" ? 6.5 : 1.7;
        state.localHeat[id] = Math.max(0, state.localHeat[id] - dt * decay);
        if (state.localHeat[id] <= 0.05) delete state.localHeat[id];
      }
    }

    function hottestZone() {
      let best = null;
      let bestHeat = 0;
      for (const z of localZones) {
        const h = heatValue(z.id);
        if (h > bestHeat) { best = z; bestHeat = h; }
      }
      return best ? { zone: best, heat: bestHeat } : null;
    }

    function heatName() {
      const h = hottestZone();
      if (!h || h.heat < 22) return "";
      if (h.heat >= 70) return `${h.zone.name} ardiendo`;
      if (h.heat >= 45) return `${h.zone.name} hot`;
      return `${h.zone.name} sospechoso`;
    }

    function canCameraSeePoint(cam, x, y, layer = LAYER.STREET) {
      if (!cam || cam.broken || layer !== LAYER.STREET || player.inSafehouse) return false;
      const dx = x - cam.x;
      const dy = y - cam.y;
      const d = Math.hypot(dx, dy);
      if (d > cam.range) return false;
      if (lineBlockedByBuildings(cam.x, cam.y, x, y)) return false;
      if (d < 24) return true;
      const len = d || 1;
      const dirLen = Math.hypot(cam.dirX, cam.dirY) || 1;
      const dot = (dx / len) * (cam.dirX / dirLen) + (dy / len) * (cam.dirY / dirLen);
      return dot >= Math.cos(cam.fov);
    }

    function camerasWatchingPoint(x = player.x, y = player.y, layer = player.layer) {
      return cameras.filter(c => canCameraSeePoint(c, x, y, layer));
    }

    function exposeToCameras(baseGain, reason, x = player.x, y = player.y, layer = player.layer) {
      // Surveillance cameras were removed. Exposure now comes from witnesses, violence, heat and wanted level.
      return 0;
    }

    function nearestBreakableCamera() {
      return null;
    }

    function callPoliceAttention(x, y, layer, reason, strength = 1) {
      if (layer !== LAYER.STREET) return;
      state.stats.policeResponses++;
      AudioBus.play("police", Math.min(1.4, 0.8 + strength * 0.25));
      state.lastAlert = { text: reason, tag: "police", timer: 4.0 };
      addLocalHeat(8 + strength * 7, reason, x, y, layer);

      const cops = npcs.filter(n => n.type === "police" && !n.dead && n.layer === layer);
      if (cops.length < 2) {
        const spawn = Math.random() < 0.55 ? { x: 790, y: 218 } : edgeSpawn();
        const cop = makeNpc("police", spawn.x, spawn.y);
        cop.active = true;
        cop.investigatingNoise = { x, y, kind: "vandalism" };
        cop.investigateTimer = 5.2;
        npcs.push(cop);
      }
      for (const cop of cops) {
        const d = Math.hypot(cop.x - x, cop.y - y);
        if (d < 260) {
          cop.active = true;
          cop.investigatingNoise = { x, y, kind: "vandalism" };
          cop.investigateTimer = Math.max(cop.investigateTimer || 0, 5.0);
          cop.suspiciousTimer = Math.max(cop.suspiciousTimer || 0, 3.0);
        }
      }
      say(`POLICE ATTENTION: ${reason}`, 3.2);
    }

    function breakCamera(cam) {
      if (!cam || cam.broken) return;
      cam.broken = true;
      state.stats.camerasBroken++;
      AudioBus.play("glass", 0.9);
      createNoise(cam.x, cam.y, LAYER.STREET, 145, 4.2, "glass", { policeOnly: true });
      const witnesses = visibleWitnessList(145).filter(w => w.type !== "hunter");
      callPoliceAttention(cam.x, cam.y, LAYER.STREET, `${cam.name} destroyed. Patrols move to investigate.`, witnesses.length > 0 ? 1.4 : 1.0);
    }

    function updateCameras(dt) {
      // Removed: the wanted system now comes from witnesses, police dispatch and hunter escalation.
    }

    function updateRatSpawns(dt) {
      if (player.layer !== LAYER.SEWER || state.time < state.nextRatSpawnAt) return;
      state.nextRatSpawnAt = state.time + 10 + Math.random() * 14;
      const livingRats = npcs.filter(n => n.type === "rat" && !n.dead && n.layer === LAYER.SEWER).length;
      if (livingRats >= 3) return;
      const tunnel = sewerTunnels[Math.floor(Math.random() * sewerTunnels.length)];
      const x = tunnel.x + 12 + Math.random() * Math.max(6, tunnel.w - 24);
      const y = tunnel.y + 12 + Math.random() * Math.max(6, tunnel.h - 24);
      npcs.push(makeRat(x, y));
      say("Something small scratches through the sewer dark. A rat: poor blood, but blood.", 2.6);
    }

    function updateDynamicEvents(dt) {
      updateRatSpawns(dt);
      if (state.missionDone && !state.freeRoam) return;
      if (state.time < state.nextDynamicEventAt) return;
      state.nextDynamicEventAt = state.time + BALANCE.dynamicEventMinDelay + Math.random() * (BALANCE.dynamicEventMaxDelay - BALANCE.dynamicEventMinDelay);
      const hot = hottestZone();
      const heat = hot?.heat || 0;
      const roll = Math.random();
      const dynamicCivilians = npcs.filter(n => n.eventNpc && !n.dead && !n.hiddenBody && (n.type === "civilian" || n.type === "target")).length;
      const livingCivilians = npcs.filter(n => !n.dead && !n.hiddenBody && (n.type === "civilian" || n.type === "target")).length;
      const canSpawnCivilians = dynamicCivilians < BALANCE.maxDynamicCivilians && livingCivilians < BALANCE.maxTotalLivingCivilians;

      if (roll < 0.28 && canSpawnCivilians) {
        state.dynamicEventCount++;
        state.stats.dynamicEvents++;
        const drunk = makeNpc("civilian", 472 + (Math.random() - 0.5) * 55, 390 + Math.random() * 22, { behavior: "wander", speed: 9, eventNpc: true, tempLife: 22 });
        drunk.waitTimer = 0.8;
        npcs.push(drunk);
        say("Event: a drunk leaves the club. Easy victim... or clumsy witness.", 3);
        return;
      }

      if (roll < 0.52) {
        state.dynamicEventCount++;
        state.stats.dynamicEvents++;
        const cops = npcs.filter(n => n.type === "police" && !n.dead && !n.hidden);
        if (cops.length) {
          const cop = cops[Math.floor(Math.random() * cops.length)];
          const z = hot?.zone || localZones.find(z => z.id === "main");
          cop.behavior = "patrol";
          cop.active = cop.active || heat > 38 || exposureLevel() >= 1;
          cop.patrol = [
            { x: z.x + 18, y: z.y + 18 },
            { x: z.x + z.w - 18, y: z.y + 24 },
            { x: z.x + z.w - 24, y: z.y + z.h - 18 },
            { x: z.x + 24, y: z.y + z.h - 24 }
          ];
          cop.patrolIndex = 0;
          say(`Event: a patrol redirects its route toward ${z.name}.`, 3);
        }
        return;
      }

      if (roll < 0.72) {
        state.dynamicEventCount++;
        state.stats.dynamicEvents++;
        const lit = lightPosts.filter(l => !l.broken && !l.outageTimer);
        if (lit.length) {
          const lamp = lit[Math.floor(Math.random() * lit.length)];
          lamp.outageTimer = 6 + Math.random() * 5;
          say(`Event: ${lamp.name} flickers and leaves a temporary dark gap.`, 3);
        }
        return;
      }

      if (roll < 0.88 && canSpawnCivilians) {
        state.dynamicEventCount++;
        state.stats.dynamicEvents++;
        const people = Math.min(2, BALANCE.maxDynamicCivilians - dynamicCivilians, BALANCE.maxTotalLivingCivilians - livingCivilians);
        for (let i = 0; i < people; i++) {
          const c = makeNpc("civilian", 244, 350 + i * 14, { behavior: "wander", speed: 12, eventNpc: true, tempLife: 16 });
          c.vx = 18; c.vy = 0; c.aiTimer = 2.5;
          npcs.push(c);
        }
        if (people > 0) say("Event: a small group crosses the main street. More eyes for a few seconds.", 3);
        return;
      }

      const hidden = npcs.find(n => n.type === "hunter" && !n.dead && n.hidden && !n.revealed);
      if (hidden && heat > 42) {
        state.dynamicEventCount++;
        state.stats.dynamicEvents++;
        hidden.x = (hot?.zone.x || 520) + (hot?.zone.w || 80) / 2;
        hidden.y = (hot?.zone.y || 330) + (hot?.zone.h || 80) / 2;
        say(`Event: something takes position near ${hot.zone.name}. Blood Sense can reveal it.`, 3);
      }
    }

    function updateLightOutages(dt) {
      for (const l of lightPosts) {
        if (l.outageTimer) {
          l.outageTimer = Math.max(0, l.outageTimer - dt);
          if (l.outageTimer <= 0) l.outageTimer = 0;
        }
      }
    }

    // ---------------------------------------------------------
    // Noise / investigation
    // ---------------------------------------------------------

    function noiseLabel(kind) {
      if (kind === "sprint") return "fast footsteps";
      if (kind === "drag") return "dragging";
      if (kind === "glass") return "broken glass";
      if (kind === "dash") return "shadow tear";
      if (kind === "feed") return "struggle";
      if (kind === "brutal-feed") return "muffled scream";
      if (kind === "drop") return "hard impact";
      if (kind === "whisper") return "strange whisper";
      return "noise";
    }

    function canHearNoise(n, noise) {
      if (!n || n.dead || n.stunned || n.hiddenBody) return false;
      if (!noise || n.layer !== noise.layer) return false;
      if (player.inSafehouse && noise.fromPlayer) return false;

      const dx = noise.x - n.x;
      const dy = noise.y - n.y;
      const d = Math.hypot(dx, dy);
      let range = noise.radius;

      if (n.type === "hunter") range *= noise.supernatural ? 1.45 : 1.16;
      else if (n.type === "police") range *= 1.12;
      else range *= 0.84;

      if (noise.layer === LAYER.STREET && lineBlockedByBuildings(n.x, n.y, noise.x, noise.y)) {
        range *= 0.66;
      }

      return d <= range;
    }

    function createNoise(x, y, layer, radius, intensity, kind, opts = {}) {
      if (player.inSafehouse && opts.fromPlayer !== false) return null;

      const noise = {
        id: state.nextNoiseId++,
        x, y, layer, radius, intensity, kind,
        supernatural: Boolean(opts.supernatural),
        fromPlayer: opts.fromPlayer !== false,
        life: opts.life ?? 0.9,
        maxLife: opts.life ?? 0.9
      };
      state.noises.push(noise);
      addLocalHeat(intensity * (noise.supernatural ? 2.1 : 1.15), null, x, y, layer);

      let authorityHeard = false;
      let hunterRevealed = false;

      for (const n of npcs) {
        if (n.dead || n.stunned || n.hiddenBody) continue;

        // Hidden hunters are not visible, but can sense supernatural power or nearby impact noise.
        // Police-only noises such as vandalism/glass should not summon occult hunters.
        if ((opts.policeOnly || kind === "glass") && n.type === "hunter") continue;
        if (n.type === "hunter" && n.hidden && !n.revealed) {
          const d = Math.hypot(n.x - x, n.y - y);
          if ((noise.supernatural && d < radius * 1.05) || (intensity >= 4.8 && d < radius * 0.7)) {
            n.hidden = false;
            n.revealed = true;
            state.stats.huntersRevealed++;
            n.active = true;
            n.investigatingNoise = { x, y, kind };
            n.investigateTimer = 5.5;
            n.lastKnown.x = x;
            n.lastKnown.y = y;
            hunterRevealed = true;
          }
          continue;
        }

        if (n.hidden && !n.revealed) continue;
        if (!canHearNoise(n, noise)) continue;

        const d = Math.hypot(n.x - x, n.y - y);
        n.suspiciousTimer = Math.max(n.suspiciousTimer || 0, 2.4 + intensity * 0.35);
        n.investigatingNoise = { x, y, kind };
        n.investigateTimer = Math.max(n.investigateTimer || 0, 2.8 + intensity * 0.9);

        if (n.type === "police" || n.type === "hunter") {
          authorityHeard = true;
          n.active = n.active || exposureLevel() >= (n.type === "hunter" ? 3 : 1) || intensity >= 4.5 || noise.supernatural;
          n.lastKnown.x = x;
          n.lastKnown.y = y;
          if (n.active) n.chaseTimer = Math.max(n.chaseTimer, noise.supernatural ? 1.8 : 0.9);
        } else if ((kind === "brutal-feed" || kind === "glass" || kind === "drop") && intensity >= 4.2 && d < radius * 0.55) {
          // Los civiles no siempre avisan por un noise, pero un estruendo cercano los pone en modo witness.
          alarmWitness(n, noiseLabel(kind), kind === "brutal-feed" ? 14 : 8);
        }
      }

      if (authorityHeard && intensity >= 4.8 && opts.exposure !== false) {
        addExposure(noise.supernatural ? 6 : 3, `${noiseLabel(kind)}: a patrol hears something and moves in to investigate.`);
      }
      if (hunterRevealed && opts.hunterMessage !== false && state.time - state.lastNoiseMessageAt > 1.0) {
        state.lastNoiseMessageAt = state.time;
        say("A hidden hunter senses the noise and comes out to investigate.", 2.8);
      }
      return noise;
    }

    function updateNoises(dt) {
      for (const n of state.noises) n.life -= dt;
      state.noises = state.noises.filter(n => n.life > 0);
    }

    function addShake(power = 0.15) {
      state.shake = Math.max(state.shake, power);
    }

    function addFxTrail(x1, y1, x2, y2, layer, style = "jump", life = 0.35) {
      state.fxTrails.push({ x1, y1, x2, y2, layer, style, life, maxLife: life });
    }

    function addFxBurst(x, y, layer, style = "land", size = 18, life = 0.38) {
      state.fxBursts.push({ x, y, layer, style, size, life, maxLife: life });
    }

    function addFogCloud(x, y, layer, radius = 28, life = 2.2, strength = 0.74, style = "mist") {
      state.fogClouds.push({ x, y, layer, radius, life, maxLife: life, strength, style });
    }

    function updateEffects(dt) {
      for (const t of state.fxTrails) t.life -= dt;
      state.fxTrails = state.fxTrails.filter(t => t.life > 0);
      for (const b of state.fxBursts) b.life -= dt;
      state.fxBursts = state.fxBursts.filter(b => b.life > 0);
      for (const f of state.fogClouds) f.life -= dt;
      state.fogClouds = state.fogClouds.filter(f => f.life > 0);
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);
    }

    function startCinematic(kind, landingX, landingY, layer, opts = {}) {
      state.cinematic = {
        kind,
        time: opts.duration ?? (kind === "drop" ? 0.56 : 0.42),
        duration: opts.duration ?? (kind === "drop" ? 0.56 : 0.42),
        zoom: opts.zoom ?? (kind === "drop" ? 0.28 : 0.18),
        lift: opts.lift ?? (kind === "drop" ? 26 : 16),
        airScale: opts.airScale ?? (kind === "drop" ? 0.95 : 0.78),
        landed: false,
        freeze: opts.freeze ?? 0.06,
        freezeTimer: 0,
        landingX,
        landingY,
        layer,
        startX: opts.startX ?? player.x,
        startY: opts.startY ?? player.y,
        endX: opts.endX ?? landingX,
        endY: opts.endY ?? landingY,
        startLayer: opts.startLayer ?? player.layer,
        endLayer: opts.endLayer ?? layer,
        movePlayer: Boolean(opts.movePlayer),
        anticipation: opts.anticipation ?? 0.16,
        anticipationBack: opts.anticipationBack ?? 8,
        anticipationSquash: opts.anticipationSquash ?? 0.14,
        landAt: opts.landAt ?? 0.78,
        landingBurstStyle: opts.landingBurstStyle ?? (kind === "drop" ? "drop" : "land"),
        landingBurstSize: opts.landingBurstSize ?? (kind === "drop" ? 26 : 18),
        landingShake: opts.landingShake ?? (kind === "drop" ? 0.34 : 0.18),
        dust: Boolean(opts.dust)
      };
    }

    function updateCinematic(dt) {
      if (!state.cinematic) return;
      const c = state.cinematic;
      if (c.freezeTimer > 0) {
        c.freezeTimer = Math.max(0, c.freezeTimer - dt);
        if (c.freezeTimer <= 0 && c.time <= 0) {
          if (c.movePlayer) {
            player.layer = c.endLayer;
            player.x = c.endX;
            player.y = c.endY;
          }
          state.cinematic = null;
        }
        return;
      }

      c.time = Math.max(0, c.time - dt);
      const progress = 1 - c.time / c.duration;

      if (c.movePlayer) {
        let px = c.startX;
        let py = c.startY;
        if (progress < c.anticipation) {
          const ap = progress / Math.max(0.001, c.anticipation);
          const back = Math.sin(ap * Math.PI) * c.anticipationBack;
          const dx = c.endX - c.startX;
          const dy = c.endY - c.startY;
          const len = Math.hypot(dx, dy) || 1;
          px = c.startX - (dx / len) * back;
          py = c.startY - (dy / len) * back;
          player.layer = c.startLayer;
        } else if (progress < c.landAt) {
          const moveP = (progress - c.anticipation) / Math.max(0.001, c.landAt - c.anticipation);
          const eased = moveP < 0.5
            ? 2 * moveP * moveP
            : 1 - Math.pow(-2 * moveP + 2, 2) / 2;
          px = c.startX + (c.endX - c.startX) * eased;
          py = c.startY + (c.endY - c.startY) * eased;
          player.layer = c.startLayer;
        } else {
          px = c.endX;
          py = c.endY;
          player.layer = c.endLayer;
        }
        player.x = px;
        player.y = py;
      }

      if (!c.landed && progress >= c.landAt) {
        c.landed = true;
        AudioBus.play(c.kind === "drop" ? "landingHeavy" : "landingLight", c.kind === "drop" ? 1.25 : 0.9);
        addFxBurst(c.landingX, c.landingY, c.layer, c.landingBurstStyle, c.landingBurstSize, c.kind === "drop" ? 0.46 : 0.34);
        if (c.dust) {
          addFogCloud(c.landingX - 8, c.landingY + 2, c.layer, 14, 0.55, 0.28, "dust");
          addFogCloud(c.landingX + 8, c.landingY + 1, c.layer, 16, 0.62, 0.28, "dust");
          addFogCloud(c.landingX, c.landingY + 4, c.layer, 18, 0.72, 0.30, "dust");
        }
        addShake(c.landingShake);
      }
      if (c.time <= 0) {
        c.freezeTimer = c.freeze;
      }
    }

    function updateNoiseInvestigation(n, dt) {
      if (!n.investigatingNoise || n.investigateTimer <= 0 || n.dead || n.stunned) {
        n.investigatingNoise = null;
        n.investigateTimer = 0;
        return false;
      }

      n.investigateTimer -= dt;
      const p = n.investigatingNoise;
      const ax = p.x - n.x;
      const ay = p.y - n.y;
      const len = Math.hypot(ax, ay) || 1;

      n.dirX = ax / len;
      n.dirY = ay / len;

      // Un witness apostado no siempre abandona su esquina: se gira y mira hacia el noise.
      if ((n.type === "civilian" || n.type === "target") && n.behavior === "loiter") {
        if (n.investigateTimer <= 0) n.investigatingNoise = null;
        return true;
      }

      if (len > 10) {
        const speed = (n.type === "police" || n.type === "hunter") ? enemyJogSpeed(n) : n.speed * 0.58;
        moveEntity(n, (ax / len) * speed, (ay / len) * speed, dt);
      } else {
        n.waitTimer = Math.max(n.waitTimer || 0, 0.25);
      }

      if ((n.type === "police" || n.type === "hunter") && canSeeEntity(n, player, { range: n.type === "hunter" ? 185 : 155, cosLimit: 0.18 })) {
        n.active = true;
        n.lastKnown.x = player.x;
        n.lastKnown.y = player.y;
        n.chaseTimer = Math.max(n.chaseTimer, n.type === "hunter" ? 2.2 : 1.5);
        if (exposureLevel() === 0) addExposure(4, "An authority finds you near the noise. Suspicion begins.");
      }

      if (n.investigateTimer <= 0) n.investigatingNoise = null;
      return true;
    }

    // ---------------------------------------------------------
    // Blood trail / physical investigation
    // ---------------------------------------------------------

    function bloodLabel(kind) {
      if (kind === "brutal-feed") return "brutal blood";
      if (kind === "drag") return "drag trail";
      if (kind === "drop") return "salpicadura";
      if (kind === "intercept") return "witness blood";
      return "blood";
    }

    function createBloodStain(x, y, layer = player.layer, opts = {}) {
      if (player.inSafehouse && opts.allowSafehouse !== true) return null;
      const stain = {
        id: state.nextBloodStainId++,
        x: x + (opts.jitter === false ? 0 : (Math.random() - 0.5) * (opts.spread ?? 12)),
        y: y + (opts.jitter === false ? 0 : (Math.random() - 0.5) * (opts.spread ?? 12)),
        layer,
        size: clamp(opts.size ?? 4, 2, 11),
        kind: opts.kind || "blood",
        brutal: Boolean(opts.brutal),
        age: 0,
        life: layer === LAYER.SEWER ? 18 + Math.random() * 12 : 70 + Math.random() * 45,
        discovered: false,
        hunted: false,
        cleaned: false
      };
      state.bloodStains.push(stain);
      addLocalHeat(stain.brutal ? 2.8 : 1.1, null, stain.x, stain.y, layer);
      state.stats.bloodStainsCreated++;
      if (state.bloodStains.length > 42) state.bloodStains.shift();
      return stain;
    }

    function scatterBloodStains(x, y, layer, count, opts = {}) {
      const made = [];
      for (let i = 0; i < count; i++) {
        made.push(createBloodStain(x, y, layer, {
          kind: opts.kind || "blood",
          brutal: opts.brutal,
          size: (opts.size ?? 4) + Math.random() * (opts.sizeVariance ?? 4),
          spread: opts.spread ?? 18
        }));
      }
      const visibleMade = made.filter(Boolean).length;
      if (visibleMade && opts.message !== false && state.time - state.lastBloodMessageAt > 1.2) {
        state.lastBloodMessageAt = state.time;
        say(opts.brutal ? "Brutal blood trail left behind. Hunters can follow it." : "You leave blood stains. If someone discovers them, the investigation escalates.", 2.8);
      }
      return made.filter(Boolean);
    }

    function nearestBloodStainFor(n, maxRange = 190) {
      let best = null;
      let bestScore = Infinity;
      for (const stain of state.bloodStains) {
        if (stain.cleaned || stain.layer !== n.layer) continue;
        if (stain.layer !== LAYER.STREET) continue;
        const d = Math.hypot(stain.x - n.x, stain.y - n.y);
        if (d > maxRange) continue;
        const score = d - (stain.brutal ? 45 : 0) - (stain.discovered ? 12 : 0);
        if (score < bestScore) { best = stain; bestScore = score; }
      }
      return best;
    }

    function cleanBloodAround(x, y, layer, radius = 74, reason = "") {
      let count = 0;
      for (const stain of state.bloodStains) {
        if (stain.cleaned || stain.layer !== layer) continue;
        if (Math.hypot(stain.x - x, stain.y - y) <= radius) {
          stain.cleaned = true;
          count++;
        }
      }
      if (count > 0) {
        state.bloodStains = state.bloodStains.filter(s => !s.cleaned);
        say(reason || `Trail limpiado: ${count} mancha(s) dejan de ser prueba.`, 2.8);
      }
      return count;
    }

    function canSeeBlood(observer, stain) {
      if (!observer || observer.dead || observer.stunned || observer.hiddenBody) return false;
      if (observer.hidden && !observer.revealed) return false;
      if (!stain || stain.cleaned || observer.layer !== stain.layer) return false;
      if (stain.layer !== LAYER.STREET) return false;
      const range = observer.type === "hunter" ? 190 : observer.type === "police" ? 150 : 105;
      const fakeTarget = { x: stain.x, y: stain.y, layer: stain.layer };
      return canSeeEntity(observer, fakeTarget, { range: range + stain.size * 3, cosLimit: observer.type === "hunter" ? 0.05 : 0.20 });
    }

    function setBloodInvestigation(n, stain, seconds = 4.5) {
      if (!n || !stain) return;
      n.investigatingBlood = { x: stain.x, y: stain.y, id: stain.id, kind: stain.kind };
      n.bloodTrackTimer = Math.max(n.bloodTrackTimer || 0, seconds);
      n.lastKnown.x = stain.x;
      n.lastKnown.y = stain.y;
      n.suspiciousTimer = Math.max(n.suspiciousTimer || 0, 2.8);
      if (n.type === "police" || n.type === "hunter") {
        n.active = true;
        n.chaseTimer = Math.max(n.chaseTimer || 0, n.type === "hunter" ? 1.2 : 0.6);
      }
    }

    function updateBloodInvestigation(n, dt) {
      if (!n.investigatingBlood || n.bloodTrackTimer <= 0 || n.dead || n.stunned) {
        n.investigatingBlood = null;
        n.bloodTrackTimer = 0;
        return false;
      }
      n.bloodTrackTimer -= dt;
      const p = n.investigatingBlood;
      const ax = p.x - n.x;
      const ay = p.y - n.y;
      const len = Math.hypot(ax, ay) || 1;
      n.dirX = ax / len;
      n.dirY = ay / len;

      if (len > 9) {
        const speed = (n.type === "hunter" || n.type === "police") ? enemyJogSpeed(n) : n.speed * 0.45;
        moveEntity(n, (ax / len) * speed, (ay / len) * speed, dt);
      } else {
        n.waitTimer = Math.max(n.waitTimer || 0, 0.35);
        if (n.type === "hunter") {
          const next = nearestBloodStainFor(n, 145);
          if (next && next.id !== p.id) setBloodInvestigation(n, next, 3.8);
        }
      }

      if ((n.type === "police" || n.type === "hunter") && canSeeEntity(n, player, { range: n.type === "hunter" ? 190 : 150, cosLimit: 0.12 })) {
        n.active = true;
        n.lastKnown.x = player.x;
        n.lastKnown.y = player.y;
        n.chaseTimer = Math.max(n.chaseTimer, n.type === "hunter" ? 2.6 : 1.7);
        return false;
      }
      return true;
    }

    function updateBloodStains(dt) {
      for (const stain of state.bloodStains) {
        stain.age += dt;
        if (stain.layer === LAYER.SEWER) stain.life -= dt * 1.8;
        else stain.life -= dt * 0.12;
      }
      state.bloodStains = state.bloodStains.filter(s => !s.cleaned && s.life > 0);
    }

    function updateBloodDiscovery(dt) {
      if (!state.bloodStains.length) return;
      for (const stain of state.bloodStains) {
        if (stain.cleaned || stain.layer !== LAYER.STREET) continue;

        // Hidden hunters: they do not visibly patrol, but can smell fresh or brutal blood.
        for (const hunter of npcs) {
          if (hunter.type !== "hunter" || hunter.dead || hunter.revealed || !hunter.hidden) continue;
          const scentRange = stain.brutal ? 235 : 160;
          const d = Math.hypot(hunter.x - stain.x, hunter.y - stain.y);
          if (d <= scentRange && (stain.brutal || stain.age < 28)) {
            hunter.hidden = false;
            hunter.revealed = true;
            state.stats.huntersRevealed++;
            hunter.active = true;
            setBloodInvestigation(hunter, stain, 6.5);
            stain.hunted = true;
            if (state.time - state.lastBloodMessageAt > 1.0) {
              state.lastBloodMessageAt = state.time;
              say("A hidden hunter smells the blood and comes out to track it.", 3);
            }
          }
        }

        for (const watcher of npcs) {
          if (watcher.dead || watcher.hiddenBody || watcher.stunned) continue;
          if (!["civilian", "target", "police", "hunter"].includes(watcher.type)) continue;
          if (!canSeeBlood(watcher, stain)) continue;

          if (watcher.type === "civilian" || watcher.type === "target") {
            if (!stain.discovered) {
              stain.discovered = true;
              alarmWitness(watcher, "blood on the ground", stain.brutal ? 16 : 10);
              addExposure(stain.brutal ? 4 : 2, "A civilian finds blood and panics.");
            }
          } else if (watcher.type === "police") {
            if (!stain.discovered || !stain.policeSeen) {
              stain.discovered = true;
              stain.policeSeen = true;
              setBloodInvestigation(watcher, stain, 5.2);
              addExposure(stain.brutal ? 12 : 7, "Police find blood and start following the trail.");
            }
          } else if (watcher.type === "hunter") {
            if (!stain.hunted) {
              stain.discovered = true;
              stain.hunted = true;
              setBloodInvestigation(watcher, stain, 6.8);
              addExposure(stain.brutal ? 8 : 4, "A hunter reads the blood trail. It does not need to see you.");
            }
          }
          break;
        }
      }
    }

    function powerHungerFor(kind) {
      if (kind === "dash") return BALANCE.dashHunger;
      if (kind === "whisper") return BALANCE.whisperHunger;
      if (kind === "sense") return BALANCE.senseHunger;
      return 0;
    }

    function beastStageWarning(level) {
      if (level === 1) return "High hunger: your senses awaken, but you are less discreet.";
      if (level === 2) return "The Beast is close: more speed and power, more exposure if seen.";
      if (level === 3) return "FRENZY: stay away from civilians or you may lunge without meaning to.";
      return "";
    }

    function addPowerHunger(amount, powerName) {
      if (amount <= 0) return "";
      const beforeHunger = player.hunger;
      const beforeStage = beastStage().level;
      player.hunger = clamp(player.hunger + amount, 0, 100);
      state.stats.hungerFromPowers += Math.max(0, player.hunger - beforeHunger);
      player.beastFlash = Math.max(player.beastFlash, 0.16);
      const afterStage = beastStage().level;
      if (afterStage > beforeStage) {
        state.lastBeastLevel = afterStage;
        const warning = beastStageWarning(afterStage);
        return warning ? ` ${warning}` : "";
      }
      return "";
    }

    function getShadowZoneAt(x, y, layer = player.layer, inSafehouse = false) {
      if (layer !== LAYER.STREET || inSafehouse) return null;
      const staticShadow = hiddenZones.find(z => pointInRect(x, y, z));
      if (staticShadow) return staticShadow;
      const fogCloud = state.fogClouds.find(f => f.style !== "dust" && f.layer === layer && Math.hypot(f.x - x, f.y - y) < f.radius * 0.82);
      if (fogCloud) {
        return { name: "mist veil", x: fogCloud.x - fogCloud.radius, y: fogCloud.y - fogCloud.radius, w: fogCloud.radius * 2, h: fogCloud.radius * 2, strength: fogCloud.strength };
      }
      const brokenLamp = lightPosts.find(l => l.broken && Math.hypot(l.x - x, l.y - y) < l.radius * 0.72);
      if (brokenLamp) {
        return { name: `shadow of ${brokenLamp.name}`, x: brokenLamp.x - lShadowW(brokenLamp) / 2, y: brokenLamp.y - lShadowW(brokenLamp) / 2, w: lShadowW(brokenLamp), h: lShadowW(brokenLamp), strength: 0.58 };
      }
      return null;
    }

    function lShadowW(light) {
      return Math.max(52, Math.floor(light.radius * 1.35));
    }

    function getLightZoneAt(x, y, layer = player.layer, inSafehouse = false) {
      if (layer !== LAYER.STREET || inSafehouse) return null;
      return lightPosts.find(l => !l.broken && !l.outageTimer && Math.hypot(l.x - x, l.y - y) < l.radius) || null;
    }

    function isHiddenPlace() {
      if (player.inSafehouse || player.layer === LAYER.SEWER || player.layer > LAYER.STREET) return true;
      return Boolean(getShadowZoneAt(player.x, player.y, player.layer, player.inSafehouse));
    }

    function visionMultiplierForShadow(observer, zone) {
      if (!zone) return 1;
      if (observer.type === "hunter") return 1 - zone.strength * 0.32;
      if (observer.type === "police") return 1 - zone.strength * 0.45;
      return 1 - zone.strength * 0.62;
    }

    function canStandAt(x, y, layer = player.layer, inSafehouse = player.inSafehouse) {
      const r = rectFor(x, y);
      if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return false;

      if (layer === LAYER.STREET) {
        if (inSafehouse) {
          const home = buildings.find(b => b.id === "safehouse");
          return rectsOverlap(r, { x: home.x + 12, y: home.y + 12, w: home.w - 24, h: home.h - 24 });
        }
        return !buildings.some(b => rectsOverlap(r, b));
      }

      if (layer === LAYER.SEWER) {
        return sewerTunnels.some(t => rectsOverlap(r, t));
      }

      if (layer === LAYER.ROOF_LOW || layer === LAYER.ROOF_HIGH) {
        return roofAreas[layer].some(a => rectsOverlap(r, a));
      }

      return true;
    }

    function moveEntity(entity, dx, dy, dt) {
      if (Math.hypot(dx, dy) > 0.01) {
        const len = Math.hypot(dx, dy) || 1;
        entity.dirX = dx / len;
        entity.dirY = dy / len;
      }
      const nx = entity.x + dx * dt;
      if (canStandAt(nx, entity.y, entity.layer, false)) entity.x = nx;
      const ny = entity.y + dy * dt;
      if (canStandAt(entity.x, ny, entity.layer, false)) entity.y = ny;
    }

    // ---------------------------------------------------------
    // Vision / witnesses / line of sight
    // ---------------------------------------------------------

    function visionRange(n) {
      if (n.type === "hunter") return 190;
      if (n.type === "police") return 170;
      if (n.type === "target") return 110;
      return 125;
    }

    function visionCosLimit(n) {
      // Lower values mean wider cones. Hunters and police observe better.
      if (n.type === "hunter") return 0.30;
      if (n.type === "police") return 0.38;
      return 0.48;
    }

    function lineBlockedByBuildings(x1, y1, x2, y2) {
      // Simple sampling: enough for this prototype and easy to expand.
      const steps = Math.max(6, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        if (buildings.some(b => pointInRect(x, y, b))) return true;
      }
      return false;
    }

    function hasLineOfSight(a, b) {
      if (a.layer !== b.layer) return false;
      if (player.inSafehouse && (a === player || b === player)) return false;
      if (a.layer === LAYER.SEWER) return Math.hypot(a.x - b.x, a.y - b.y) < 65;
      if (a.layer !== LAYER.STREET) return true;
      return !lineBlockedByBuildings(a.x, a.y, b.x, b.y);
    }

    function canSeeEntity(observer, target, opts = {}) {
      if (!observer || !target || observer.dead || observer.stunned) return false;
      if (observer === target) return false;
      if (observer.layer !== target.layer) return false;
      if (player.inSafehouse && target === player) return false;
      if ((observer.hidden && !observer.revealed) || (target.hidden && !target.revealed)) return false;

      const dx = target.x - observer.x;
      const dy = target.y - observer.y;
      const d = Math.hypot(dx, dy);
      let range = opts.range ?? visionRange(observer);

      // Shadows do not make you invisible: they reduce range and clarity.
      // This enables tactical feeding without making stealth binary.
      const shadowZone = (target === player || target.dead) ? getShadowZoneAt(target.x, target.y, target.layer, target === player && player.inSafehouse) : null;
      if (shadowZone) range *= visionMultiplierForShadow(observer, shadowZone);
      const lightZone = (target === player || target.dead) ? getLightZoneAt(target.x, target.y, target.layer, target === player && player.inSafehouse) : null;
      if (lightZone && !shadowZone) range *= observer.type === "hunter" ? 1.10 : observer.type === "police" ? 1.22 : 1.16;

      if (d > range) return false;
      if (!hasLineOfSight(observer, target)) return false;

      // At very close range, peripheral perception is assumed.
      if (d < 34 || opts.ignoreFov) return true;
      const len = d || 1;
      const dot = (dx / len) * (observer.dirX || 0) + (dy / len) * (observer.dirY || 1);
      return dot >= (opts.cosLimit ?? visionCosLimit(observer));
    }

    function visibleWitnessList(radius = 130, victim = null) {
      if (player.inSafehouse || player.layer !== LAYER.STREET) return [];
      const witnesses = [];
      for (const n of npcs) {
        if (n.dead || n.stunned || n === victim) continue;
        if (n.layer !== player.layer) continue;
        if (!["civilian", "target", "police", "hunter"].includes(n.type)) continue;
        const seesPlayer = canSeeEntity(n, player, { range: radius });
        const seesVictim = victim ? canSeeEntity(n, victim, { range: radius }) : false;
        if (seesPlayer || seesVictim) witnesses.push(n);
      }
      return witnesses;
    }

    function publicWitnesses(radius = 130, victim = null) {
      return visibleWitnessList(radius, victim).length;
    }

    function enemiesSeeingPlayer(radius = 180) {
      return npcs.some(n => !n.dead && (n.type === "police" || n.type === "hunter") && n.active && canSeeEntity(n, player, { range: radius, cosLimit: 0.15 }));
    }

    function nearestFeedable() {
      // Rats in the sewers are small emergency feeding targets.
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (n.dead || n.stunned) continue;
        if (n.type !== "civilian" && n.type !== "target" && n.type !== "rat") continue;
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 21 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function whisperRangeFor(n) {
      const base = n.type === "target" ? 76 : 52;
      return base * beastStage().whisperRangeMul;
    }

    function nearestLurable() {
      if (player.inSafehouse || player.layer !== LAYER.STREET) return null;
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (n.dead || n.stunned || n.fleeTimer > 0) continue;
        if (n.type !== "civilian" && n.type !== "target") continue;
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        // The target is easier to tempt; high hunger makes the whisper reach farther.
        const range = whisperRangeFor(n);
        if (d < range && d < bestD && hasLineOfSight(player, n)) { best = n; bestD = d; }
      }
      return best;
    }

    function nearbyInteractable() {
      let best = null;
      let bestD = Infinity;
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      return best;
    }

    function enemiesNear(radius = 150) {
      return npcs.some(n => !n.dead && (n.type === "police" || n.type === "hunter") && n.active && n.layer === player.layer && Math.hypot(n.x - player.x, n.y - player.y) < radius);
    }

    function activeAlarmedWitnesses() {
      return npcs.filter(n => !n.dead && !n.stunned && n.alarmed && !n.hasReported);
    }

    function nearestAlarmedWitness() {
      let best = null;
      let bestD = Infinity;
      for (const n of activeAlarmedWitnesses()) {
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 23 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function nearestBody() {
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (!n.dead || n.hiddenBody || n.dragged) continue;
        if (n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 25 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function nearestBreakableLight() {
      if (player.inSafehouse || player.layer !== LAYER.STREET) return null;
      let best = null;
      let bestD = Infinity;
      for (const l of lightPosts) {
        if (l.broken) continue;
        const d = Math.hypot(l.x - player.x, l.y - player.y);
        if (d < 32 && d < bestD) { best = l; bestD = d; }
      }
      return best;
    }

    function chooseReportPoint(n) {
      let best = reportPoints[0];
      let bestScore = Infinity;
      for (const p of reportPoints) {
        const score = Math.hypot(p.x - n.x, p.y - n.y) - p.severityBonus * 4;
        if (score < bestScore) { best = p; bestScore = score; }
      }
      return best;
    }

    function alarmWitness(n, reason = "algo imposible", severity = 14) {
      if (!n || n.dead || n.stunned) return;
      if (n.type !== "civilian" && n.type !== "target") return;
      if (n.layer !== LAYER.STREET) return;

      const wasAlreadyAlarmed = n.alarmed && !n.hasReported;
      n.alarmed = true;
      n.hasReported = false;
      n.alarmTimer = Math.max(n.alarmTimer, 10 + Math.random() * 4);
      n.reportTarget = n.reportTarget || chooseReportPoint(n);
      n.reportSeverity = Math.max(n.reportSeverity, severity + (n.reportTarget?.severityBonus || 0));
      n.witnessReason = reason;
      n.fleeTimer = 0;
      n.luredTimer = 0;
      n.suspiciousTimer = 3.0;
      n.waitTimer = 0;
      n.aiTimer = 0;

      if (!wasAlreadyAlarmed) {
        say(`A witness saw ${reason}. They run toward ${n.reportTarget.name}.`, 3.2);
      }
    }

    function alarmCivilianWitnesses(witnesses, reason, severity = 14) {
      for (const n of witnesses) {
        if (n.type === "civilian" || n.type === "target") alarmWitness(n, reason, severity);
      }
    }

    function reportToPolice(n) {
      if (!n || n.hasReported || !n.alarmed) return;
      n.hasReported = true;
      state.stats.witnessesReported++;
      n.alarmed = false;
      n.fleeTimer = 2.5;
      n.suspiciousTimer = 0;
      const targetName = n.reportTarget ? n.reportTarget.name : "a lit area";
      addLocalHeat(18, "witness report", n.x, n.y, n.layer);
      addExposure(Math.ceil((n.reportSeverity || 18) * 0.65), `A witness reaches ${targetName} and reports you. The hunt organizes.`);

      for (const e of npcs) {
        if (!e.dead && e.type === "police" && Math.hypot(e.x - n.x, e.y - n.y) < 180) {
          e.active = true;
          e.chaseTimer = Math.max(e.chaseTimer, 2.2);
          e.lastKnown.x = player.x;
          e.lastKnown.y = player.y;
        }
      }
    }

    function updateAlarmedWitness(n, dt) {
      if (!n.alarmed || n.hasReported || n.dead || n.stunned) return false;
      n.alarmTimer -= dt;
      if (!n.reportTarget) n.reportTarget = chooseReportPoint(n);

      const nearbyCop = npcs.find(e => !e.dead && e.type === "police" && e.layer === n.layer && Math.hypot(e.x - n.x, e.y - n.y) < 28);
      if (nearbyCop) {
        nearbyCop.active = true;
        reportToPolice(n);
        return true;
      }

      const p = n.reportTarget;
      const ax = p.x - n.x;
      const ay = p.y - n.y;
      const len = Math.hypot(ax, ay) || 1;
      const panicSpeed = Math.max(30, n.speed * 2.1);
      moveEntity(n, (ax / len) * panicSpeed, (ay / len) * panicSpeed, dt);

      if (Math.hypot(n.x - p.x, n.y - p.y) < 18) {
        reportToPolice(n);
        return true;
      }

      // Si se queda trabado, cambia a un punto alternativo para no parecer roto.
      if (n.alarmTimer <= 0) {
        n.reportTarget = reportPoints[Math.floor(Math.random() * reportPoints.length)];
        n.alarmTimer = 5 + Math.random() * 4;
      }
      return true;
    }

    function interceptWitness(n) {
      if (!n || !n.alarmed || n.hasReported) return false;
      const witnessList = visibleWitnessList(130, n).filter(w => w !== n);
      n.alarmed = false;
      state.stats.witnessesIntercepted++;
      n.hasReported = false;
      n.reportTarget = null;
      n.reportSeverity = 0;
      n.witnessReason = "";
      n.fleeTimer = 0;
      n.luredTimer = 0;
      n.stunned = true;
      n.waitTimer = 2.4;
      n.suspiciousTimer = 0;

      exposeToCameras(6, "Witness interception recorded", n.x, n.y, n.layer);
      if (witnessList.length > 0 && !isHiddenPlace()) {
        scatterBloodStains(n.x, n.y, n.layer, 2, { kind: "intercept", brutal: false, size: 3, spread: 10, message: false });
        alarmCivilianWitnesses(witnessList, "you silencing a witness", 12);
        addExposure(6 + witnessList.length * 4, `You intercept the witness, but ${witnessList.length} person/people see it.`);
      } else {
        if (beastStage().level >= 2) createBloodStain(n.x, n.y, n.layer, { kind: "intercept", size: 3, spread: 8, brutal: false });
        say("You intercept the witness before they can report.", 2.4);
      }
      return true;
    }

    // ---------------------------------------------------------
    // Input / interacciones
    // ---------------------------------------------------------

    function nearestHostilePedestrian() {
      let best = null;
      let bestD = Infinity;
      for (const n of npcs) {
        if (!n.hostileTimer || n.dead || n.stunned || n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (d < 24 && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    function shoveHostilePedestrian(n) {
      if (!n) return false;
      n.hostileTimer = 0;
      n.stunned = true;
      n.waitTimer = 1.6;
      const dx = n.x - player.x;
      const dy = n.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      n.x += (dx / len) * 26;
      n.y += (dy / len) * 26;
      addExposure(2, "A street scuffle draws eyes.");
      say("You shove the pedestrian back. Enough to move, not enough to stay quiet.", 2.4);
      return true;
    }

    function angerPedestrianNear(x, y) {
      const candidates = npcs.filter(n => n.type === "civilian" && !n.dead && !n.stunned && n.layer === LAYER.STREET && Math.hypot(n.x - x, n.y - y) < 118);
      if (!candidates.length || Math.random() > 0.45) return;
      const n = candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      n.hostileTimer = 7.0;
      n.suspiciousTimer = 4.0;
      n.fleeTimer = 0;
      say("A pedestrian snaps: 'Hey! What are you doing?' They come at you.", 2.8);
    }


    function consumePressed(key) {
      if (pressed[key]) { pressed[key] = false; return true; }
      return false;
    }

    function handleAction() {
      const hostile = nearestHostilePedestrian();
      if (hostile && shoveHostilePedestrian(hostile)) return;
      if (state.feeding) {
        cancelFeeding("You cancel feeding.");
        return;
      }

      if (state.draggingBody) {
        if (!hideDraggedBody()) dropDraggedBody();
        return;
      }

      const alarmed = nearestAlarmedWitness();
      if (alarmed) {
        interceptWitness(alarmed);
        return;
      }

      const victim = nearestFeedable();
      if (victim) {
        startFeeding(victim);
        return;
      }

      const body = nearestBody();
      if (body) {
        grabBody(body);
        return;
      }


      const lamp = nearestBreakableLight();
      if (lamp) {
        breakLight(lamp);
        return;
      }

      const it = nearbyInteractable();
      if (it && typeof it.action === "function") {
        it.action();
        return;
      }

      say("There is nothing to interact with here.", 1.4);
    }

    function currentBodyHideSpot() {
      if (player.inSafehouse) return { name: "the safehouse", clean: true };
      if (player.layer === LAYER.SEWER) return { name: "the sewers", clean: true };
      if (player.layer > LAYER.STREET) return { name: "the rooftop", clean: true };
      const explicitSpot = bodyHideSpots.find(s => s.layer === player.layer && Math.hypot(s.x - player.x, s.y - player.y) < s.r);
      if (explicitSpot) return { name: explicitSpot.name, clean: true };
      const shadow = getShadowZoneAt(player.x, player.y);
      if (shadow) return { name: shadow.name, clean: true };
      const sewer = interactables.find(i => i.id === "sewerIn");
      if (sewer && Math.hypot(sewer.x - player.x, sewer.y - player.y) < 34) return { name: "the sewer entrance", clean: true };
      return null;
    }

    function grabBody(body) {
      if (!body || body.hiddenBody) return;
      state.draggingBody = body;
      state.dragWitnessTimer = 0;
      body.dragged = true;
      body.corpseDiscovered = body.corpseDiscovered || false;
      const witnesses = visibleWitnessList(140, body).filter(w => w !== body);
      if (witnesses.length > 0 && !isHiddenPlace()) {
        alarmCivilianWitnesses(witnesses, "you dragging a body", 16);
        addExposure(8 + witnesses.length * 5, `You drag a body in sight of ${witnesses.length} witness(es).`);
      } else {
        say("You grab the body. Move slowly to a marked hide spot, shadow, sewer or safehouse.", 3);
      }
    }

    function dropDraggedBody() {
      const body = state.draggingBody;
      if (!body) return;
      body.dragged = false;
      state.draggingBody = null;
      // Dropping a body should not create automatic noise or blood evidence.
      // The risk is the visible corpse itself.
      say("You drop the body. If it remains visible, someone can find it.", 2.4);
    }

    function hideDraggedBody() {
      const body = state.draggingBody;
      if (!body) return false;
      const spot = currentBodyHideSpot();
      if (!spot) return false;
      const witnesses = visibleWitnessList(140, body).filter(w => w !== body);
      body.dragged = false;
      body.hiddenBody = true;
      state.stats.bodiesHidden++;
      if (body.type === "target") state.mission = Math.max(state.mission, 7);
      body.bodyHiddenIn = spot.name;
      body.corpseDiscovered = true;
      state.draggingBody = null;
      const cleaned = cleanBloodAround(body.x, body.y, body.layer, spot.name === "the sewers" || spot.name === "the safehouse" ? 120 : 78, "");
      exposeToCameras(7, "Hiding a body is recorded", body.x, body.y, body.layer);
      if (witnesses.length > 0 && !isHiddenPlace()) {
        alarmCivilianWitnesses(witnesses, "you hiding a body", 14);
        addExposure(6 + witnesses.length * 4, `You hide the body, but ${witnesses.length} witness(es) see it.`);
      } else {
        say(cleaned > 0
          ? `Body hidden in ${spot.name}. You clean ${cleaned} nearby trail(s).`
          : `Body hidden in ${spot.name}. The trail stops escalating exposure.`, 3);
      }
      return true;
    }

    function updateDraggedBody(dt) {
      const body = state.draggingBody;
      if (!body || body.hiddenBody) return;
      body.dead = true;
      body.dragged = true;
      body.layer = player.layer;
      const ox = player.lastDir.x || 0;
      const oy = player.lastDir.y || 1;
      const targetX = player.x - ox * 13;
      const targetY = player.y - oy * 13;
      const t = Math.min(1, dt * 12);
      body.x += (targetX - body.x) * t;
      body.y += (targetY - body.y) * t;

      state.dragWitnessTimer = Math.max(0, state.dragWitnessTimer - dt);
      state.dragNoiseTimer = Math.max(0, state.dragNoiseTimer - dt);
      state.dragBloodTimer = Math.max(0, state.dragBloodTimer - dt);
      // Dragging a body is visually risky if someone sees it, but it should not emit automatic noise
      // or create blood trails. Evidence comes from the corpse being visible, not from a passive trail.
      const witnesses = visibleWitnessList(145, body).filter(w => w !== body);
      if (witnesses.length > 0 && !isHiddenPlace() && state.dragWitnessTimer <= 0) {
        state.dragWitnessTimer = 2.4;
        alarmCivilianWitnesses(witnesses, "a body being dragged", 14);
        addExposure(4 + witnesses.length * 3, "Someone sees you moving a body through the street.");
      }
    }

    function breakLight(light) {
      if (!light || light.broken) return;
      light.broken = true;
      state.stats.lightsBroken++;
      AudioBus.play("glass", 1.0);

      if (state.time <= state.lampBreakWindowUntil) state.lampBreakChainCount++;
      else state.lampBreakChainCount = 1;
      state.lampBreakWindowUntil = state.time + 12;

      const witnesses = visibleWitnessList(145).filter(w => w.type !== "hunter");
      addLocalHeat(witnesses.length > 0 ? 12 : 8, "streetlight vandalism", light.x, light.y, LAYER.STREET);
      addExposure(witnesses.length > 0 ? 5 : 3, `${light.name} broken. The avenue gets darker, but the district notices.`);
      forceExposureLevel(1, "Alert level 1: breaking streetlights makes the district watch you.");
      if (state.lampBreakChainCount >= 3) {
        forceExposureLevel(2, "Alert level 2: repeated vandalism brings police pressure.");
        callPoliceAttention(light.x, light.y, LAYER.STREET, "multiple streetlights broken in quick succession", 1.2);
      }
      angerPedestrianNear(light.x, light.y);
      say("The lamp goes out. Useful shadow, higher alert.", 3);
    }

    function startFeeding(victim) {
      const shadow = getShadowZoneAt(player.x, player.y);
      const hiddenStart = isHiddenPlace();
      const witnesses = hiddenStart ? 0 : visibleWitnessList(135, victim).length;
      const beast = beastStage();
      const baseDuration = victim.type === "target" ? 1.25 : 1.05;
      const duration = Math.max(0.55, baseDuration / beast.feedSpeedMul);

      victim.stunned = true;
      victim.vx = 0;
      victim.vy = 0;
      victim.waitTimer = duration;

      AudioBus.play("feedStart", beast.level >= 3 ? 1.25 : 1.0);
      state.feeding = {
        victim,
        time: 0,
        duration,
        maxWitnesses: witnesses,
        wasHidden: hiddenStart,
        seenNotified: witnesses > 0,
        shadowName: shadow ? shadow.name : ""
      };

      if (beast.level >= 3) {
        say(witnesses > 0
          ? `FRENZY: you go for the throat in front of ${witnesses} witness(es). Move to cancel.`
          : "FRENZY: you drink too fast. Do not move if you want to finish.", 2.4);
      } else if (witnesses > 0 && !isHiddenPlace()) {
        say(`Draining in plain sight: ${witnesses} witness(es). Move to cancel.`, 2);
      } else if (shadow) {
        say(`Draining in shadow: ${shadow.name}. Do not move.`, 2);
      } else {
        say("Draining... Do not move.", 2);
      }
    }

    function updateFeeding(dt) {
      const f = state.feeding;
      if (!f) return;
      const victim = f.victim;
      if (!victim || victim.dead) {
        state.feeding = null;
        return;
      }

      // Si alguien entra en vision durante la feeding, el riesgo se actualiza en vivo.
      const witnesses = visibleWitnessList(145, victim);
      f.maxWitnesses = Math.max(f.maxWitnesses, witnesses.length);
      if (witnesses.length > 0 && !isHiddenPlace()) {
        alarmCivilianWitnesses(witnesses, "a feeding", 16);
        for (const n of witnesses) {
          if (n.type === "civilian" || n.type === "target") n.fleeTimer = Math.max(n.fleeTimer, 1.0);
        }
        if (!f.seenNotified) {
          f.seenNotified = true;
          createNoise(player.x, player.y, player.layer, 112, 3.2, "feed", { exposure: false });
          addExposure(3 + witnesses.length * 2, "A witness sees the feeding and runs to report it.");
        }
      }

      // High hunger speeds up feeding, but makes the scene messier and more dangerous.
      const beast = beastStage();
      const witnessDrag = f.maxWitnesses > 0 && beast.level >= 2 ? 0.90 : 1;
      f.time += dt * beast.feedSpeedMul * witnessDrag;

      // Mantiene al target pegado al jugador para que se lea como agarre.
      victim.x = player.x + player.lastDir.x * 9;
      victim.y = player.y + player.lastDir.y * 9;

      if (f.time >= f.duration) finishFeeding();
    }

    function cancelFeeding(text = "You cancel feeding.") {
      const f = state.feeding;
      if (!f) return;
      const victim = f.victim;
      if (victim && !victim.dead) {
        victim.stunned = false;
        victim.waitTimer = 0.8;
        if (f.maxWitnesses > 0 && !isHiddenPlace()) {
          addExposure(5 + f.maxWitnesses * 3, "Someone sees the struggle before you pull away.");
        }
      }
      state.feeding = null;
      say(text, 1.8);
    }

    function finishFeeding() {
      const f = state.feeding;
      if (!f) return;
      const victim = f.victim;
      state.feeding = null;
      completeFeed(victim, f.maxWitnesses, f.wasHidden || Boolean(f.shadowName));
    }

    function completeFeed(victim, maxWitnesses = 0, startedHidden = false) {
      const finalWitnessList = visibleWitnessList(145, victim);
      const finalWitnesses = finalWitnessList.length;
      const witnesses = Math.max(maxWitnesses, finalWitnesses);
      if (finalWitnesses > 0) alarmCivilianWitnesses(finalWitnessList, "a freshly drained body", 12);

      victim.dead = true;
      victim.stunned = false;
      victim.active = false;
      victim.dragged = false;
      victim.hiddenBody = false;
      victim.bodyHiddenIn = "";
      const hungerBefore = player.hunger;
      const violentFeed = hungerBefore >= 95 || (hungerBefore >= 82 && witnesses > 0);
      victim.beastKilled = violentFeed;
      if (violentFeed) state.stats.brutalFeeds++;
      victim.corpseDiscovered = witnesses > 0;
      state.feedCount++;
      state.stats.feeds++;
      const hungerDrop = victim.type === "target" ? BALANCE.targetFeedRelief : victim.type === "rat" ? 12 : BALANCE.civilianFeedRelief;
      player.hunger = Math.max(0, player.hunger - hungerDrop);
      state.beastUrge = 0;
      AudioBus.play(violentFeed ? "brutalFeed" : "feedFinish", violentFeed ? 1.25 : 0.95);

      const stainCount = violentFeed ? (6 + Math.floor(Math.random() * 4)) : witnesses > 0 ? 3 : startedHidden ? 1 : 2;
      scatterBloodStains(victim.x, victim.y, victim.layer, stainCount, {
        kind: violentFeed ? "brutal-feed" : "feed",
        brutal: violentFeed,
        size: violentFeed ? 5 : 3,
        sizeVariance: violentFeed ? 5 : 2,
        spread: violentFeed ? 26 : 14,
        message: violentFeed || witnesses > 0
      });

      const hiddenNow = isHiddenPlace();
      let exposureGain = 0;

      if (violentFeed) {
        exposureGain = 12 + witnesses * 8;
        if ((startedHidden || hiddenNow) && witnesses === 0) {
          exposureGain = 6;
          say(`The Beast breaks loose: you satisfy ${hungerDrop}% hunger, but leave a brutal trail. Hide the body.`, 4);
        } else {
          say(`Brutal elimination: you satisfy ${hungerDrop}% hunger with ${witnesses} witness(es). The Beast is in charge.`, 3.5);
        }
      } else if ((startedHidden || hiddenNow) && witnesses === 0) {
        exposureGain = 0;
        say(`Clean elimination: hunger -${hungerDrop}%. Shadow hides the crime.`, 3);
      } else {
        exposureGain = 9 + witnesses * 6;
        if (hungerBefore > 75) exposureGain += 4;
        say(`Elimination complete: hunger -${hungerDrop}% with ${witnesses} witness(es).`, 3);
      }

      if (violentFeed) {
        createNoise(player.x, player.y, player.layer, witnesses > 0 ? 170 : 128, 5.2, "brutal-feed", { supernatural: true });
      } else if (witnesses > 0) {
        createNoise(player.x, player.y, player.layer, 118, 3.5, "feed", { exposure: false });
      }

      exposeToCameras(violentFeed ? 10 : 6, "The feeding is recorded", victim.x, victim.y, victim.layer);
      addLocalHeat(violentFeed ? 18 : witnesses > 0 ? 12 : 5, violentFeed ? "brutal feeding" : null, victim.x, victim.y, victim.layer);
      addExposure(exposureGain, exposureGain > 0 ? "The Masquerade cracks: exposure rises." : "");

      for (const n of npcs) {
        if (!n.dead && n.layer === player.layer && Math.hypot(n.x - player.x, n.y - player.y) < 150) {
          if (n.type === "civilian" || n.type === "target") n.fleeTimer = witnesses > 0 ? 6 : 2.5;
        }
      }

      if (victim.type === "target") {
        state.targetFed = true;
        state.mission = Math.max(state.mission, 6);
        say(exposureLevel() > 0
          ? "Target drained. Hide the body if you can, then break pursuit."
          : "Journalist eliminated. Hide the body in shadow, then return to the safehouse.", 4);
      }
    }

    function vampiricWhisper() {
      if (player.lureCooldown > 0) {
        say(`The whisper is still recovering: ${player.lureCooldown.toFixed(1)}s.`, 1.3);
        return;
      }
      const target = nearestLurable();
      if (!target) {
        state.lureHintTimer = 2.5;
        say("No one is close enough to lure. Get closer without exposing yourself.", 2);
        player.lureCooldown = 0.5;
        return;
      }
      const whisperHunger = powerHungerFor("whisper");
      const hungerWarning = addPowerHunger(whisperHunger, "Whisper");
      AudioBus.play("whisper", 1.0);
      // Whisper is intentionally subtle: it should lure the target without making bystanders suspicious.
      // Its cost is hunger and positioning, not automatic witness suspicion.
      target.luredTimer = target.type === "target" ? 7.5 : 4.5;
      state.usedWhisper = true;
      if (target.type === "target") state.targetLured = true;
      target.fleeTimer = 0;
      target.stunned = false;
      target.waitTimer = 0;
      target.aiTimer = 0.2;
      target.suspiciousTimer = 0;
      player.lureCooldown = 5.5 * beastStage().whisperCooldownMul;

      const baseMessage = target.type === "target"
        ? `You whisper to the target [+${whisperHunger} hunger]. They will follow you for a few seconds.`
        : `You whisper to a civilian [+${whisperHunger} hunger]. They approach, confused.`;
      say(`${baseMessage}${hungerWarning}`, hungerWarning ? 3.4 : 2.6);
    }

    function shadowDash() {
      if (state.draggingBody) {
        say("You cannot Shadow Dash while dragging a body.", 1.8);
        return;
      }
      if (player.dashCooldown > 0) return;
      const dashHunger = powerHungerFor("dash");
      const hungerWarning = addPowerHunger(dashHunger, "Shadow Dash");

      const dir = inputDirection();
      const dx = dir.x || player.lastDir.x;
      const dy = dir.y || player.lastDir.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const beast = beastStage();
      const distance = BALANCE.dashBaseDistance * beast.dashMul;
      const steps = 12;
      const sx = player.x;
      const sy = player.y;

      let tx = player.x;
      let ty = player.y;
      for (let i = 1; i <= steps; i++) {
        const nx = player.x + ux * distance * (i / steps);
        const ny = player.y + uy * distance * (i / steps);
        if (canStandAt(nx, ny)) { tx = nx; ty = ny; }
      }
      player.x = tx;
      player.y = ty;
      player.dashCooldown = BALANCE.dashBaseCooldown * beast.dashCooldownMul;
      player.dashFlash = beast.level >= 2 ? 0.25 : 0.18;
      if (beast.level >= 2) player.beastFlash = 0.28;
      player.lastDir = { x: ux, y: uy };
      addFxTrail(sx, sy, player.x, player.y, player.layer, "dash", 0.34);
      addFxBurst(sx, sy, player.layer, "dash", 16, 0.32);
      addFxBurst(player.x, player.y, player.layer, "dash", 20, 0.38);
      addFogCloud(sx + ux * 10, sy + uy * 10, player.layer, beast.level >= 2 ? 34 : 26, beast.level >= 2 ? 2.7 : 2.2, beast.level >= 2 ? 0.82 : 0.72);
      addFogCloud((sx + player.x) / 2, (sy + player.y) / 2, player.layer, 22, 1.8, 0.68);
      addFogCloud(player.x, player.y, player.layer, beast.level >= 2 ? 30 : 24, 2.2, 0.72);
      addShake(beast.level >= 2 ? 0.16 : 0.10);
      AudioBus.play("dash");
      createNoise(player.x, player.y, player.layer, beast.level >= 2 ? 148 : 112, beast.level >= 2 ? 5.0 : 3.7, "dash", { supernatural: true });
      exposeToCameras(beast.level >= 2 ? 8 : 5, "Shadow Dash is recorded", player.x, player.y, player.layer);

      const witnessList = visibleWitnessList(130);
      const witnesses = witnessList.length;
      if (witnesses > 0 && !isHiddenPlace()) {
        alarmCivilianWitnesses(witnessList, beast.level >= 2 ? "a monstrous shadow crossing the street" : "an impossible displacement", 9);
        addExposure(5 + witnesses * 2 + (beast.level >= 2 ? 3 : 0), "Shadow Dash seen by witnesses: exposure rises.");
      } else {
        const baseMessage = beast.level >= 2
          ? `Brutal Shadow Dash [+${dashHunger} hunger]: the Beast tears through the mist.`
          : `Shadow Dash [+${dashHunger} hunger]: a veil of mist lingers behind you.`;
        say(`${baseMessage}${hungerWarning}`, hungerWarning ? 3.2 : 1.8);
      }
    }

    function bloodSense() {
      if (player.senseCooldown > 0) {
        say(`Blood Sense is still pulsing: ${player.senseCooldown.toFixed(1)}s.`, 1.3);
        return;
      }
      const senseHunger = powerHungerFor("sense");
      const hungerWarning = addPowerHunger(senseHunger, "Blood Sense");
      player.bloodSenseTimer = 4.8;
      player.senseCooldown = 9.0;
      state.usedBloodSense = true;
      AudioBus.play("sense", 1.0);
      player.beastFlash = Math.max(player.beastFlash, 0.16);
      // No es un ataque, pero si abusas con hunger alta deja una firma sobrenatural leve.
      if (beastStage().level >= 2 && !isHiddenPlace()) {
        createNoise(player.x, player.y, player.layer, 46, 1.4, "whisper", { supernatural: true, exposure: false, life: 0.5 });
      }
      say(`Blood Sense [+${senseHunger} hunger]: journalist, victims, rats, trails, hunters and escape routes glow for a few seconds.${hungerWarning}`, hungerWarning ? 3.8 : 3.2);
    }

    function inputDirection() {
      // Classic top-down movement: WASD/arrows move directly on screen.
      let x = 0;
      let y = 0;
      if (keys["a"] || keys["arrowleft"]) x -= 1;
      if (keys["d"] || keys["arrowright"]) x += 1;
      if (keys["w"] || keys["arrowup"]) y -= 1;
      if (keys["s"] || keys["arrowdown"]) y += 1;
      return { x, y };
    }

    function playerRunSpeed() {
      return player.speed * 1.55 * beastStage().moveMul;
    }

    function enemyRunSpeed(n, seesPlayer = true) {
      // Pursuit should pressure you, not turn into bullet hell.
      // Police are slower than vampire sprint; hunters are dangerous but not glued to you.
      const typeMul = n.type === "hunter" ? BALANCE.hunterChaseSpeedMul : BALANCE.policeChaseSpeedMul;
      const alertMul = exposureLevel() >= 4 ? 1.05 : 1;
      const lostMul = seesPlayer ? 1 : BALANCE.enemyLostSightMul;
      return playerRunSpeed() * typeMul * alertMul * lostMul;
    }

    function enemyJogSpeed(n) {
      // Investigation is purposeful, but not a chase.
      if (n.type !== "police" && n.type !== "hunter") return n.speed;
      return playerRunSpeed() * (n.type === "hunter" ? BALANCE.hunterInvestigationSpeedMul : BALANCE.policeInvestigationSpeedMul);
    }


    function startGame() {
      if (state.gameStarted) return;
      state.gameStarted = true;
      state.showHelp = false;
      AudioBus.unlock();
      AudioBus.play("sense", 0.75);
      if (ui.startOverlay) ui.startOverlay.classList.add("hidden");
      say("Clan order: leave the rooftop refuge, locate the journalist below, eliminate them your way, then get back above the street.", 5.5);
    }

    if (ui.startButton) ui.startButton.addEventListener("click", startGame);

    // ---------------------------------------------------------
    // Game update
    // ---------------------------------------------------------

    function acceptOrderReport() {
      if (!state.orderReportOpen) return;
      state.orderReportOpen = false;
      state.orderReportAccepted = true;
      state.freeRoam = true;
      state.mission = 9;
      say("Report accepted. Free roam unlocked: patrol the district, hunt, escape, or test the systems.", 5);
      // Clear one-shot inputs so accepting the report does not instantly interact with the safehouse door.
      pressed["e"] = false;
      pressed[" "] = false;
      pressed["enter"] = false;
    }

    function update(dt) {
      if (!state.gameStarted) {
        if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) startGame();
        return;
      }
      const simDt = state.cinematic ? dt * BALANCE.cinematicSlowdown : dt;
      state.time += dt;
      if (state.messageTimer > 0) state.messageTimer -= dt;
      if (state.lastAlert && state.lastAlert.timer > 0) state.lastAlert.timer = Math.max(0, state.lastAlert.timer - dt);
      if (state.orderReportOpen) {
        if (consumePressed("enter") || consumePressed("e") || consumePressed(" ")) {
          acceptOrderReport();
        }
        updateEffects(dt);
        updateCinematic(dt);
        updateCamera();
        return;
      }
      if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - simDt);
      if (player.lureCooldown > 0) player.lureCooldown = Math.max(0, player.lureCooldown - simDt);
      if (player.senseCooldown > 0) player.senseCooldown = Math.max(0, player.senseCooldown - simDt);
      if (player.bloodSenseTimer > 0) player.bloodSenseTimer = Math.max(0, player.bloodSenseTimer - simDt);
      if (state.lureHintTimer > 0) state.lureHintTimer = Math.max(0, state.lureHintTimer - simDt);
      if (player.dashFlash > 0) player.dashFlash = Math.max(0, player.dashFlash - dt);
      if (player.beastFlash > 0) player.beastFlash = Math.max(0, player.beastFlash - dt);
      if (state.helpPulse > 0) state.helpPulse = Math.max(0, state.helpPulse - dt);
      if (consumePressed("h")) {
        state.showHelp = false;
        state.helpPulse = 0;
      }

      if (!state.cinematic) {
        if (state.feeding) {
          const dir = inputDirection();
          const triesToMove = Math.hypot(dir.x, dir.y) > 0 || keys["shift"] || pressed["q"] || pressed[" "];
          if (triesToMove) {
            cancelFeeding("You pull away before finishing the feed.");
            // Consume dash input if pressed so it does not fire right after canceling.
            pressed["q"] = false;
            pressed[" "] = false;
          } else {
            if (consumePressed("e")) cancelFeeding("You release the victim before finishing.");
            updateFeeding(simDt);
          }
        } else {
          if (consumePressed("e")) handleAction();
          if (consumePressed("r")) vampiricWhisper();
          if (consumePressed("f")) bloodSense();
          if (consumePressed("q") || consumePressed(" ")) shadowDash();
          updatePlayerMovement(simDt);
        }
      }

      updateDraggedBody(simDt);
      updateHungerAndExposure(simDt);
      updateBeastPressure(simDt);
      updateNoises(simDt);
      AudioBus.update(simDt);
      updateEffects(dt);
      updateCinematic(dt);
      coolLocalHeat(simDt);
      updateLightOutages(simDt);
      updateCameras(simDt);
      updateDynamicEvents(simDt);
      updateBloodStains(simDt);
      updateBloodDiscovery(simDt);
      updateCorpseDiscovery(simDt);
      updateMission();
      updateNPCs(simDt);
      spawnThreats();
      updateHunterRouteBlocking(simDt);
      updateCamera();
    }

    function updatePlayerMovement(dt) {
      const dir = inputDirection();
      const len = Math.hypot(dir.x, dir.y);
      const oldX = player.x;
      const oldY = player.y;

      if (len > 0) {
        dir.x /= len;
        dir.y /= len;
        player.lastDir = { x: dir.x, y: dir.y };
      }

      const sprinting = keys["shift"] && len > 0;
      const sprint = sprinting ? BALANCE.playerSprintMultiplier : 1;
      const dragMul = state.draggingBody ? BALANCE.bodyDragMultiplier : 1;
      const beastMul = state.draggingBody ? 1 : beastStage().moveMul;
      const speed = player.speed * sprint * dragMul * beastMul;

      const nx = player.x + dir.x * speed * dt;
      if (canStandAt(nx, player.y)) player.x = nx;
      const ny = player.y + dir.y * speed * dt;
      if (canStandAt(player.x, ny)) player.y = ny;

      const moved = Math.hypot(player.x - oldX, player.y - oldY) > 0.05;
      state.stepSoundTimer = Math.max(0, state.stepSoundTimer - dt);
      if (moved && !player.inSafehouse && state.stepSoundTimer <= 0) {
        if (state.draggingBody) {
          AudioBus.play("drag", 0.75);
          state.stepSoundTimer = 0.55;
        } else {
          AudioBus.play(sprinting ? "sprintStep" : "footstep", player.layer > LAYER.STREET ? 0.65 : 1.0);
          state.stepSoundTimer = sprinting ? 0.20 : 0.34;
        }
      }
      state.footstepNoiseTimer = Math.max(0, state.footstepNoiseTimer - dt);
      if (moved && sprinting && !player.inSafehouse && player.layer === LAYER.STREET && state.footstepNoiseTimer <= 0) {
        const radius = state.draggingBody ? 76 : 62;
        createNoise(player.x, player.y, player.layer, radius, state.draggingBody ? 2.4 : 1.6, state.draggingBody ? "drag" : "sprint", { exposure: false, life: 0.55 });
        state.footstepNoiseTimer = state.draggingBody ? 0.48 : 0.62;
      }
    }

    function updateHungerAndExposure(dt) {
      // Hunger no longer rises over time: it only rises when using powers.
      // Feeding lowers hunger.
      state.lastBeastLevel = beastStage().level;

      if (player.inSafehouse) {
        player.exposure = Math.max(0, player.exposure - dt * 13);
        state.beastUrge = Math.max(0, state.beastUrge - dt * 1.6);
        return;
      }

      if (player.layer === LAYER.SEWER) {
        player.exposure = Math.max(0, player.exposure - dt * 6);
        state.beastUrge = Math.max(0, state.beastUrge - dt * 0.9);
        return;
      }

      if (player.layer > LAYER.STREET || isHiddenPlace()) {
        player.exposure = Math.max(0, player.exposure - dt * 2.2);
      } else if (player.exposure > 0 && !enemiesSeeingPlayer(180)) {
        player.exposure = Math.max(0, player.exposure - dt * 0.55);
      }

      // High hunger: unstable aura. If witnesses are nearby in public, risk rises.
      if (player.hunger > 82 && publicWitnesses(90) > 0 && !isHiddenPlace()) {
        player.exposure = clamp(player.exposure + dt * (player.hunger >= 95 ? 3.6 : 1.8), 0, 100);
      }
    }

    function updateBeastPressure(dt) {
      const beast = beastStage();
      if (beast.level < 3 || state.feeding || state.draggingBody || player.inSafehouse || player.layer === LAYER.SEWER) {
        state.beastUrge = Math.max(0, state.beastUrge - dt * 1.25);
        return;
      }

      const victim = nearestFeedable();
      if (!victim) {
        state.beastUrge = Math.max(0, state.beastUrge - dt * 0.7);
        return;
      }

      const witnesses = publicWitnesses(130, victim);
      const shadow = getShadowZoneAt(player.x, player.y);
      const urgeSpeed = shadow ? 0.55 : witnesses > 0 ? 1.35 : 0.9;
      state.beastUrge = clamp(state.beastUrge + dt * urgeSpeed, 0, 2.2);

      if (state.beastUrge > 1.05 && state.beastUrge < 1.15) {
        say("The Beast pushes: move away, hide, or press E before you lose control.", 2.6);
      }

      if (state.beastUrge >= 2.0) {
        state.beastUrge = 0;
        player.beastFlash = 0.45;
        addExposure(witnesses > 0 ? 5 : 0, witnesses > 0 ? "You lunge too animal-like in front of witnesses." : "The Beast takes the first impulse.");
        startFeeding(victim);
      }
    }

    function updateCorpseDiscovery(dt) {
      // Visible bodies: if a civilian/police/hunter sees them, exposure rises once.
      for (const body of npcs) {
        if (!body.dead || body.corpseDiscovered || body.hiddenBody) continue;
        if (body.layer !== LAYER.STREET) continue;
        // In shadow it can still be discovered, but it is harder because canSeeEntity reduces range.
        for (const watcher of npcs) {
          if (watcher === body || watcher.dead || watcher.hiddenBody || watcher.stunned) continue;
          if (!["civilian", "target", "police", "hunter"].includes(watcher.type)) continue;
          if (watcher.hidden && !watcher.revealed) continue;
          if (canSeeEntity(watcher, body, { range: watcher.type === "civilian" ? 115 : 165, cosLimit: 0.25 })) {
            body.corpseDiscovered = true;
            state.stats.bodiesDiscovered++;
            if (watcher.type === "civilian" || watcher.type === "target") {
              alarmWitness(watcher, "an abandoned body", 18);
              addExposure(3, "A civilian discovers a body and runs to report it.");
            } else {
              const gain = watcher.type === "police" ? 18 : watcher.type === "hunter" ? 22 : 12;
              addExposure(gain, "A visible body has been discovered. Exposure rises.");
            }
            break;
          }
        }
      }
    }

    function updateMission() {
      const club = interactables.find(i => i.id === "clubDoor");
      const target = targetNpc();

      if (state.mission === 1 && !player.inSafehouse) {
        state.mission = 2;
        say("Step 1: descend from the rooftop and reach the pink-lit nightclub by the east avenue.", 4);
      }

      if (state.mission === 2 && club && Math.hypot(player.x - club.x, player.y - club.y) < 115 && player.layer === LAYER.STREET) {
        state.mission = 3;
        markTutorial("sense", "Soft tutorial: press F for Blood Sense. It marks the journalist, routes and dangerous evidence.", 4.5);
      }

      if (state.mission === 3 && state.usedBloodSense) {
        state.mission = 4;
        say("Good. Pink marks the journalist. Move near them and press R to whisper from shadow.", 4);
      }

      if (state.mission === 4 && state.targetLured) {
        state.mission = 5;
        say("The journalist is following. Walk them into the club side shadow, then press E to eliminate.", 4);
      }

      if (state.mission === 5 && state.targetFed) {
        state.mission = 6;
        say(targetBodyVisible()
          ? "The journalist's body is visible. Press E to drag it, then hide it in shadow, sewer or safehouse."
          : "Journalist eliminated. Break sight and return to the safehouse.", 4);
      }

      if (state.mission === 6) {
        const noWitnessRunning = activeAlarmedWitnesses().length === 0;
        const safeEnough = noWitnessRunning && (targetBodyHidden() || !targetBodyVisible() || player.layer === LAYER.SEWER || player.layer > LAYER.STREET || player.inSafehouse);
        if (safeEnough) {
          state.mission = 7;
          say("Clean enough. Return to the safehouse. Rooftops and sewers are your safest routes.", 4);
        }
      }

      if (state.mission === 7 && player.inSafehouse && activeAlarmedWitnesses().length === 0) {
        state.mission = 8;
        state.missionDone = true;
        state.orderReportOpen = true;
        state.orderReportAccepted = false;
        state.freeRoam = false;
        AudioBus.play("missionComplete", 1.1);
        say("ORDER COMPLETE: the leak is contained. Accept the clan report to resume free roam.", 8);
      }
    }

    // ---------------------------------------------------------
    // 10. AI
    // ---------------------------------------------------------

    function updateNPCs(dt) {
      for (const n of npcs) {
        if (n.eventNpc && n.tempLife > 0 && !n.dead && !n.alarmed && n.fleeTimer <= 0 && n.luredTimer <= 0) {
          n.tempLife -= dt;
        }
        if (n.dead) continue;

        const level = exposureLevel();
        if (n.type === "police" && level >= 2) n.active = true;
        if (n.type === "hunter" && level >= 4 && !n.hidden) n.active = true;
        if (n.type === "hunter" && n.hidden) maybeRevealHunter(n, level);

        if (n.type === "civilian" || n.type === "target") {
          updateCivilian(n, dt);
        } else {
          updateEnemy(n, dt);
        }
      }
      cleanupExpiredEventNPCs();
    }

    function cleanupExpiredEventNPCs() {
      for (let i = npcs.length - 1; i >= 0; i--) {
        const n = npcs[i];
        if (!n.eventNpc || n.dead || n.hiddenBody) continue;
        if (n.tempLife <= 0 && !n.alarmed && n.fleeTimer <= 0 && n.luredTimer <= 0 && !n.investigatingNoise && !n.investigatingBlood) {
          npcs.splice(i, 1);
        }
      }
    }

    function maybeRevealHunter(n, level) {
      if (!n.hidden || n.revealed || player.inSafehouse || player.layer !== LAYER.STREET) return;
      if (level < 4) return;
      const d = Math.hypot(n.x - player.x, n.y - player.y);
      const triggeredByExposure = level >= 4 && d < 190;
      const triggeredByMessyHunt = state.targetFed && player.exposure >= 80 && d < 150;
      const triggeredByDash = player.dashFlash > 0 && d < 120;
      const triggeredByBeast = beastStage().level >= 3 && d < 155 && publicWitnesses(110) > 0;
      const nearbyBlood = state.bloodStains.find(s => !s.cleaned && s.layer === LAYER.STREET && Math.hypot(s.x - n.x, s.y - n.y) < (s.brutal ? 230 : 145));
      const triggeredByBlood = Boolean(nearbyBlood && (nearbyBlood.brutal || nearbyBlood.discovered || nearbyBlood.age < 18));
      if (triggeredByExposure || triggeredByMessyHunt || triggeredByDash || triggeredByBeast || triggeredByBlood) {
        n.hidden = false;
        n.revealed = true;
        state.stats.huntersRevealed++;
        AudioBus.play("hunterReveal", 0.95);
        n.active = true;
        n.chaseTimer = 2.2;
        if (nearbyBlood) setBloodInvestigation(n, nearbyBlood, 6.0);
        else { n.lastKnown.x = player.x; n.lastKnown.y = player.y; }
        say(nearbyBlood ? "A hunter steps out of a dark corner, following the smell of blood." : "A hunter steps out of a dark corner. It was not in the player’s mental map.", 3.2);
      }
    }

    function updateCivilian(n, dt) {
      if (n.stunned) {
        n.vx = 0; n.vy = 0;
        if (n.waitTimer > 0) {
          n.waitTimer -= dt;
          if (n.waitTimer <= 0) n.stunned = false;
        }
        return;
      }
      if (n.hostileTimer > 0) {
        n.hostileTimer -= dt;
        n.shoveCooldown = Math.max(0, (n.shoveCooldown || 0) - dt);
        const ax = player.x - n.x;
        const ay = player.y - n.y;
        const len = Math.hypot(ax, ay) || 1;
        moveEntity(n, (ax / len) * n.speed * 2.05, (ay / len) * n.speed * 2.05, dt);
        if (len < 16 && n.shoveCooldown <= 0) {
          n.shoveCooldown = 1.6;
          const bx = player.x - n.x;
          const by = player.y - n.y;
          const blen = Math.hypot(bx, by) || 1;
          const px = player.x + (bx / blen) * 18;
          const py = player.y + (by / blen) * 18;
          if (canStandAt(px, py)) { player.x = px; player.y = py; }
          addExposure(2, "A pedestrian shoves you in the street.");
          say("A pedestrian shoves you back. This street is awake now.", 1.8);
        }
        return;
      }
      if (updateAlarmedWitness(n, dt)) return;
      if (n.fleeTimer > 0) n.fleeTimer -= dt;
      const scared = exposureLevel() >= 1 && n.layer === player.layer && Math.hypot(n.x - player.x, n.y - player.y) < 130;
      if (scared) n.fleeTimer = Math.max(n.fleeTimer, 2.2);
      const localHeat = heatValue(currentLocalZoneAt(n.x, n.y, n.layer).id);
      if (localHeat > 55 && n.layer === LAYER.STREET) {
        n.suspiciousTimer = Math.max(n.suspiciousTimer || 0, 1.2);
        if (localHeat > 78 && Math.random() < dt * 0.18) n.fleeTimer = Math.max(n.fleeTimer, 1.6);
      }
      if (n.suspiciousTimer > 0) n.suspiciousTimer -= dt;

      if (n.luredTimer <= 0 && n.fleeTimer <= 0 && updateBloodInvestigation(n, dt)) return;
      if (n.luredTimer <= 0 && n.fleeTimer <= 0 && updateNoiseInvestigation(n, dt)) return;

      if (n.luredTimer > 0) {
        n.luredTimer -= dt;
        const desired = 18;
        const ax = player.x - n.x;
        const ay = player.y - n.y;
        const len = Math.hypot(ax, ay) || 1;
        if (len > desired) {
          const lureSpeed = n.type === "target" ? 18 : 14;
          moveEntity(n, (ax / len) * lureSpeed, (ay / len) * lureSpeed, dt);
        } else {
          n.dirX = player.lastDir.x || n.dirX;
          n.dirY = player.lastDir.y || n.dirY;
        }
        return;
      }

      // Cuando un civil huye debe notarse, pero no parecer un fantasma de Pac-Man.
      if (n.fleeTimer > 0) {
        const ax = n.x - player.x;
        const ay = n.y - player.y;
        const len = Math.hypot(ax, ay) || 1;
        moveEntity(n, (ax / len) * n.speed * 1.45, (ay / len) * n.speed * 1.45, dt);
        return;
      }

      // People leaning on walls/corners: almost still, but they turn their gaze.
      if (n.behavior === "loiter") {
        n.aiTimer -= dt;
        if (n.aiTimer <= 0) {
          n.aiTimer = 1.2 + Math.random() * 2.4;
          if (Math.random() < 0.35) {
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            n.dirX = d[0];
            n.dirY = d[1];
          }
        }
        n.vx = 0;
        n.vy = 0;
        return;
      }

      // Peatones: caminar, pararse, mirar alrededor. La ciudad debe sentirse viva, no arcade.
      if (n.waitTimer > 0) {
        n.waitTimer -= dt;
        n.vx = 0;
        n.vy = 0;
        return;
      }

      n.aiTimer -= dt;
      if (n.aiTimer <= 0) {
        const isTarget = n.type === "target";
        const pauseChance = isTarget ? 0.72 : 0.52;

        if (Math.random() < pauseChance) {
          n.waitTimer = 0.7 + Math.random() * 2.1;
          n.aiTimer = n.waitTimer;
          n.vx = 0;
          n.vy = 0;
          return;
        }

        n.aiTimer = 1.4 + Math.random() * 3.4;
        const ang = Math.random() * Math.PI * 2;
        const wander = isTarget ? 0.35 : 0.62;
        n.vx = Math.cos(ang) * n.speed * wander;
        n.vy = Math.sin(ang) * n.speed * wander;
      }

      const beforeX = n.x;
      const beforeY = n.y;
      moveEntity(n, n.vx, n.vy, dt);

      // If a pedestrian gets stuck pushing a wall, they change intention soon.
      if (Math.abs(n.x - beforeX) + Math.abs(n.y - beforeY) < 0.01 && Math.hypot(n.vx, n.vy) > 0.01) {
        n.aiTimer = Math.min(n.aiTimer, 0.25);
      }
    }

    function updatePatrolMovement(n, dt) {
      if (n.hidden && !n.revealed) return;
      if (n.behavior === "patrol" && n.patrol && n.patrol.length) {
        const p = n.patrol[n.patrolIndex % n.patrol.length];
        const ax = p.x - n.x;
        const ay = p.y - n.y;
        const len = Math.hypot(ax, ay) || 1;
        if (len < 8) {
          n.patrolIndex = (n.patrolIndex + 1) % n.patrol.length;
          n.waitTimer = 0.25 + Math.random() * 0.65;
        }
        if (n.waitTimer > 0) {
          n.waitTimer -= dt;
          return;
        }
        moveEntity(n, (ax / len) * n.speed * 0.62, (ay / len) * n.speed * 0.62, dt);
        return;
      }

      n.aiTimer -= dt;
      if (n.aiTimer <= 0) {
        n.aiTimer = 1.2 + Math.random() * 2;
        const ang = Math.random() * Math.PI * 2;
        n.vx = Math.cos(ang) * n.speed * 0.22;
        n.vy = Math.sin(ang) * n.speed * 0.22;
      }
      moveEntity(n, n.vx, n.vy, dt);
    }

    function updateEnemy(n, dt) {
      if (n.hidden && !n.revealed) return;
      if (!n.active) {
        if (updateBloodInvestigation(n, dt)) return;
        if (updateNoiseInvestigation(n, dt)) return;
        updatePatrolMovement(n, dt);
        return;
      }

      if (player.inSafehouse || player.layer === LAYER.SEWER || player.layer > LAYER.STREET) {
        // No siguen a capas seguras/verticales en este prototipo.
        n.chaseTimer = Math.max(0, n.chaseTimer - dt * 2.5);
        n.aiTimer -= dt;
        if (n.aiTimer <= 0) {
          n.aiTimer = 1.5;
          const ang = Math.random() * Math.PI * 2;
          n.vx = Math.cos(ang) * n.speed * 0.25;
          n.vy = Math.sin(ang) * n.speed * 0.25;
        }
        moveEntity(n, n.vx, n.vy, dt);
        return;
      }

      const requiredLevel = n.type === "hunter" ? 3 : 2;
      if (n.layer !== player.layer) return;
      if (exposureLevel() < requiredLevel) {
        if (updateBloodInvestigation(n, dt)) return;
        if (updateNoiseInvestigation(n, dt)) return;
        return;
      }

      const seesPlayer = canSeeEntity(n, player, { range: n.type === "hunter" ? 210 : 185, cosLimit: n.chaseTimer > 0 ? 0.05 : 0.25 });
      if (n.type === "hunter" && updateHunterBlock(n, dt, seesPlayer)) return;
      if (seesPlayer) {
        n.lastKnown.x = player.x;
        n.lastKnown.y = player.y;
        n.chaseTimer = n.type === "hunter" ? 3.2 : 2.4;
      } else {
        n.chaseTimer = Math.max(0, n.chaseTimer - dt);
      }

      if (n.chaseTimer > 0) {
        const ax = n.lastKnown.x - n.x;
        const ay = n.lastKnown.y - n.y;
        const len = Math.hypot(ax, ay) || 1;
        const runSpeed = enemyRunSpeed(n, seesPlayer);
        moveEntity(n, (ax / len) * runSpeed, (ay / len) * runSpeed, dt);

        if (Math.hypot(n.x - n.lastKnown.x, n.y - n.lastKnown.y) < 12 && !seesPlayer) {
          n.chaseTimer = 0;
        }
      } else {
        if (updateBloodInvestigation(n, dt)) return;
        if (updateNoiseInvestigation(n, dt)) return;
        n.aiTimer -= dt;
        if (n.aiTimer <= 0) {
          n.aiTimer = 1.1 + Math.random() * 1.6;
          const ang = Math.random() * Math.PI * 2;
          n.vx = Math.cos(ang) * n.speed * 0.35;
          n.vy = Math.sin(ang) * n.speed * 0.35;
        }
        moveEntity(n, n.vx, n.vy, dt);
      }

      if (seesPlayer && Math.hypot(n.x - player.x, n.y - player.y) < 15) {
        addExposure(n.type === "hunter" ? 8 : 5, n.type === "hunter" ? "A hunter almost pins you down." : "Police cut you off.");
        const bx = player.x - n.x;
        const by = player.y - n.y;
        const blen = Math.hypot(bx, by) || 1;
        const px = player.x + (bx / blen) * 24;
        const py = player.y + (by / blen) * 24;
        if (canStandAt(px, py)) { player.x = px; player.y = py; }
      }
    }

    function updateHunterRouteBlocking(dt) {
      const level = exposureLevel();
      if (level < BALANCE.hunterRouteBlockMinLevel || player.inSafehouse || player.layer !== LAYER.STREET) return;
      if (state.time < state.nextRouteBlockAt) return;
      state.nextRouteBlockAt = state.time + (level >= 4 ? 6.0 : 8.0);

      const candidates = npcs.filter(n =>
        n.type === "hunter" && !n.dead && !n.hidden && n.revealed && n.active &&
        n.layer === LAYER.STREET && n.chaseTimer <= 0.6 &&
        !n.investigatingNoise && !n.investigatingBlood
      );
      if (!candidates.length) return;

      const occupied = new Set(npcs.filter(n => n.type === "hunter" && n.blockingRoute).map(n => n.blockingRoute.id));
      const options = hunterBlockPoints
        .filter(p => !occupied.has(p.id))
        .map(p => {
          const z = currentLocalZoneAt(p.x, p.y, p.layer);
          const heatBias = heatValue(z.id) * 0.35;
          return { p, score: Math.hypot(p.x - player.x, p.y - player.y) - heatBias + Math.random() * 35 };
        })
        .sort((a, b) => a.score - b.score);
      if (!options.length) return;

      const hunter = candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
      hunter.blockingRoute = options[0].p;
      hunter.blockTimer = 7.5 + level;
      hunter.lastKnown.x = hunter.blockingRoute.x;
      hunter.lastKnown.y = hunter.blockingRoute.y;
      if (state.time - state.lastNoiseMessageAt > 1.0) {
        state.lastNoiseMessageAt = state.time;
        say(`A hunter does not run straight at you: it tries to cut off ${hunter.blockingRoute.name}.`, 3);
      }
    }

    function updateHunterBlock(n, dt, seesPlayer) {
      if (n.type !== "hunter" || !n.blockingRoute || n.blockTimer <= 0) {
        if (n.type === "hunter") { n.blockingRoute = null; n.blockTimer = 0; }
        return false;
      }
      if (seesPlayer) {
        n.blockingRoute = null;
        n.blockTimer = 0;
        return false;
      }
      n.blockTimer -= dt;
      const p = n.blockingRoute;
      const ax = p.x - n.x;
      const ay = p.y - n.y;
      const len = Math.hypot(ax, ay) || 1;
      if (len > 9) {
        const blockSpeed = enemyRunSpeed(n, false) * 0.92;
        moveEntity(n, (ax / len) * blockSpeed, (ay / len) * blockSpeed, dt);
      } else {
        const px = player.x - n.x;
        const py = player.y - n.y;
        const plen = Math.hypot(px, py) || 1;
        n.dirX = px / plen;
        n.dirY = py / plen;
        if (Math.hypot(player.x - p.x, player.y - p.y) < 72 && hasLineOfSight(n, player)) {
          n.lastKnown.x = player.x;
          n.lastKnown.y = player.y;
          n.chaseTimer = 3.0;
          n.blockingRoute = null;
          n.blockTimer = 0;
          addExposure(5, `A hunter was waiting near ${p.name}.`);
          return false;
        }
      }
      if (n.blockTimer <= 0) {
        n.blockingRoute = null;
        n.blockTimer = 0;
      }
      return true;
    }

    function spawnThreats() {
      const level = exposureLevel();
      if (level < 2) return;

      // Keep pursuit tense but readable. The prototype should not become a bullet hell.
      const hot = hottestZone();
      const heatBonus = hot && hot.heat > 70 ? 1 : 0;
      const desiredPolice = Math.min(BALANCE.maxPolice, level + heatBonus);
      while (npcs.filter(n => n.type === "police" && !n.dead).length < desiredPolice) {
        const spawn = { x: 780 + (Math.random() - 0.5) * 36, y: 178 + (Math.random() - 0.5) * 28 };
        const cop = makeNpc("police", spawn.x, spawn.y);
        cop.active = true;
        npcs.push(cop);
      }

      if (level >= 4) {
        const desiredHunters = Math.min(BALANCE.maxHunters, Math.max(1, level - 3));
        while (npcs.filter(n => n.type === "hunter" && !n.dead && !n.hidden).length < desiredHunters) {
          const spawn = { x: 742 + (Math.random() - 0.5) * 58, y: 474 + (Math.random() - 0.5) * 48 };
          const hunter = makeNpc("hunter", spawn.x, spawn.y);
          hunter.active = true;
          npcs.push(hunter);
        }
      }
    }

    function edgeSpawn() {
      const spots = [
        { x: 28, y: 335 }, { x: 930, y: 335 }, { x: 520, y: 610 }, { x: 270, y: 30 }, { x: 850, y: 540 }
      ];
      return spots[Math.floor(Math.random() * spots.length)];
    }

    function updateCamera() {
      const shakeX = state.shake > 0 ? Math.round((Math.random() * 2 - 1) * state.shake * 10) : 0;
      const shakeY = state.shake > 0 ? Math.round((Math.random() * 2 - 1) * state.shake * 8) : 0;
      camera.x = clamp(player.x - VIEW_W / 2 + shakeX, 0, WORLD_W - VIEW_W);
      camera.y = clamp(player.y - VIEW_H / 2 + shakeY, 0, WORLD_H - VIEW_H);
    }

    // ---------------------------------------------------------
    // 11. RENDERING
    // ---------------------------------------------------------

    function render() {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.save();
      let cinematicLift = 0;
      if (state.cinematic) {
        const c = state.cinematic;
        const p = 1 - c.time / c.duration;
        const airP = p < c.anticipation ? 0 : p < c.landAt ? (p - c.anticipation) / Math.max(0.001, c.landAt - c.anticipation) : 0;
        const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, airP)));
        cinematicLift = arc * c.lift;
      }
      ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y - cinematicLift));

      if (player.layer === LAYER.SEWER) drawSewers();
      else drawStreetAndBuildings();

      if (player.layer > LAYER.STREET) drawRooftopLayer();
      drawBloodStains();
      drawInteractables();
      drawNoisePulses();
      drawTraversalEffects();
      drawVisionCones();
      drawBloodSenseOverlay();
      drawNPCs();
      drawPlayer();
      drawFogClouds();
      drawFeedingProgress();
      drawReadabilityMarkers();

      ctx.restore();
      if (state.cinematic) {
        const c = state.cinematic;
        const p = 1 - c.time / c.duration;
        const arc = Math.sin(Math.PI * p);
        ctx.fillStyle = `rgba(0,0,0,${0.04 + arc * 0.10})`;
        ctx.fillRect(0, 0, VIEW_W, 10 + arc * 22);
        ctx.fillRect(0, VIEW_H - (10 + arc * 22), VIEW_W, 10 + arc * 22);
      }
      drawBeastOverlay();
      // Legacy canvas help removed. DOM help is handled by js/help-overlay.js.
      drawMissionSummaryOverlay();
    }

    function drawStreetAndBuildings() {
      // Base nocturna, a bit brighter so shadow pockets read more clearly.
      ctx.fillStyle = "#1a1d2b";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // Two main avenues crossing, plus service alleys.
      drawRoad(0, 292, WORLD_W, 92);
      drawRoad(426, 0, 92, WORLD_H);
      drawRoad(90, 502, 790, 44);
      drawRoad(246, 244, 474, 44);
      drawRoad(96, 382, 198, 44);

      // Alleys are already drawn as roads and dark zones.

      drawShadowZones();
      drawLightSystem();
      drawReportPoints();
      drawLocalHeatZones();

      // Luces de club y hospital.
      pulseRect(378, 384, 188, 10, "#c81aff", "#6220a0");
      pulseRect(620, 396, 164, 8, "#ff3b50", "#6c1c2a");
      pulseRect(700, 210, 172, 6, "#4da3ff", "#1e4e80");

      for (const b of buildings) drawBuilding(b);

      // If the player is on rooftops, the street is dimmed below.
      if (player.layer > LAYER.STREET) {
        ctx.fillStyle = "rgba(0,0,0,.48)";
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }
    }

    function drawShadowZones() {
      for (const z of hiddenZones) {
        const active = pointInRect(player.x, player.y, z);
        ctx.fillStyle = active ? "rgba(24, 10, 42, .60)" : "rgba(13, 10, 24, .34)";
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = active ? "rgba(215,200,255,.30)" : "rgba(215,200,255,.16)";
        ctx.fillRect(z.x, z.y, z.w, 2);
        ctx.fillRect(z.x, z.y + z.h - 2, z.w, 2);
        ctx.fillRect(z.x, z.y, 2, z.h);
        ctx.fillRect(z.x + z.w - 2, z.y, 2, z.h);
        if (active || Math.hypot(player.x - (z.x + z.w / 2), player.y - (z.y + z.h / 2)) < 88) {
          ctx.font = "8px monospace";
          ctx.fillStyle = active ? "rgba(245,236,255,.72)" : "rgba(215,200,255,.40)";
          ctx.fillText("SHADOW", Math.floor(z.x + 6), Math.floor(z.y + 11));
        }
      }
    }

    function drawLightSystem() {
      for (const l of lightPosts) {
        const nearPlayer = player.layer === LAYER.STREET && !player.inSafehouse && Math.hypot(player.x - l.x, player.y - l.y) < 54;

        if (l.broken) {
          const r = l.radius * 0.72;
          ctx.beginPath();
          ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,.42)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(167,92,255,.16)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = "#302734";
          ctx.fillRect(Math.floor(l.x - 2), Math.floor(l.y - 13), 4, 15);
          ctx.fillStyle = "#ff3b50";
          ctx.fillRect(Math.floor(l.x - 5), Math.floor(l.y - 16), 10, 2);
          ctx.fillRect(Math.floor(l.x - 3), Math.floor(l.y - 18), 6, 1);
          ctx.fillStyle = "#120c18";
          ctx.fillRect(Math.floor(l.x - 5), Math.floor(l.y - 12), 10, 1);
        } else if (l.outageTimer) {
          const r = l.radius * 0.68;
          ctx.beginPath();
          ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,.28)";
          ctx.fill();

          if (Math.sin(state.time * 16) > 0.25) {
            ctx.beginPath();
            ctx.arc(l.x, l.y, 19, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,242,168,.15)";
            ctx.fill();
          }

          ctx.fillStyle = "#514e42";
          ctx.fillRect(Math.floor(l.x - 2), Math.floor(l.y - 14), 4, 16);
          ctx.fillStyle = "#a68b54";
          ctx.fillRect(Math.floor(l.x - 5), Math.floor(l.y - 18), 10, 3);
        } else {
          ctx.beginPath();
          ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 220, 116, .090)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 220, 116, .22)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(l.x, l.y, 22, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 220, 116, .24)";
          ctx.fill();

          ctx.fillStyle = "#e5d079";
          ctx.fillRect(Math.floor(l.x - 2), Math.floor(l.y - 14), 4, 16);
          ctx.fillStyle = "#fff2a8";
          ctx.fillRect(Math.floor(l.x - 5), Math.floor(l.y - 18), 10, 3);
          ctx.fillStyle = "#fff7c8";
          ctx.fillRect(Math.floor(l.x - 2), Math.floor(l.y - 20), 4, 2);
        }

        // Small readable base/icon so the post itself is visible over the street.
        ctx.fillStyle = l.broken ? "#5d2535" : "#ffe16b";
        ctx.fillRect(Math.floor(l.x - 3), Math.floor(l.y - 2), 6, 2);
        ctx.fillRect(Math.floor(l.x - 1), Math.floor(l.y - 5), 2, 6);

        if (nearPlayer && !l.broken) {
          ctx.font = "9px monospace";
          ctx.fillStyle = "rgba(0,0,0,.72)";
          ctx.fillRect(Math.floor(l.x - 28), Math.floor(l.y - 34), 56, 11);
          ctx.fillStyle = "#ffe16b";
          ctx.fillText("E BREAK LAMP", Math.floor(l.x - 26), Math.floor(l.y - 26));
        }
      }
    }

    function drawReportPoints() {
      for (const p of reportPoints) {
        ctx.fillStyle = p.id === "policeDoor" ? "#4da3ff" : "#ffb02e";
        ctx.fillRect(Math.floor(p.x - 3), Math.floor(p.y - 3), 6, 6);
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(Math.floor(p.x - 6), Math.floor(p.y - 6), 12, 1);
        ctx.fillRect(Math.floor(p.x - 6), Math.floor(p.y + 6), 12, 1);
      }
    }

    function drawLocalHeatZones() {
      if (player.layer !== LAYER.STREET || player.inSafehouse) return;
      for (const z of localZones) {
        if (z.layer) continue;
        const h = heatValue(z.id);
        if (h < 14) continue;
        const alpha = clamp(h / 100, 0.10, 0.34);
        ctx.fillStyle = `rgba(223,47,98,${alpha * 0.28})`;
        ctx.fillRect(Math.floor(z.x), Math.floor(z.y), Math.floor(z.w), Math.floor(z.h));
        ctx.fillStyle = h >= 70 ? "rgba(255,47,98,.45)" : h >= 45 ? "rgba(255,176,46,.36)" : "rgba(255,176,46,.18)";
        ctx.fillRect(Math.floor(z.x), Math.floor(z.y), Math.floor(z.w), 2);
        if (h >= 45) {
          ctx.fillStyle = h >= 70 ? "#ff2f62" : "#ffb02e";
          ctx.font = "8px monospace";
          ctx.fillText(h >= 70 ? "HOT ZONE" : "local suspicion", Math.floor(z.x + 6), Math.floor(z.y + 11));
        }
      }
    }

    function drawCameras() {
      // Removed: no fixed surveillance cameras in the prototype.
    }

    function drawRoad(x, y, w, h) {
      ctx.fillStyle = "#25293b";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#34384d";
      for (let i = x; i < x + w; i += 32) ctx.fillRect(i, y + Math.floor(h / 2), 16, 2);
      ctx.fillStyle = "#171924";
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);
    }

    function pulseRect(x, y, w, h, c1, c2) {
      ctx.fillStyle = Math.sin(state.time * 5) > 0 ? c1 : c2;
      ctx.fillRect(x, y, w, h);
    }

    function drawBuilding(b) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.trim;
      ctx.fillRect(b.x, b.y, b.w, 4);
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
      ctx.fillRect(b.x, b.y, 4, b.h);
      ctx.fillRect(b.x + b.w - 4, b.y, 4, b.h);

      // Small roof/window details.
      ctx.fillStyle = "rgba(255,255,255,.08)";
      for (let xx = b.x + 14; xx < b.x + b.w - 14; xx += 26) {
        for (let yy = b.y + 18; yy < b.y + b.h - 14; yy += 24) {
          ctx.fillRect(xx, yy, 8, 5);
        }
      }

      ctx.fillStyle = "#efe6ff";
      ctx.font = "8px monospace";
      ctx.fillText(b.sign, b.x + 9, b.y + 15);
    }

    function drawRooftopLayer() {
      const low = roofAreas[LAYER.ROOF_LOW];
      const high = roofAreas[LAYER.ROOF_HIGH];

      if (player.layer === LAYER.ROOF_LOW) {
        for (const r of low) drawRoof(r, false);
        for (const r of high) drawRoof(r, true);
      } else if (player.layer === LAYER.ROOF_HIGH) {
        for (const r of low) drawRoof(r, true);
        for (const r of high) drawRoof(r, false);
      }
    }

    function drawRoof(r, dim) {
      ctx.fillStyle = dim ? "rgba(70,72,96,.35)" : r.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = dim ? "rgba(220,220,255,.25)" : "#c7c5df";
      ctx.fillRect(r.x, r.y, r.w, 3);
      ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3);
      ctx.fillRect(r.x, r.y, 3, r.h);
      ctx.fillRect(r.x + r.w - 3, r.y, 3, r.h);
      ctx.fillStyle = dim ? "rgba(0,0,0,.25)" : "#1f2030";
      ctx.fillRect(r.x + 16, r.y + 16, 24, 18);
      ctx.fillRect(r.x + r.w - 44, r.y + 22, 18, 26);
      ctx.fillStyle = dim ? "rgba(255,255,255,.22)" : "#f1e6ff";
      ctx.font = "8px monospace";
      ctx.fillText(dim ? "another height" : "ROOF", r.x + 8, r.y + 12);
    }

    function drawSewers() {
      ctx.fillStyle = "#06100d";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = "#0b2a22";
      for (const t of sewerTunnels) ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.fillStyle = "#15483b";
      for (const t of sewerTunnels) {
        ctx.fillRect(t.x, t.y, t.w, 3);
        ctx.fillRect(t.x, t.y + t.h - 3, t.w, 3);
      }
      ctx.fillStyle = "#173329";
      for (let x = 0; x < WORLD_W; x += 32) {
        for (let y = 0; y < WORLD_H; y += 32) {
          ctx.fillRect(x, y, 1, 12);
        }
      }
      ctx.fillStyle = "#78c7a3";
      ctx.font = "8px monospace";
      ctx.fillText("SEWERS - escape route", 500, 300);
    }

    function drawBloodStains() {
      for (const stain of state.bloodStains) {
        if (stain.layer !== player.layer || stain.cleaned) continue;
        // On rooftops and sewers they are dimmer to avoid cluttering readability.
        const ageFade = clamp(stain.life / 70, 0.25, 1);
        const alpha = stain.brutal ? 0.72 * ageFade : 0.48 * ageFade;
        ctx.fillStyle = stain.brutal ? `rgba(179,25,52,${alpha})` : `rgba(91,17,31,${alpha})`;
        const sx = Math.floor(stain.x);
        const sy = Math.floor(stain.y);
        const sz = Math.max(2, Math.floor(stain.size));
        ctx.fillRect(sx - Math.floor(sz / 2), sy - 1, sz, 2);
        ctx.fillRect(sx - 1, sy - Math.floor(sz / 2), 2, sz);
        if (stain.kind === "drag") {
          ctx.fillStyle = stain.brutal ? "rgba(255,47,98,.30)" : "rgba(179,25,52,.22)";
          ctx.fillRect(sx - 4, sy + 2, 8, 1);
        }
        if (stain.discovered) {
          ctx.fillStyle = "#ffb02e";
          ctx.fillRect(sx - 1, sy - 10, 2, 5);
        } else if (stain.hunted) {
          ctx.fillStyle = "#ff9d35";
          ctx.fillRect(sx - 2, sy - 9, 4, 2);
        }
      }
    }

    function drawBodyHideSpots() {
      if (player.layer !== LAYER.STREET || player.inSafehouse) return;

      // Hide spots should only appear when the player actually has evidence to hide.
      // Otherwise they read as generic interactables and add noise to exploration.
      const hasBodyToHide = Boolean(state.draggingBody) || npcs.some(n => n.dead && !n.hiddenBody && n.layer === player.layer);
      if (!hasBodyToHide) return;

      for (const s of bodyHideSpots) {
        if (s.layer !== player.layer) continue;
        const near = Math.hypot(player.x - s.x, player.y - s.y) < s.r;
        const alpha = near ? 0.30 : 0.11;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = near ? "rgba(120,199,163,.72)" : `rgba(120,199,163,${alpha})`;
        ctx.lineWidth = near ? 2 : 1;
        ctx.stroke();
        ctx.fillStyle = near ? "rgba(120,199,163,.20)" : `rgba(120,199,163,${alpha * 0.28})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.floor(s.x - 5), Math.floor(s.y - 3), 10, 6);
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(Math.floor(s.x - 3), Math.floor(s.y - 1), 6, 2);
        if (near) {
          ctx.font = "8px monospace";
          ctx.fillStyle = "#d7ffec";
          ctx.fillText("HIDE", Math.floor(s.x + 8), Math.floor(s.y - 8));
        }
      }
    }

    function drawInteractables() {
      drawBodyHideSpots();
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        const near = Math.hypot(it.x - player.x, it.y - player.y) < it.r;
        ctx.fillStyle = near ? "#fff2a8" : "#8e7fb8";
        ctx.fillRect(it.x - 4, it.y - 4, 8, 8);
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        ctx.strokeStyle = near ? "rgba(255,242,168,.25)" : "rgba(142,127,184,.13)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Explicit fire-escape drawing.
      if (player.layer === LAYER.STREET) {
        ctx.fillStyle = "#b8b2c8";
        for (let i = 0; i < 6; i++) ctx.fillRect(338 + i * 3, 280 + i * 2, 16, 1);
      }
    }

    function drawNoisePulses() {
      for (const n of state.noises) {
        if (n.layer !== player.layer) continue;
        const pct = clamp(n.life / n.maxLife, 0, 1);
        const r = Math.floor((1 - pct) * Math.min(n.radius, 130));
        const alpha = 0.06 + pct * 0.22;
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(2, r), 0, Math.PI * 2);
        ctx.strokeStyle = n.supernatural ? `rgba(167,92,255,${alpha})` : `rgba(255,176,46,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(2, r * 0.42), 0, Math.PI * 2);
        ctx.strokeStyle = n.supernatural ? `rgba(220,200,255,${alpha * 0.72})` : `rgba(255,226,155,${alpha * 0.62})`;
        ctx.stroke();
        if (pct > 0.45) {
          ctx.fillStyle = n.supernatural ? "#a75cff" : "#ffb02e";
          ctx.font = "8px monospace";
          ctx.fillText("noise", Math.floor(n.x + 7), Math.floor(n.y - 8));
        }
      }
    }

    function drawTraversalEffects() {
      for (const t of state.fxTrails) {
        if (t.layer !== player.layer) continue;
        const pct = clamp(t.life / t.maxLife, 0, 1);
        const dx = t.x2 - t.x1;
        const dy = t.y2 - t.y1;
        const steps = Math.max(4, Math.ceil(Math.hypot(dx, dy) / 10));
        for (let i = 0; i <= steps; i++) {
          const a = i / steps;
          const x = t.x1 + dx * a;
          const y = t.y1 + dy * a;
          const fade = pct * (1 - a * 0.55);
          if (t.style === "dash") {
            ctx.fillStyle = `rgba(167,92,255,${0.08 + fade * 0.18})`;
            ctx.fillRect(Math.floor(x - 4), Math.floor(y - 4), 8, 8);
            ctx.fillStyle = `rgba(220,200,255,${0.05 + fade * 0.12})`;
            ctx.fillRect(Math.floor(x - 2), Math.floor(y - 2), 4, 4);
          } else if (t.style === "drop") {
            ctx.fillStyle = `rgba(215,200,255,${0.10 + fade * 0.16})`;
            ctx.fillRect(Math.floor(x - 1), Math.floor(y - 6), 2, 12);
          } else {
            ctx.fillStyle = `rgba(215,200,255,${0.08 + fade * 0.14})`;
            ctx.fillRect(Math.floor(x - 3), Math.floor(y - 3), 6, 6);
          }
        }
      }

      for (const b of state.fxBursts) {
        if (b.layer !== player.layer) continue;
        const pct = clamp(b.life / b.maxLife, 0, 1);
        const r = (1 - pct) * b.size;
        const alpha = 0.08 + pct * 0.22;
        const col = b.style === "dash" ? `rgba(167,92,255,${alpha})` : b.style === "drop" ? `rgba(215,200,255,${alpha})` : `rgba(255,176,46,${alpha})`;
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(b.x - r), Math.floor(b.y), Math.floor(r * 2), 1);
        ctx.fillRect(Math.floor(b.x), Math.floor(b.y - r), 1, Math.floor(r * 2));
        ctx.fillRect(Math.floor(b.x - r * 0.7), Math.floor(b.y - r * 0.7), Math.floor(r * 1.4), 1);
        ctx.fillRect(Math.floor(b.x - r * 0.7), Math.floor(b.y + r * 0.7), Math.floor(r * 1.4), 1);
      }
    }

    function drawFogClouds() {
      for (const f of state.fogClouds) {
        if (f.layer !== player.layer) continue;
        const pct = clamp(f.life / f.maxLife, 0, 1);
        const alpha = 0.05 + pct * 0.14;
        const r = f.radius;
        const puffs = f.style === "dust"
          ? [
              { ox: -0.42, oy: 0.08, rr: 0.48 },
              { ox: 0.38, oy: 0.02, rr: 0.56 },
              { ox: 0.0, oy: 0.18, rr: 0.64 },
              { ox: 0.05, oy: -0.25, rr: 0.36 }
            ]
          : [
              { ox: -0.34, oy: -0.08, rr: 0.58 },
              { ox: 0.30, oy: 0.02, rr: 0.62 },
              { ox: 0.0, oy: 0.22, rr: 0.50 },
              { ox: 0.02, oy: -0.36, rr: 0.42 }
            ];
        for (const puff of puffs) {
          ctx.beginPath();
          ctx.arc(f.x + puff.ox * r, f.y + puff.oy * r, Math.max(2, r * puff.rr), 0, Math.PI * 2);
          ctx.fillStyle = f.style === "dust"
            ? `rgba(164,136,104,${alpha * 0.78})`
            : `rgba(170,150,190,${alpha})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2, r * 0.55), 0, Math.PI * 2);
        ctx.fillStyle = f.style === "dust"
          ? `rgba(210,188,154,${alpha * 0.42})`
          : `rgba(220,210,235,${alpha * 0.54})`;
        ctx.fill();
      }
    }

    function displayedVisionHalfAngle(n) {
      // The drawn cone should represent the same FOV used by detection.
      // Before, it was narrower than the real logic and could look like NPCs saw you
      // "por fuera" del cone.
      return Math.acos(visionCosLimit(n));
    }

    function hasForwardVision(observer, target, opts = {}) {
      if (!observer || !target || observer.dead || observer.stunned) return false;
      if (observer === target) return false;
      if (observer.layer !== target.layer) return false;
      if (player.inSafehouse && target === player) return false;
      if ((observer.hidden && !observer.revealed) || (target.hidden && !target.revealed)) return false;

      const dx = target.x - observer.x;
      const dy = target.y - observer.y;
      const d = Math.hypot(dx, dy);
      let range = opts.range ?? visionRange(observer);

      const shadowZone = (target === player || target.dead) ? getShadowZoneAt(target.x, target.y, target.layer, target === player && player.inSafehouse) : null;
      if (shadowZone) range *= visionMultiplierForShadow(observer, shadowZone);
      const lightZone = (target === player || target.dead) ? getLightZoneAt(target.x, target.y, target.layer, target === player && player.inSafehouse) : null;
      if (lightZone && !shadowZone) range *= observer.type === "hunter" ? 1.10 : observer.type === "police" ? 1.22 : 1.16;

      if (d > range) return false;
      if (!hasLineOfSight(observer, target)) return false;

      const len = d || 1;
      const dot = (dx / len) * (observer.dirX || 0) + (dy / len) * (observer.dirY || 1);
      return dot >= (opts.cosLimit ?? visionCosLimit(observer));
    }

    function drawVisionCones() {
      if (player.layer !== LAYER.STREET || player.inSafehouse) return;
      ctx.save();
      for (const n of npcs) {
        if (n.dead || n.layer !== player.layer) continue;
        if (n.type !== "civilian" && n.type !== "target" && n.type !== "police" && n.type !== "hunter") continue;
        if (n.hidden && !n.revealed) continue;
        const range = visionRange(n);
        const angle = Math.atan2(n.dirY || 1, n.dirX || 0);
        const half = displayedVisionHalfAngle(n);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.arc(n.x, n.y, range, angle - half, angle + half);
        ctx.closePath();
        ctx.fillStyle = n.type === "hunter" ? "rgba(255,157,53,.075)" : n.type === "police" ? "rgba(77,163,255,.065)" : "rgba(255,225,107,.045)";
        ctx.fill();
      }
      ctx.restore();
    }

    function drawSenseMarker(x, y, label, color, strong = false) {
      const pulse = (Math.sin(state.time * 8) + 1) / 2;
      const size = strong ? 14 : 10;
      ctx.fillStyle = `rgba(0,0,0,${0.35 + pulse * 0.18})`;
      ctx.fillRect(Math.floor(x - size / 2 - 1), Math.floor(y - size / 2 - 1), size + 2, size + 2);
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x - size / 2), Math.floor(y - size / 2), size, 2);
      ctx.fillRect(Math.floor(x - size / 2), Math.floor(y + size / 2 - 1), size, 2);
      ctx.fillRect(Math.floor(x - size / 2), Math.floor(y - size / 2), 2, size);
      ctx.fillRect(Math.floor(x + size / 2 - 1), Math.floor(y - size / 2), 2, size);
      ctx.fillStyle = color;
      ctx.font = "8px monospace";
      ctx.fillText(label, Math.floor(x + 7), Math.floor(y - 7));
    }

    function isCivilianIsolated(n) {
      if (!n || n.dead || n.hiddenBody || n.layer !== player.layer) return false;
      const closeHumans = npcs.filter(o =>
        o !== n && !o.dead && !o.hiddenBody && o.layer === n.layer &&
        (o.type === "civilian" || o.type === "target") &&
        Math.hypot(o.x - n.x, o.y - n.y) < 56
      ).length;
      const closeAuthority = npcs.filter(o =>
        !o.dead && !o.hiddenBody && o.layer === n.layer &&
        (o.type === "police" || o.type === "hunter") &&
        Math.hypot(o.x - n.x, o.y - n.y) < 82
      ).length;
      return closeHumans === 0 && closeAuthority === 0;
    }

    function drawBloodSenseOverlay() {
      if (player.bloodSenseTimer <= 0) return;
      const pct = clamp(player.bloodSenseTimer / 4.8, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(state.time * 10) * 0.12;

      // Victims, target and witnesses. It does not mark everyone: only what helps decision-making.
      for (const n of npcs) {
        if (n.hiddenBody || n.layer !== player.layer) continue;
        const d = Math.hypot(n.x - player.x, n.y - player.y);
        if (n.dead) {
          if (d < 260) drawSenseMarker(n.x, n.y, "body", "#b31934", true);
          continue;
        }
        if (n.hidden && !n.revealed) {
          if (n.type === "hunter" && player.layer === LAYER.STREET && d < 235) {
            drawSenseMarker(n.x, n.y, "hunter?", "#ff9d35", true);
          }
          continue;
        }
        if (n.type === "target" && d < 300) drawSenseMarker(n.x, n.y, "JOURNO", "#ff4bd8", true);
        else if (n.alarmed && !n.hasReported && d < 300) drawSenseMarker(n.x, n.y, "witness", "#ff3b50", true);
        else if ((n.type === "civilian" || n.type === "target") && isCivilianIsolated(n) && d < 220) drawSenseMarker(n.x, n.y, "isolated", "#d7c8ff");
        else if (n.type === "hunter" && n.blockingRoute && d < 260) drawSenseMarker(n.x, n.y, "block", "#ff9d35", true);
      }

      // Physical trails: discovered or nearby stains.
      for (const stain of state.bloodStains) {
        if (stain.cleaned || stain.layer !== player.layer) continue;
        const d = Math.hypot(stain.x - player.x, stain.y - player.y);
        if (d < 260) drawSenseMarker(stain.x, stain.y, stain.brutal ? "blood!" : "blood", stain.brutal ? "#ff2f62" : "#b31934", stain.brutal);
      }

      // Cameras: Blood Sense reads them as cold eyes, even without blood.
      for (const cam of cameras) {
        if (cam.broken || player.layer !== LAYER.STREET) continue;
        const d = Math.hypot(cam.x - player.x, cam.y - player.y);
        if (d < 300) drawSenseMarker(cam.x, cam.y, "camera", "#4da3ff");
      }

      // Local heat: marks zones where the city is already nervous.
      for (const z of localZones) {
        if (z.layer) continue;
        const h = heatValue(z.id);
        if (h < 45 || player.layer !== LAYER.STREET) continue;
        drawSenseMarker(z.x + z.w / 2, z.y + 12, h >= 70 ? "hot!" : "suspicion", h >= 70 ? "#ff2f62" : "#ffb02e", h >= 70);
      }

      // Routes: not a minimap, just a reminder of escape options.
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        if (!["safehouseDoor", "sewerIn", "fireEscape", "roofDrop", "fireEscapeDown", "toHighRoof", "fromHighRoof", "sewerOutHome", "sewerOutMain"].includes(it.id)) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d < 360) drawSenseMarker(it.x, it.y, "route", "#78c7a3");
      }

      // If hunters are blocking exits, Blood Sense makes it explicit.
      for (const h of npcs) {
        if (h.type !== "hunter" || !h.blockingRoute || h.dead) continue;
        if (h.blockingRoute.layer !== player.layer) continue;
        drawSenseMarker(h.blockingRoute.x, h.blockingRoute.y, "cutoff", "#ff9d35", true);
      }

      ctx.globalAlpha = 0.22 * pct;
      ctx.fillStyle = "#a75cff";
      ctx.fillRect(Math.floor(player.x - 120), Math.floor(player.y - 1), 240, 2);
      ctx.fillRect(Math.floor(player.x - 1), Math.floor(player.y - 120), 2, 240);
      ctx.restore();
    }


    function missionRating() {
      const s = state.stats;
      const exposure = player.exposure;
      if (s.brutalFeeds >= 2 || exposure >= 85) {
        return { title: "MASSACRE", color: "#ff2f62", desc: "The city knows something impossible protected a vampire secret tonight." };
      }
      if (s.huntersRevealed > 0 || exposure >= 62) {
        return { title: "HUNTERS AWAKENED", color: "#ff9d35", desc: "It is not only the police looking for you: someone understands what you are." };
      }
      if (s.witnessesReported > 0 || s.bodiesDiscovered > 0 || s.cameraFlags > 0 || exposure >= 42) {
        return { title: "CITY ALARMED", color: "#ffb02e", desc: "You contained the leak, but left too many eyes and too much evidence." };
      }
      if (s.bloodStainsCreated > 4 || s.lightsBroken > 0 || s.camerasBroken > 0 || s.maxLocalHeat >= 45) {
        return { title: "MINOR TRAIL", color: "#d7c8ff", desc: "Order resolved, although the district noticed cracks in the night." };
      }
      if (s.bodiesHidden >= s.feeds && s.witnessesIntercepted === 0 && exposure < 18) {
        return { title: "PERFECT GHOST", color: "#78c7a3", desc: "No one has the story. Only an absence remains." };
      }
      return { title: "CLEAN HUNT", color: "#78c7a3", desc: "The journalist vanished and the district barely remembers you." };
    }

    function drawMissionSummaryOverlay() {
      if (!state.orderReportOpen) return;
      const s = state.stats;
      const rating = missionRating();
      const lines = [
        `CLAN VERDICT: ${rating.title}`,
        rating.desc,
        `Final exposure Lv ${exposureLevel()} · hunger from powers +${Math.round(s.hungerFromPowers)}%`,
        `Drains ${s.feeds} · brutal ${s.brutalFeeds} · bodies hidden ${s.bodiesHidden}/${s.feeds}`,
        `Bodies discovered ${s.bodiesDiscovered} · witnesses intercepted ${s.witnessesIntercepted} · reports ${s.witnessesReported}`,
        `Streetlights broken ${s.lightsBroken} · cameras broken ${s.camerasBroken} · police responses ${s.policeResponses}`,
        `Camera flags ${s.cameraFlags}`,
        `Hunters alerted ${s.huntersRevealed} · events ${s.dynamicEvents} · max heat ${s.maxLocalHeat}`,
        "Valid styles: silent clan enforcer, chaotic district cleanup, or predator ruled by the Beast."
      ];
      const w = Math.min(620, VIEW_W - 24);
      const lineGap = 15;
      const h = 154;
      const x = Math.floor(VIEW_W / 2 - w / 2);
      const y = Math.floor(14);
      ctx.fillStyle = "rgba(0,0,0,.46)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(5,5,10,.94)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rating.color;
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = "#f1e6ff";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      for (let i = 0; i < lines.length; i++) {
        ctx.fillStyle = i === 0 ? rating.color : i === 1 ? "#d7c8ff" : "#f1e6ff";
        ctx.fillText(lines[i], x + 12, y + 22 + i * lineGap);
      }
      ctx.fillStyle = "rgba(215,200,255,.12)";
      ctx.fillRect(x + 12, y + h - 28, w - 24, 19);
      ctx.fillStyle = "#d7c8ff";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillText("PRESS ENTER / E / SPACE TO ACCEPT REPORT AND RESUME FREE ROAM", x + 20, y + h - 14);
    }

    function facingFromDir(dx, dy) {
      const ax = Math.abs(dx || 0);
      const ay = Math.abs(dy || 0);
      if (ax > ay) return (dx || 0) >= 0 ? "right" : "left";
      return (dy || 1) >= 0 ? "down" : "up";
    }

    function drawTopdownCharacter(x, y, palette, dirX, dirY, opts = {}) {
      const facing = facingFromDir(dirX, dirY);
      const shadowW = opts.shadowW ?? 8;
      const shadowH = opts.shadowH ?? 2;
      const moving = Boolean(opts.moving);
      const walkPhase = opts.walkPhase ?? 0;
      const scale = Math.max(0.6, opts.scale ?? 1);
      const shadowScale = Math.max(0.55, 1 - (scale - 1) * 0.42);
      const step = moving ? (Math.sin(walkPhase) >= 0 ? 1 : -1) : 0;
      const bob = moving ? (Math.sin(walkPhase * 0.5) >= 0 ? 1 : 0) : 0;
      const hx = x;
      const hy = y - 1;

      function sRect(rx, ry, rw, rh, color) {
        ctx.fillStyle = color;
        const xx = Math.floor(x + rx * scale);
        const yy = Math.floor(y + ry * scale);
        const ww = Math.max(1, Math.round(rw * scale));
        const hh = Math.max(1, Math.round(rh * scale));
        ctx.fillRect(xx, yy, ww, hh);
      }
      function hRect(rx, ry, rw, rh, color) {
        ctx.fillStyle = color;
        const xx = Math.floor(hx + rx * scale);
        const yy = Math.floor(hy + ry * scale);
        const ww = Math.max(1, Math.round(rw * scale));
        const hh = Math.max(1, Math.round(rh * scale));
        ctx.fillRect(xx, yy, ww, hh);
      }

      const handBaseY = facing === "up" ? 1 : facing === "down" ? 3 : 2;
      const leftHand = { x: -6, y: handBaseY + step };
      const rightHand = { x: 5, y: handBaseY - step };
      const leftFoot = { x: -2, y: 7 + Math.max(0, step) };
      const rightFoot = { x: 1, y: 7 + Math.max(0, -step) };
      const hair = facing === "left"
        ? { x: -3, y: -2, w: 2, h: 4 }
        : facing === "right"
          ? { x: 1, y: -2, w: 2, h: 4 }
          : { x: -2, y: -3, w: 4, h: 2 };

      ctx.fillStyle = "rgba(0,0,0,.30)";
      ctx.fillRect(
        Math.floor(x - (shadowW * shadowScale) / 2),
        Math.floor(y + 8 + bob + (scale - 1) * 7),
        Math.max(2, Math.round(shadowW * shadowScale)),
        Math.max(1, Math.round(shadowH * shadowScale))
      );

      // Hands and feet first so the circular head sits cleanly on top.
      sRect(leftHand.x, leftHand.y, 2, 2, palette.arms || palette.head);
      sRect(rightHand.x, rightHand.y, 2, 2, palette.arms || palette.head);
      sRect(leftFoot.x, leftFoot.y, 2, 2, palette.feet || (palette.arms || palette.head));
      sRect(rightFoot.x, rightFoot.y, 2, 2, palette.feet || (palette.arms || palette.head));

      // Top-down circular head: 6x6 readable pseudo-circle.
      hRect(-2, -4, 4, 1, palette.head);
      hRect(-3, -3, 6, 4, palette.head);
      hRect(-2, 1, 4, 1, palette.head);

      hRect(hair.x, hair.y, hair.w, hair.h, palette.hair || "#231722");

      if (palette.face && facing === "down") {
        hRect(-1, -1, 1, 1, palette.face);
        hRect(1, -1, 1, 1, palette.face);
      }

      if (opts.marker === "police") {
        hRect(-2, -4, 4, 1, "#d9ecff");
      } else if (opts.marker === "hunter") {
        hRect(-1, -5, 2, 1, "#ffd483");
      } else if (opts.marker === "target") {
        hRect(-1, -5, 2, 1, "#ffd6fa");
      }
    }

    function npcPalette(n, bodyColor) {
      if (n.type === "police") {
        return { head: "#d9c0a0", hair: "#214a8a", body: bodyColor, detail: "#9fd3ff", arms: "#2e73be", feet: "#183663", face: "#101018" };
      }
      if (n.type === "hunter") {
        return { head: "#c9b18b", hair: "#4c2e12", body: bodyColor, detail: "#ffe1b2", arms: "#8c511d", feet: "#43230d", face: "#101018" };
      }
      if (n.type === "target") {
        return { head: "#d9bfaa", hair: "#ffb2f3", body: bodyColor, detail: "#ffd7fa", arms: bodyColor, feet: "#482345", face: "#101018" };
      }
      return { head: "#d5b48b", hair: "#4a3528", body: bodyColor, detail: "#e3d5b8", arms: bodyColor, feet: "#4d3b2a", face: "#101018" };
    }

    function drawNPCs() {
      for (const n of npcs) {
        if (n.layer !== player.layer) continue;
        if (n.hiddenBody) continue;
        if (n.dead) {
          drawBody(n);
          continue;
        }
        if (n.hidden && !n.revealed) continue;

        let c = "#c8b58a";
        if (n.type === "rat") c = "#9c8f7a";
        if (n.type === "target") c = "#ff4bd8";
        if (n.type === "police") c = "#4da3ff";
        if (n.type === "hunter") c = "#ff9d35";
        if (n.fleeTimer > 0) c = "#ffe16b";
        if (n.alarmed && !n.hasReported) c = "#ff3b50";
        if (n.luredTimer > 0) c = "#d7c8ff";

        if ((n.type === "civilian" || n.type === "target") && beastStage().level >= 2 && !n.dead) {
          const nearBlood = Math.hypot(n.x - player.x, n.y - player.y) < (beastStage().level >= 3 ? 105 : 75);
          if (nearBlood) {
            ctx.fillStyle = beastStage().level >= 3 ? "rgba(255,47,98,.22)" : "rgba(255,47,98,.12)";
            ctx.fillRect(Math.floor(n.x - 8), Math.floor(n.y - 10), 16, 18);
          }
        }

        if (n.behavior === "loiter" && n.luredTimer <= 0) {
          ctx.fillStyle = "rgba(255,255,255,.10)";
          ctx.fillRect(Math.floor(n.x - 7), Math.floor(n.y - 7), 2, 14);
        }

        drawTopdownCharacter(
          n.x,
          n.y,
          npcPalette(n, c),
          n.dirX || 0,
          n.dirY || 1,
          {
            marker: n.type === "police" ? "police" : n.type === "hunter" ? "hunter" : n.type === "target" ? "target" : "civilian",
            moving: Math.hypot(n.vx || 0, n.vy || 0) > 2,
            walkPhase: state.time * (Math.hypot(n.vx || 0, n.vy || 0) > 18 ? 18 : 12) + n.id * 0.7,
            shadowW: 10,
            shadowH: 2
          }
        );

        if (n.alarmed && !n.hasReported) {
          ctx.fillStyle = "#ff3b50";
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 16), 2, 7);
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 7), 2, 2);
        } else if (n.luredTimer > 0) {
          ctx.fillStyle = "#d7c8ff";
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 14), 2, 5);
        } else if (n.investigateTimer > 0 && n.investigatingNoise) {
          ctx.fillStyle = "#ffb02e";
          ctx.fillRect(Math.floor(n.x - 2), Math.floor(n.y - 15), 4, 2);
          ctx.fillRect(Math.floor(n.x + 1), Math.floor(n.y - 13), 2, 4);
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 8), 2, 2);
        } else if (n.suspiciousTimer > 0) {
          ctx.fillStyle = "#ffb02e";
          ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 13), 2, 4);
        }
      }
    }

    function drawBody(n) {
      if (n.dragged) {
        ctx.strokeStyle = "rgba(215,200,255,.35)";
        ctx.beginPath();
        ctx.moveTo(Math.floor(player.x), Math.floor(player.y));
        ctx.lineTo(Math.floor(n.x), Math.floor(n.y));
        ctx.stroke();
      }
      ctx.fillStyle = n.beastKilled ? "#b31934" : n.dragged ? "#6e1629" : n.corpseDiscovered ? "#8d1c2e" : "#4b0e1a";
      ctx.fillRect(Math.floor(n.x - 6), Math.floor(n.y - 3), 12, 6);
      ctx.fillStyle = "#12060a";
      ctx.fillRect(Math.floor(n.x + 4), Math.floor(n.y - 2), 4, 4);
      if (n.dragged) {
        ctx.fillStyle = "#d7c8ff";
        ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 12), 2, 4);
      }
      if (n.beastKilled) {
        ctx.fillStyle = "#ff2f62";
        ctx.fillRect(Math.floor(n.x - 7), Math.floor(n.y + 4), 14, 2);
      }
      if (n.corpseDiscovered) {
        ctx.fillStyle = "#ffb02e";
        ctx.fillRect(Math.floor(n.x - 1), Math.floor(n.y - 11), 2, 5);
      }
    }

    function drawPlayer() {
      const beast = beastStage();
      if (beast.level >= 2 || player.beastFlash > 0) {
        const aura = beast.level >= 3 ? 22 : 17;
        ctx.fillStyle = beast.level >= 3 ? "rgba(255,47,98,.24)" : "rgba(255,107,58,.15)";
        ctx.fillRect(Math.floor(player.x - aura / 2), Math.floor(player.y - aura / 2), aura, aura);
      }
      if (player.dashFlash > 0) {
        ctx.fillStyle = "rgba(167, 92, 255, .42)";
        ctx.fillRect(Math.floor(player.x - 16), Math.floor(player.y - 16), 32, 32);
      }

      const playerMoveNow = (() => {
        const d = inputDirection();
        return Math.hypot(d.x, d.y) > 0.01 && !state.feeding;
      })();
      const cinematicScale = (() => {
        if (!state.cinematic) return 1;
        const c = state.cinematic;
        const p = 1 - c.time / c.duration;
        if (p < c.anticipation) {
          const ap = p / Math.max(0.001, c.anticipation);
          return 1 - Math.sin(ap * Math.PI) * c.anticipationSquash;
        }
        const airP = p < c.landAt ? (p - c.anticipation) / Math.max(0.001, c.landAt - c.anticipation) : 0;
        const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, airP)));
        return 1 + arc * c.airScale;
      })();
      drawTopdownCharacter(
        player.x,
        player.y,
        {
          body: "#15121d",
          detail: "#2a2030",
          arms: "#2b1a22",
          feet: "#18131f",
          head: "#e8d9e9",
          hair: "#120f19",
          face: "#ff3344"
        },
        player.lastDir.x || 1,
        player.lastDir.y || 0,
        {
          shadowW: 10,
          shadowH: 2,
          moving: playerMoveNow,
          walkPhase: state.time * (keys["shift"] ? 20 : 14),
          scale: cinematicScale
        }
      );
    }


    function drawFeedingProgress() {
      const f = state.feeding;
      if (!f) return;
      const w = 42;
      const h = 5;
      const x = Math.floor(player.x - w / 2);
      const y = Math.floor(player.y - 24);
      const pct = clamp(f.time / f.duration, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = "#2a1020";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = f.maxWitnesses > 0 ? "#ffb02e" : "#d7c8ff";
      ctx.fillRect(x, y, Math.floor(w * pct), h);
      ctx.fillStyle = "#f1e6ff";
      ctx.font = "8px monospace";
      ctx.fillText("FEED", x + 7, y - 3);
    }

    function drawBeastOverlay() {
      const beast = beastStage();
      if (beast.level < 2 && player.beastFlash <= 0) return;
      const pulse = (Math.sin(state.time * (beast.level >= 3 ? 12 : 7)) + 1) / 2;
      const base = beast.level >= 3 ? 0.10 : 0.045;
      const flash = player.beastFlash > 0 ? player.beastFlash * 0.22 : 0;
      ctx.fillStyle = `rgba(125, 16, 38, ${base + pulse * base + flash})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (state.beastUrge > 0.05) {
        const w = 72;
        const x = Math.floor(VIEW_W / 2 - w / 2);
        const y = Math.floor(VIEW_H - 18);
        ctx.fillStyle = "rgba(0,0,0,.62)";
        ctx.fillRect(x - 1, y - 1, w + 2, 6);
        ctx.fillStyle = "#35101b";
        ctx.fillRect(x, y, w, 4);
        ctx.fillStyle = "#ff2f62";
        ctx.fillRect(x, y, Math.floor(w * clamp(state.beastUrge / 2, 0, 1)), 4);
        ctx.fillStyle = "#ffd1da";
        ctx.font = "8px monospace";
        ctx.fillText("BEAST", x + 18, y - 3);
      }
    }



    function drawTinyLabel(x, y, text, color = "#f1e6ff", bg = "rgba(0,0,0,.62)") {
      ctx.font = "8px monospace";
      const w = Math.max(8, Math.floor(ctx.measureText(text).width) + 4);
      const tx = Math.floor(x - w / 2);
      const ty = Math.floor(y);
      ctx.fillStyle = bg;
      ctx.fillRect(tx, ty - 8, w, 10);
      ctx.fillStyle = color;
      ctx.fillText(text, tx + 2, ty);
    }

    function drawLineToPlayer(x, y, color, label) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(Math.floor(x), Math.floor(y));
      ctx.lineTo(Math.floor(player.x), Math.floor(player.y));
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawTinyLabel(x, y - 14, label, color);
    }

    function drawReadabilityMarkers() {
      // Readability layer: it adds no gameplay, only explains what is exposing you right now.
      if (player.inSafehouse) return;
      ctx.save();
      ctx.font = "8px monospace";

      // Whoever sees you gets a V and a short line toward you.
      if (player.layer === LAYER.STREET) {
        for (const n of npcs) {
          if (n.dead || n.stunned || n.hiddenBody || n.layer !== player.layer) continue;
          if (n.hidden && !n.revealed) continue;
          if (!["civilian", "target", "police", "hunter"].includes(n.type)) continue;
          // The V line is only drawn when they are looking at you inside the real cone.
          // Very-close peripheral perception can still exist for gameplay,
          // but it is not drawn as a "line of sight" to avoid confusion.
          if (hasForwardVision(n, player)) {
            const color = n.type === "hunter" ? "#ff9d35" : n.type === "police" ? "#4da3ff" : "#ffb02e";
            drawLineToPlayer(n.x, n.y - 10, color, n.type === "civilian" || n.type === "target" ? "V" : "V!");
          }
        }
      }

      // Witnesses: flecha mental hacia el punto de aviso.
      for (const n of activeAlarmedWitnesses()) {
        if (n.layer !== player.layer) continue;
        drawTinyLabel(n.x, n.y - 22, "! WITNESS", "#ff3b50");
        if (n.reportTarget) {
          ctx.strokeStyle = "rgba(255,59,80,.42)";
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(Math.floor(n.x), Math.floor(n.y));
          ctx.lineTo(Math.floor(n.reportTarget.x), Math.floor(n.reportTarget.y));
          ctx.stroke();
          ctx.setLineDash([]);
          drawTinyLabel(n.reportTarget.x, n.reportTarget.y - 12, "REPORT", "#ff3b50");
        }
      }

      // Noise/blood investigation: signs above whoever is investigating.
      for (const n of npcs) {
        if (n.dead || n.stunned || n.hiddenBody || n.layer !== player.layer) continue;
        if (n.hidden && !n.revealed) continue;
        if (n.investigateTimer > 0 && n.investigatingNoise) {
          drawTinyLabel(n.x, n.y - 20, "? noise", n.type === "police" ? "#4da3ff" : n.type === "hunter" ? "#ff9d35" : "#ffb02e");
        }
        if (n.bloodTrackTimer > 0 && n.investigatingBlood) {
          drawTinyLabel(n.x, n.y - 30, "B trail", n.type === "hunter" ? "#ff9d35" : "#ff3b50");
        }
        if (n.type === "hunter" && n.blockingRoute) {
          drawTinyLabel(n.x, n.y - 40, "cuts route", "#ff9d35");
          drawTinyLabel(n.blockingRoute.x, n.blockingRoute.y - 14, "BLOCK", "#ff9d35");
        }
      }

      // Cameras currently looking at the player.
      for (const cam of camerasWatchingPoint(player.x, player.y, player.layer)) {
        drawTinyLabel(cam.x, cam.y - 14, "CAM", "#4da3ff");
        ctx.strokeStyle = "rgba(77,163,255,.55)";
        ctx.beginPath();
        ctx.moveTo(Math.floor(cam.x), Math.floor(cam.y));
        ctx.lineTo(Math.floor(player.x), Math.floor(player.y));
        ctx.stroke();
      }

      // Nearby important routes: labeled only when close to avoid clutter.
      for (const it of interactables) {
        if (it.layer !== player.layer) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d > 58) continue;
        if (["safehouseDoor", "sewerIn", "fireEscape", "roofDrop", "fireEscapeDown", "toHighRoof", "fromHighRoof", "sewerOutHome", "sewerOutMain"].includes(it.id)) {
          drawTinyLabel(it.x, it.y - it.r - 6, "E route", "#78c7a3");
        }
      }
      ctx.restore();
    }

    function drawHelpOverlay() {
      // Removed: help now lives in js/help-overlay.js as a DOM modal.
    }

    function currentDetectionState() {
      if (player.inSafehouse) return { text: "safehouse", kind: "hidden" };
      if (state.draggingBody) return { text: "dragging a body", kind: "danger" };
      if (beastStage().level >= 3 && state.beastUrge > 0.35) return { text: "the Beast pushes", kind: "danger" };
      if (state.feeding) {
        const w = state.feeding.maxWitnesses;
        return w > 0 ? { text: "draining seen", kind: "danger" } : { text: "draining hidden", kind: "hidden" };
      }
      if (player.layer === LAYER.SEWER) return { text: "hidden in sewers", kind: "hidden" };
      if (player.layer > LAYER.STREET) return { text: "rooftop route", kind: "hidden" };
      if (activeAlarmedWitnesses().length > 0) return { text: "witness fleeing", kind: "danger" };
      if (npcs.some(n => !n.dead && n.bloodTrackTimer > 0 && n.layer === player.layer && Math.hypot(n.x - player.x, n.y - player.y) < 210)) return { text: "tracking trail", kind: "search" };
      if (npcs.some(n => !n.dead && n.investigateTimer > 0 && n.layer === player.layer && Math.hypot(n.x - player.x, n.y - player.y) < 180)) return { text: "investigating noise", kind: "search" };
      if (enemiesSeeingPlayer(190)) return { text: "spotted", kind: "danger" };
      if (npcs.some(n => !n.dead && n.type === "hunter" && n.blockingRoute && player.layer === n.blockingRoute.layer && Math.hypot(player.x - n.blockingRoute.x, player.y - n.blockingRoute.y) < 105)) return { text: "route blocked", kind: "danger" };
      const localHeatText = heatName();
      if (localHeatText && player.layer === LAYER.STREET) return { text: localHeatText, kind: heatValue(currentLocalZoneAt(player.x, player.y, player.layer).id) > 65 ? "danger" : "search" };
      if (exposureLevel() >= 2 && enemiesNear(180)) return { text: "being searched", kind: "search" };
      const shadow = getShadowZoneAt(player.x, player.y);
      if (shadow) return { text: `in shadow: ${shadow.name}`, kind: "hidden" };
      const light = getLightZoneAt(player.x, player.y);
      if (light && publicWitnesses(145) > 0) return { text: `under ${light.name}`, kind: "seen" };
      if (publicWitnesses(135) > 0) return { text: "visible", kind: "seen" };
      if (exposureLevel() > 0) return { text: "suspicion", kind: "search" };
      return { text: "hidden", kind: "hidden" };
    }



    function buildLegendLine(detection) {
      const witnesses = activeAlarmedWitnesses().length;
      const watchers = player.layer === LAYER.STREET && !player.inSafehouse ? publicWitnesses(145) : 0;
      const camerasOnYou = camerasWatchingPoint(player.x, player.y, player.layer).length;
      const noiseInvestigators = npcs.filter(n => !n.dead && !n.hiddenBody && n.layer === player.layer && n.investigateTimer > 0).length;
      const bloodTrackers = npcs.filter(n => !n.dead && !n.hiddenBody && n.layer === player.layer && n.bloodTrackTimer > 0).length;
      const visibleBodies = npcs.filter(n => n.dead && !n.hiddenBody && n.layer === player.layer).length;
      const heat = heatName();
      const shadow = getShadowZoneAt(player.x, player.y);
      const light = getLightZoneAt(player.x, player.y);
      const lastAlert = state.lastAlert && state.lastAlert.timer > 0 ? state.lastAlert : null;
      const parts = [];
      parts.push(`<b>Status:</b> <span class="${detection.kind === "danger" ? "bad" : detection.kind === "search" || detection.kind === "seen" ? "warn" : "ok"}">${detection.text}</span>`);
      if (lastAlert) parts.push(`<b>Last alert:</b> <span class="bad">${lastAlert.tag}</span>`);
      parts.push(`<b>Sight:</b> <span class="${watchers || camerasOnYou ? "warn" : "ok"}">${watchers ? watchers + " eye(s)" : camerasOnYou ? camerasOnYou + " CAM" : "clear"}</span>`);
      parts.push(`<b>Noise:</b> <span class="${noiseInvestigators ? "warn" : "ok"}">${noiseInvestigators ? noiseInvestigators + " investigating" : "silent"}</span>`);
      parts.push(`<b>Trail:</b> <span class="${bloodTrackers || visibleBodies ? "bad" : "ok"}">${bloodTrackers ? bloodTrackers + " tracking" : visibleBodies ? visibleBodies + " body/bodies" : "no nearby trail"}</span>`);
      parts.push(`<b>Witnesses:</b> <span class="${witnesses ? "bad" : "ok"}">${witnesses || "0"}</span>`);
      parts.push(`<b>Zone:</b> <span class="${heat ? "warn" : shadow ? "magic" : light ? "warn" : "ok"}">${heat || (shadow ? "shadow" : light ? "light" : "normal")}</span>`);
      return parts.join(" · ");
    }

    // ---------------------------------------------------------
    // 12. UI
    // ---------------------------------------------------------

    function updateDomUI() {
      const layerName = player.inSafehouse ? "Interior/Safehouse" : LAYER_NAME[player.layer];
      const detection = currentDetectionState();
      const status = detection.text;
      const dashText = player.dashCooldown <= 0 ? "ready" : `${player.dashCooldown.toFixed(1)}s`;
      const lureText = player.lureCooldown <= 0 ? "ready" : `${player.lureCooldown.toFixed(1)}s`;
      const senseText = player.senseCooldown <= 0 ? "ready" : `${player.senseCooldown.toFixed(1)}s`;
      const beast = beastStage();
      const prompt = contextualPrompt();
      const message = prompt || (state.messageTimer > 0 ? state.message : "");

      ui.hungerFill.style.width = `${Math.round(clamp(player.hunger, 0, 100))}%`;
      ui.hungerFill.classList.toggle("beast-wake", beast.level === 2);
      ui.hungerFill.classList.toggle("beast-critical", beast.level >= 3);
      ui.hungerValue.textContent = beast.level >= 2 ? `${Math.round(player.hunger)}%` : `${Math.round(player.hunger)}%`;
      ui.exposureFill.style.width = `${Math.round(clamp(player.exposure, 0, 100))}%`;
      ui.exposureValue.textContent = `Lv ${exposureLevel()}`;
      ui.dashState.textContent = `Dash ${dashText} [+${BALANCE.dashHunger}H] · Whisper ${lureText} [+${BALANCE.whisperHunger}H] · Sense ${senseText} [+${BALANCE.senseHunger}H] · ${beast.ui}`;
      ui.layerText.textContent = layerName;
      ui.visibilityText.textContent = status;
      ui.visibilityText.classList.toggle("seen", detection.kind === "seen" || detection.kind === "search");
      ui.visibilityText.classList.toggle("danger", detection.kind === "danger");
      ui.missionText.textContent = state.orderReportOpen
        ? "ORDER COMPLETE · Clan report awaiting acceptance."
        : state.freeRoam
          ? "FREE ROAM · The order is closed. The district is yours."
          : missionText();
      ui.messageLine.textContent = message || " ";
      ui.messageLine.classList.toggle("prompt", Boolean(prompt));
      ui.legendLine.innerHTML = buildLegendLine(detection);
    }

    function contextualPrompt() {
      if (state.orderReportOpen) return "Report open: press Enter / E / Space to accept and resume free roam.";
      if (state.freeRoam) return "";
      if (state.mission === 2 && !player.inSafehouse) return "Objective: reach the nightclub. The journalist is near the pink lights.";
      if (state.mission === 3 && player.senseCooldown <= 0) return `F: Blood Sense [+${BALANCE.senseHunger} hunger] to identify the journalist and clean route`;
      if (state.mission === 4) return "Objective: get close to the journalist, stand in shadow if possible, then press R to whisper.";
      if (state.mission === 5 && targetNpc() && !state.targetFed) {
        const shadow = getShadowZoneAt(player.x, player.y);
        const targetNear = Math.hypot(targetNpc().x - player.x, targetNpc().y - player.y) < 26;
        if (targetNear) return shadow ? "E: eliminate the journalist in shadow · clean route" : "Too exposed. Lead the journalist into shadow before eliminating them.";
        return "Lead the journalist into the club side shadow. Walk slowly; they will follow.";
      }
      if (state.mission === 6 && targetBodyVisible() && !state.draggingBody) return "Body visible: press E to drag it, then hide it in a marked spot, shadow, sewer or safehouse.";
      if (state.mission === 7) return "Return to the safehouse. Use rooftops or sewers if the street is hot.";
      if (state.draggingBody) {
        const spot = currentBodyHideSpot();
        return spot ? `E: hide body in ${spot.name}` : "E: drop body · look for marked hide spots, shadow, sewers, rooftop or safehouse";
      }
      if (beastStage().level >= 3 && state.beastUrge > 0.55) {
        return "FRENZY: stay away from civilians, enter shadow/safehouse or press E to drain before losing control";
      }
      const alarmed = nearestAlarmedWitness();
      if (alarmed) {
        const targetName = alarmed.reportTarget ? alarmed.reportTarget.name : "the police";
        return `E: intercept witness before they reach ${targetName}`;
      }
      const victim = nearestFeedable();
      if (victim) {
        const witnesses = publicWitnesses(135, victim);
        const shadow = getShadowZoneAt(player.x, player.y);
        const risk = witnesses > 0 ? `VISIBLE: ${witnesses} witness(es)` : shadow ? `in shadow: ${shadow.name}` : "apparently clean";
        return victim.type === "target" ? `E: eliminate JOURNALIST: greatly lowers hunger (${risk})` : `E: drain civilian: lowers hunger (${risk})`;
      }
      const body = nearestBody();
      if (body) {
        const witnesses = publicWitnesses(135, body);
        const risk = witnesses > 0 ? `VISIBLE: ${witnesses} witness(es)` : "no eyes on you";
        return `E: drag body (${risk})`;
      }
      const cam = nearestBreakableCamera();
      if (cam) {
        const witnesses = publicWitnesses(145);
        const risk = witnesses > 0 ? `VISIBLE: ${witnesses} witness(es)` : "no witnesses";
        return `E: break ${cam.name} (${risk})`;
      }
      const lamp = nearestBreakableLight();
      if (lamp) {
        const witnesses = publicWitnesses(145);
        const risk = witnesses > 0 ? `VISIBLE: ${witnesses} witness(es)` : "no witnesses";
        return `E: break ${lamp.name} to create shadow (${risk})`;
      }
      const lure = nearestLurable();
      if (lure && player.lureCooldown <= 0) {
        const witnesses = visibleWitnessList(150, lure).filter(n => n !== lure).length;
        const risk = witnesses > 0 ? `VISIBLE: ${witnesses} witness(es)` : "hidden";
        return lure.type === "target"
          ? `R: whisper to target [+${BALANCE.whisperHunger} hunger] to lure them (${risk})`
          : `R: whisper to a civilian [+${BALANCE.whisperHunger} hunger] to move them from their spot (${risk})`;
      }
      if (state.lureHintTimer > 0) return "Get close to the journalist or a civilian and press R to lure them. Then lead them into shadow.";
      if (player.bloodSenseTimer > 0) return "Blood Sense active: pink=journalist, white=isolated, red=trail/body, green=route, orange=hunter/block";
      if (player.senseCooldown <= 0 && !player.inSafehouse) return `F: Blood Sense [+${BALANCE.senseHunger} hunger] to read the journalist, trails, hunters and routes`;
      const it = nearbyInteractable();
      if (it) return typeof it.prompt === "function" ? it.prompt() : it.prompt;
      return "";
    }

    function missionText() {
      if (state.mission === 1) return "1/7 Leave the rooftop refuge and descend into your district.";
      if (state.mission === 2) return "2/7 Reach the pink-lit nightclub where the journalist is meeting a source.";
      if (state.mission === 3) return "3/7 Press F to use Blood Sense and identify the journalist.";
      if (state.mission === 4) return "4/7 Press R near the journalist to whisper, preferably from shadow.";
      if (state.mission === 5) return "5/7 Lead the journalist into shadow and press E to eliminate.";
      if (state.mission === 6) return activeAlarmedWitnesses().length > 0
        ? "6/7 A witness is fleeing: intercept with E or escape before the zone heats up."
        : targetBodyVisible()
          ? "6/7 Hide the body before the leak becomes evidence, or flee if things go wrong."
          : "6/7 Break pursuit if needed.";
      if (state.mission === 7) return "7/7 Return to the safehouse and report that the clan secret is contained.";
      if (state.orderReportOpen) return "ORDER COMPLETE · Accept the report to resume free roam.";
      if (state.freeRoam) return "FREE ROAM · Patrol the district, hunt, escape, or test the systems.";
      return "Complete. Review how cleanly you protected the clan.";
    }

    // ---------------------------------------------------------
    // Loop principal
    // ---------------------------------------------------------

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      resizeGameCanvas();
      update(dt);
      render();
      updateDomUI();
      // Limpiamos acciones one-shot al final del frame.
      for (const k in pressed) pressed[k] = false;
      requestAnimationFrame(loop);
    }

    resizeGameCanvas();
    updateDomUI();
    requestAnimationFrame(loop);
  })();
