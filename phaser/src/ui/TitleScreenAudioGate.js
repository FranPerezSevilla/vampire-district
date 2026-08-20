const THEME_FADE_MS = 430;
const THEME_CREDIT = "MUSIC\n“Gnossienne No. 1” — Erik Satie (1890).\nArranged for ViceBlood.";
const START_COPY = "PRESS ANY KEY TO START";
const RETRY_COPY = "CLICK OR PRESS A KEY TO ENABLE AUDIO";

export class TitleScreenAudioGate {
  constructor({ documentRef = document, windowRef = window } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.root = null;
    this.bootMessage = null;
    this.waitPromise = null;
    this.resolveWait = null;
    this.listenersBound = false;
    this.creditsObserver = null;
    this.boundKeydown = event => this.handleKeydown(event);
    this.boundPointer = event => this.unlock(event);
    this.boundTouch = event => this.unlock(event);
  }

  get theme() {
    return this.window.NBD_MAIN_MENU_THEME || null;
  }

  installPulseStyle() {
    if (this.document.getElementById("viceblood-title-audio-style")) return;
    const style = this.document.createElement("style");
    style.id = "viceblood-title-audio-style";
    style.textContent = `
      @keyframes viceblood-title-audio-pulse {
        0%,100% { opacity:.42; transform:translateY(0); }
        50% { opacity:1; transform:translateY(-2px); }
      }
      .viceblood-title-boot-message[data-audio-gate="waiting"],
      .viceblood-title-boot-message[data-audio-gate="blocked"] {
        color: rgba(241,237,230,.9) !important;
        animation: viceblood-title-audio-pulse 1.55s ease-in-out infinite;
      }
    `;
    this.document.head.appendChild(style);
  }

  installCreditsObserver(root) {
    if (this.creditsObserver || typeof this.window.MutationObserver !== "function") return;
    this.creditsObserver = new this.window.MutationObserver(() => {
      if (root.dataset.panel === "credits") this.refreshCredits();
    });
    this.creditsObserver.observe(root, { attributes: true, attributeFilter: ["data-panel"] });
  }

  refreshCredits() {
    this.window.setTimeout(() => {
      const body = this.document.querySelector("[data-title-drawer-body]");
      if (!body || body.textContent.includes("Gnossienne No. 1")) return;
      body.textContent = `${body.textContent}\n\n${THEME_CREDIT}`;
    }, 0);
  }

  waitForStart() {
    if (this.waitPromise) return this.waitPromise;

    this.root = this.document.getElementById("viceblood-title-screen");
    this.bootMessage = this.root?.querySelector("[data-title-boot-message]") || null;
    if (!this.root) return Promise.resolve(false);

    this.installPulseStyle();
    this.installCreditsObserver(this.root);
    this.root.hidden = false;
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
    if (this.listenersBound || !this.root) return;
    this.listenersBound = true;
    this.window.addEventListener("keydown", this.boundKeydown, true);
    this.root.addEventListener("pointerdown", this.boundPointer, true);
    this.root.addEventListener("touchstart", this.boundTouch, { capture: true, passive: false });
  }

  unbindUnlockListeners() {
    if (!this.listenersBound) return;
    this.listenersBound = false;
    this.window.removeEventListener("keydown", this.boundKeydown, true);
    this.root?.removeEventListener("pointerdown", this.boundPointer, true);
    this.root?.removeEventListener("touchstart", this.boundTouch, true);
  }

  handleKeydown(event) {
    if (event.repeat) return;
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    this.unlock(event);
  }

  async unlock(event) {
    if (!this.waitPromise || this.window.NBD_TITLE_AUDIO_GATE_STATE === "unlocking") return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.window.NBD_TITLE_AUDIO_GATE_STATE = "unlocking";

    const started = await this.theme?.start?.();
    if (!started) {
      this.window.NBD_TITLE_AUDIO_GATE_STATE = "blocked";
      if (this.bootMessage) {
        this.bootMessage.textContent = RETRY_COPY;
        this.bootMessage.dataset.audioGate = "blocked";
      }
      return;
    }

    this.window.NBD_TITLE_AUDIO_GATE_STATE = "playing";
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
    this.cancelWait(false);
    this.theme?.fadeOut?.(durationMs);
  }

  cancelWait(result = false) {
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
