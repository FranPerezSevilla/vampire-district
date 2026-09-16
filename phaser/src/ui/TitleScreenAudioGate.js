const THEME_FADE_MS = 430;
const THEME_CREDIT = "INTRO MUSIC\nEL (gothic version) — Andres Rodriguez / anrocomposer.\nPixabay Content License.\nhttps://pixabay.com/music/rock-el-gothic-version-136208/\n\nMAIN MENU\nAfter the Last Light — original ambient music for ViceBlood.\nDistant engine sound: freesounds123 / Pixabay Content License.";
const START_COPY = "PRESS ANY KEY TO START";

export class TitleScreenAudioGate {
  constructor({ documentRef = globalThis.document, windowRef = globalThis.window } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.root = null;
    this.bootMessage = null;
    this.waitPromise = null;
    this.resolveWait = null;
    this.listenersBound = false;
    this.creditsObserver = null;
    this.playbackGeneration = 0;
    this.introCleanup = null;
    this.introActive = false;
    this.boundKeydown = event => this.handleKeydown(event);
    this.boundPointer = event => this.unlock(event);
    this.boundTouch = event => this.unlock(event);
  }

  get theme() {
    return this.window?.NBD_MAIN_MENU_THEME || null;
  }

  installPulseStyle() {
    if (!this.document || this.document.getElementById("viceblood-title-audio-style")) return;
    const style = this.document.createElement("style");
    style.id = "viceblood-title-audio-style";
    style.textContent = `
      @keyframes viceblood-title-audio-pulse {
        0%,100% { opacity:.42; transform:translateY(0); }
        50% { opacity:1; transform:translateY(-2px); }
      }
      .viceblood-title-boot-message[data-audio-gate="waiting"] {
        color: rgba(241,237,230,.9) !important;
        animation: viceblood-title-audio-pulse 1.55s ease-in-out infinite;
      }
    `;
    this.document.head.appendChild(style);
  }

  installCreditsObserver(root) {
    if (this.creditsObserver || typeof this.window?.MutationObserver !== "function") return;
    this.creditsObserver = new this.window.MutationObserver(() => {
      if (root.dataset.panel === "credits") this.refreshCredits();
    });
    this.creditsObserver.observe(root, { attributes: true, attributeFilter: ["data-panel"] });
  }

  refreshCredits() {
    this.window?.setTimeout?.(() => {
      const body = this.document?.querySelector?.("[data-title-drawer-body]");
      if (!body || body.textContent.includes("EL (gothic version)")) return;
      body.textContent = `${body.textContent}\n\n${THEME_CREDIT}`;
    }, 0);
  }

  waitForStart() {
    if (this.waitPromise) return this.waitPromise;
    if (!this.document || !this.window) return Promise.resolve(false);

    this.root = this.document.getElementById("viceblood-title-screen");
    this.bootMessage = this.root?.querySelector("[data-title-boot-message]") || null;
    if (!this.root) return Promise.resolve(false);

    this.installPulseStyle();
    this.installCreditsObserver(this.root);
    this.root.hidden = false;
    delete this.root.dataset.introComplete;
    this.root.dataset.state = "boot";
    this.root.setAttribute("aria-hidden", "false");
    if (this.bootMessage) {
      this.bootMessage.textContent = START_COPY;
      this.bootMessage.dataset.audioGate = "waiting";
    }

    this.window.NBD_TITLE_AUDIO_GATE_STATE = "waiting";
    this.bindUnlockListeners();
    this.waitPromise = new Promise(resolve => {
      this.resolveWait = resolve;
    });
    return this.waitPromise;
  }

  bindUnlockListeners() {
    if (this.listenersBound || !this.root || !this.window) return;
    this.listenersBound = true;
    this.window.addEventListener("keydown", this.boundKeydown, true);
    this.root.addEventListener("pointerdown", this.boundPointer, true);
    this.root.addEventListener("touchstart", this.boundTouch, { capture: true, passive: false });
  }

