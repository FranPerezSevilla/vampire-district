const AUDIO_GATE_ID = "viceblood-title-audio-gate";
const THEME_FADE_MS = 430;
const THEME_CREDIT = "MUSIC\n“Gnossienne No. 1” — Erik Satie (1890).\nArranged for ViceBlood.";

function removeNode(node) {
  node?.remove?.();
}

export class TitleScreenAudioGate {
  constructor({ documentRef = document, windowRef = window } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.gate = null;
    this.keydownBound = false;
    this.creditsBound = false;
    this.boundKeydown = event => this.handleKeydown(event);
    this.boundUnlock = event => this.unlock(event);
    this.boundCredits = () => this.refreshCredits();
  }

  get theme() {
    return this.window.NBD_MAIN_MENU_THEME || null;
  }

  async present() {
    const root = this.document.getElementById("viceblood-title-screen");
    if (!root) return false;

    this.installCreditsHook(root);
    this.disposeGate();

    const gate = this.document.createElement("button");
    gate.id = AUDIO_GATE_ID;
    gate.type = "button";
    gate.className = "viceblood-title-audio-gate";
    gate.setAttribute("aria-label", "Start ViceBlood");
    gate.innerHTML = "<span>PRESS ANY KEY TO START</span>";
    gate.style.cssText = [
      "position:absolute",
      "inset:0",
      "z-index:999",
      "display:grid",
      "place-items:end center",
      "padding:0 0 8vh",
      "border:0",
      "background:rgba(5,6,11,.18)",
      "color:#f1e6ff",
      "font:700 clamp(12px,1.25vw,18px) Arial,Helvetica,sans-serif",
      "letter-spacing:.24em",
      "text-shadow:0 0 18px rgba(187,128,255,.6)",
      "cursor:pointer"
    ].join(";");

    const label = gate.querySelector("span");
    if (label) label.style.cssText = "animation:viceblood-title-audio-pulse 1.55s ease-in-out infinite";

    if (!this.document.getElementById("viceblood-title-audio-style")) {
      const style = this.document.createElement("style");
      style.id = "viceblood-title-audio-style";
      style.textContent = `
        @keyframes viceblood-title-audio-pulse {
          0%,100% { opacity:.46; transform:translateY(0); }
          50% { opacity:1; transform:translateY(-2px); }
        }
      `;
      this.document.head.appendChild(style);
    }

    gate.addEventListener("pointerdown", this.boundUnlock, true);
    gate.addEventListener("touchstart", this.boundUnlock, { capture: true, passive: false });
    this.window.addEventListener("keydown", this.boundKeydown, true);
    this.keydownBound = true;
    root.appendChild(gate);
    this.gate = gate;
    this.window.NBD_TITLE_AUDIO_GATE_STATE = "waiting";
    return true;
  }

  handleKeydown(event) {
    if (!this.gate || event.repeat) return;
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    this.unlock(event);
  }

  async unlock(event) {
    if (!this.gate) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.window.NBD_TITLE_AUDIO_GATE_STATE = "unlocking";

    const started = await this.theme?.start?.();
    if (!started) {
      this.window.NBD_TITLE_AUDIO_GATE_STATE = "blocked";
      const label = this.gate?.querySelector("span");
      if (label) label.textContent = "CLICK OR PRESS A KEY TO ENABLE AUDIO";
      return;
    }

    this.window.NBD_TITLE_AUDIO_GATE_STATE = "playing";
    this.disposeGate();
  }

  fadeOut(durationMs = THEME_FADE_MS) {
    this.disposeGate();
    this.theme?.fadeOut?.(durationMs);
  }

  installCreditsHook(root) {
    if (this.creditsBound) return;
    const creditsButton = root.querySelector('[data-title-action="credits"]');
    if (!creditsButton) return;
    creditsButton.addEventListener("click", this.boundCredits);
    this.creditsBound = true;
  }

  refreshCredits() {
    this.window.setTimeout(() => {
      const body = this.document.querySelector("[data-title-drawer-body]");
      if (!body || body.textContent.includes("Gnossienne No. 1")) return;
      body.textContent = `${body.textContent}\n\n${THEME_CREDIT}`;
    }, 0);
  }

  disposeGate() {
    if (this.gate) {
      this.gate.removeEventListener("pointerdown", this.boundUnlock, true);
      this.gate.removeEventListener("touchstart", this.boundUnlock, true);
      removeNode(this.gate);
      this.gate = null;
    }
    if (this.keydownBound) {
      this.window.removeEventListener("keydown", this.boundKeydown, true);
      this.keydownBound = false;
    }
  }

  dispose() {
    this.disposeGate();
  }
}

export const titleScreenAudioGate = new TitleScreenAudioGate();
globalThis.NBD_TITLE_AUDIO_GATE = titleScreenAudioGate;
