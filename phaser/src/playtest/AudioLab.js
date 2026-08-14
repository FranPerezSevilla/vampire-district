import { SAMPLE_AUDIO_IDS, sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";

const RAW_AUDIO_MASTER_GAIN = 0.20;

export class AudioLab {
  constructor(scene) {
    this.scene = scene;
    this.context = null;
    this.buffers = new Map();
    this.eventCursor = Object.create(null);
    this.activeSources = new Set();
    this.opened = false;
    this.pausedByLab = false;
    this.labVolume = 1;
    this.onKeyDown = event => this.handleKeyDown(event);
    this.mount();
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  mount() {
    this.installStyles();

    this.launcher = document.createElement("button");
    this.launcher.type = "button";
    this.launcher.className = "playtest-audio-button";
    this.launcher.textContent = "AUDIO LAB · F8";
    this.launcher.setAttribute("aria-label", "Open audio troubleshooting lab");
    this.launcher.addEventListener("click", () => this.open());
    document.body.appendChild(this.launcher);

    this.overlay = document.createElement("div");
    this.overlay.className = "playtest-audio-overlay";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <section class="playtest-audio-panel" role="dialog" aria-modal="true" aria-labelledby="playtest-audio-title">
        <header class="playtest-audio-header">
          <div>
            <p class="playtest-audio-kicker">PLAYTEST TROUBLESHOOTING</p>
            <h2 id="playtest-audio-title">Audio Lab</h2>
            <p>Direct sample preview at the same ×${RAW_AUDIO_MASTER_GAIN.toFixed(2)} master gain used by RawAudio. No combat, witnesses, Heat or gameplay cooldowns.</p>
          </div>
          <button class="playtest-audio-close" type="button" aria-label="Close Audio Lab">×</button>
        </header>
        <div class="playtest-audio-toolbar">
          <label>Preview volume <strong class="playtest-audio-volume-label">100%</strong> <span>(100% = gameplay baseline)</span></label>
          <input class="playtest-audio-volume" type="range" min="0" max="3" value="1" step="0.05" aria-label="Audio Lab preview volume">
        </div>
        <div class="playtest-audio-list"></div>
        <p class="playtest-audio-status" aria-live="polite">Choose an event or an exact variant.</p>
      </section>`;

    this.overlay.querySelector(".playtest-audio-close")?.addEventListener("click", () => this.close());
    this.overlay.addEventListener("pointerdown", event => {
      if (event.target === this.overlay) this.close();
    });
    this.volumeInput = this.overlay.querySelector(".playtest-audio-volume");
    this.volumeLabel = this.overlay.querySelector(".playtest-audio-volume-label");
    this.status = this.overlay.querySelector(".playtest-audio-status");
    this.volumeInput?.addEventListener("input", () => {
      this.labVolume = Number(this.volumeInput.value) || 0;
      if (this.volumeLabel) this.volumeLabel.textContent = `${Math.round(this.labVolume * 100)}%`;
    });
    document.body.appendChild(this.overlay);
    this.renderCatalogue();
  }

  installStyles() {
    if (document.querySelector("link[data-viceblood-audio-lab]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../../audio-lab.css", import.meta.url).href;
    link.dataset.vicebloodAudioLab = "true";
    document.head.appendChild(link);
  }

  renderCatalogue() {
    const list = this.overlay?.querySelector(".playtest-audio-list");
    if (!list) return;
    list.replaceChildren();

    for (const id of SAMPLE_AUDIO_IDS) {
      const definition = sampleAudioDefinition(id);
      if (!definition?.files?.length) continue;
      const entry = document.createElement("article");
      entry.className = "playtest-audio-entry";

      const meta = document.createElement("div");
      meta.className = "playtest-audio-meta";
      const name = document.createElement("strong");
      name.textContent = id;
      const details = document.createElement("span");
      details.textContent = `${definition.files.length} variant${definition.files.length === 1 ? "" : "s"} · catalogue gain ×${definition.volume ?? 1}`;
      meta.append(name, details);

      const actions = document.createElement("div");
      actions.className = "playtest-audio-actions";
      const eventButton = document.createElement("button");
      eventButton.type = "button";
      eventButton.className = "playtest-audio-play";
      eventButton.textContent = "▶ EVENT";
      eventButton.title = "Cycle through this event's variants";
      eventButton.addEventListener("click", () => this.playEvent(id));
      actions.appendChild(eventButton);

      definition.files.forEach((file, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "playtest-audio-variant";
        button.textContent = String(index + 1).padStart(2, "0");
        button.title = file;
        button.addEventListener("click", () => this.playVariant(id, index));
        actions.appendChild(button);
      });

      entry.append(meta, actions);
      list.appendChild(entry);
    }
  }

  async playEvent(id) {
    const definition = sampleAudioDefinition(id);
    if (!definition?.files?.length) return;
    const cursor = this.eventCursor[id] || 0;
    this.eventCursor[id] = (cursor + 1) % definition.files.length;
    await this.playVariant(id, cursor);
  }

  async playVariant(id, index) {
    const definition = sampleAudioDefinition(id);
    const file = definition?.files?.[index];
    if (!file) return;
    this.setStatus(`Loading ${id} · variant ${index + 1}/${definition.files.length}…`);

    try {
      const context = this.ensureContext();
      if (!context) throw new Error("Web Audio is unavailable in this browser");
      const buffer = await this.loadBuffer(file, context);
      if (context.state === "suspended") await context.resume();

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = Math.max(0, Number(definition.volume ?? 1)) * RAW_AUDIO_MASTER_GAIN * this.labVolume;
      source.connect(gain);
      gain.connect(context.destination);
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);
      source.start();
      this.setStatus(`Played ${id} · ${String(index + 1).padStart(2, "0")} · ${file} · preview ${Math.round(this.labVolume * 100)}%`);
    } catch (error) {
      this.setStatus(`ERROR · ${id} · ${error?.message || String(error)}`);
    }
  }

  ensureContext() {
    if (this.context) return this.context;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.context = new Ctx();
    return this.context;
  }

  loadBuffer(file, context) {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file));
    return fetch(file)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} loading ${file}`);
        return response.arrayBuffer();
      })
      .then(encoded => context.decodeAudioData(encoded))
      .then(buffer => {
        this.buffers.set(file, buffer);
        return buffer;
      });
  }

  open() {
    if (this.opened || !this.overlay) return;
    this.opened = true;
    this.overlay.hidden = false;
    this.launcher?.setAttribute("aria-expanded", "true");
    this.pausedByLab = Boolean(this.scene?.sys?.isActive?.());
    if (this.pausedByLab) this.scene.scene.pause();
    this.overlay.querySelector(".playtest-audio-play")?.focus();
  }

  close() {
    if (!this.opened) return;
    this.stopAll();
    this.opened = false;
    this.overlay.hidden = true;
    this.launcher?.setAttribute("aria-expanded", "false");
    if (this.pausedByLab) this.scene?.scene?.resume?.();
    this.pausedByLab = false;
    this.launcher?.focus();
  }

  toggle() {
    if (this.opened) this.close();
    else this.open();
  }

  stopAll() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources.clear();
  }

  handleKeyDown(event) {
    if (event.key === "F8") {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
      return;
    }
    if (event.key === "Escape" && this.opened) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  setStatus(text) {
    if (this.status) this.status.textContent = text;
  }

  destroy() {
    this.stopAll();
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.overlay?.remove();
    this.launcher?.remove();
    this.context?.close?.().catch?.(() => {});
  }
}