  unbindUnlockListeners() {
    if (!this.listenersBound) return;
    this.listenersBound = false;
    this.window?.removeEventListener?.("keydown", this.boundKeydown, true);
    this.root?.removeEventListener("pointerdown", this.boundPointer, true);
    this.root?.removeEventListener("touchstart", this.boundTouch, true);
  }

  handleKeydown(event) {
    if (event.repeat) return;
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    this.unlock(event);
  }

  unlock(event) {
    if (!this.waitPromise || ["unlocking", "intro"].includes(this.window?.NBD_TITLE_AUDIO_GATE_STATE)) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.window.NBD_TITLE_AUDIO_GATE_STATE = "unlocking";

    this.unbindUnlockListeners();
    const video = this.document?.getElementById?.("viceblood-intro-video");
    const overlay = this.document?.getElementById?.("viceblood-intro");
    if (!video || !overlay) { this.finishIntro(); return; }
    this.theme?.stop?.();
    this.introActive = true;
    this.window.NBD_TITLE_AUDIO_GATE_STATE = "intro";
    overlay.hidden = false;
    const skip = this.document.getElementById("viceblood-intro-skip");
    const finish = () => { if (this.introActive) this.finishIntro(); };
    const onKey = e => {
      e.preventDefault(); e.stopImmediatePropagation?.();
      if (e.key === "Escape") finish();
    };
    const onSkip = e => { e.preventDefault(); e.stopPropagation(); finish(); };
    this.window.addEventListener("keydown", onKey, true);
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish);
    skip?.addEventListener("click", onSkip);
    this.introCleanup = () => {
      this.introActive = false;
      this.window.removeEventListener("keydown", onKey, true);
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", finish);
      skip?.removeEventListener("click", onSkip);
      video.pause(); overlay.hidden = true;
    };
    skip?.focus?.();
    try {
      video.currentTime = 0;
      Promise.resolve(video.play()).catch(finish);
    } catch { finish(); }
  }

  finishIntro() {
    // Prepare the direct menu presentation before uncovering the film.
    if (this.root) this.root.dataset.introComplete = "true";
    this.introCleanup?.();
    this.introCleanup = null;
    // Playback failure must never strand the player before the menu.
    // Start the menu's single media owner after the film stops. Audio readiness
    // must never delay menu presentation.
    const generation = ++this.playbackGeneration;
    const startAttempt = this.theme?.start?.();
    Promise.resolve(startAttempt).then(started => {
      if (generation !== this.playbackGeneration) return;
      this.window.NBD_TITLE_AUDIO_GATE_STATE = started ? "playing" : "blocked";
    }).catch(() => {
      if (generation !== this.playbackGeneration) return;
      this.window.NBD_TITLE_AUDIO_GATE_STATE = "blocked";
    });

    if (this.bootMessage) {
      this.bootMessage.textContent = "The city never sleeps";
      delete this.bootMessage.dataset.audioGate;
    }
    this.unbindUnlockListeners();
    const resolve = this.resolveWait;
    this.resolveWait = null;
    this.waitPromise = null;
    resolve?.(true);
  }

  fadeOut(durationMs = THEME_FADE_MS) {
    this.playbackGeneration++;
    this.cancelWait(false);
    this.theme?.fadeOut?.(durationMs);
  }

  stop() {
    this.playbackGeneration++;
    this.cancelWait(false);
    this.theme?.stop?.();
    if (this.window) this.window.NBD_TITLE_AUDIO_GATE_STATE = "stopped";
  }

  cancelWait(result = false) {
    this.introCleanup?.();
    this.introCleanup = null;
    this.unbindUnlockListeners();
    if (this.bootMessage) delete this.bootMessage.dataset.audioGate;
    const resolve = this.resolveWait;
    this.resolveWait = null;
    this.waitPromise = null;
    resolve?.(result);
  }

  dispose() {
    this.cancelWait(false);
    this.creditsObserver?.disconnect?.();
    this.creditsObserver = null;
  }
}

export const titleScreenAudioGate = new TitleScreenAudioGate();
globalThis.NBD_TITLE_AUDIO_GATE = titleScreenAudioGate;
