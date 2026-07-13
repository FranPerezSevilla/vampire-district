(() => {
  "use strict";

  const EVENT_LABELS = {
    footstep: "Footstep",
    sprintStep: "Sprint step",
    drag: "Drag body",
    dash: "Shadow Dash",
    whisper: "Whisper",
    sense: "Blood Sense",
    feedStart: "Feed start",
    feedFinish: "Feed finish",
    brutalFeed: "Brutal feed",
    glass: "Glass / lamp break",
    rooftopJump: "Rooftop jump",
    roofDrop: "Roof drop",
    landingLight: "Light landing",
    landingHeavy: "Heavy landing",
    alert: "Alert",
    police: "Police response",
    hunterReveal: "Hunter reveal",
    bodyHide: "Body hidden",
    missionComplete: "Mission complete"
  };

  let installed = false;

  function pct(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function make(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.appendChild(child);
    return node;
  }

  function settings() {
    return window.VD_ASSET_AUDIO?.getSettings?.() || { enabled: true, masterVolume: 0.85, sfxVolume: 0.9 };
  }

  function updateMeta(root) {
    const lib = window.VD_ASSET_AUDIO?.library || window.VD_AUDIO_LIBRARY || { all: [], unmapped: [] };
    const mapped = window.VD_ASSET_AUDIO?.mappedEvents?.() || [];
    const mappedCount = mapped.filter((item) => item.files.length > 0).length;
    const totalFiles = Array.isArray(lib.all) ? lib.all.length : 0;
    const generated = lib.generatedAt || "not generated yet";
    const meta = root.querySelector("#vdSoundMeta");
    if (meta) {
      meta.textContent = `${mappedCount}/19 events mapped · ${totalFiles} repo audio files · manifest: ${generated}`;
    }

    root.querySelectorAll("[data-sound-event]").forEach((button) => {
      const eventName = button.dataset.soundEvent;
      const files = window.VD_ASSET_AUDIO?.eventFiles?.(eventName) || [];
      button.disabled = files.length === 0;
      const small = button.querySelector("small");
      if (small) small.textContent = files.length ? `${files.length} asset${files.length === 1 ? "" : "s"}` : "not mapped";
    });
  }

  function setActiveTab(tabName) {
    const helpBody = document.querySelector("#vdHelpOverlay .vd-help-body");
    const soundPanel = document.getElementById("vdSoundPanel");
    const helpTab = document.getElementById("vdTabHelp");
    const soundTab = document.getElementById("vdTabSound");
    if (!helpBody || !soundPanel || !helpTab || !soundTab) return;

    const showingSound = tabName === "sound";
    helpBody.classList.toggle("hidden", showingSound);
    soundPanel.classList.toggle("hidden", !showingSound);
    helpTab.classList.toggle("active", !showingSound);
    soundTab.classList.toggle("active", showingSound);
    helpTab.setAttribute("aria-selected", showingSound ? "false" : "true");
    soundTab.setAttribute("aria-selected", showingSound ? "true" : "false");
    if (showingSound) updateMeta(soundPanel);
  }

  function createSlider(label, id, value, onInput) {
    const valueNode = make("span", { class: "vd-sound-value", text: pct(value) });
    const input = make("input", {
      id,
      type: "range",
      min: "0",
      max: "1",
      step: "0.01",
      value: String(value)
    });
    input.addEventListener("input", () => {
      valueNode.textContent = pct(input.value);
      onInput(Number(input.value));
    });
    return make("label", { class: "vd-sound-slider" }, [
      make("span", { text: label }),
      input,
      valueNode
    ]);
  }

  function createSoundPanel() {
    const current = settings();
    const enabled = make("input", { id: "vdSoundEnabled", type: "checkbox" });
    enabled.checked = current.enabled;
    enabled.addEventListener("change", () => {
      window.VD_ASSET_AUDIO?.setSettings?.({ enabled: enabled.checked });
    });

    const eventButtons = make("div", { class: "vd-sound-grid" });
    for (const name of window.VD_AUDIO_EVENTS || Object.keys(EVENT_LABELS)) {
      const button = make("button", { class: "vd-sound-test", type: "button", "data-sound-event": name }, [
        make("span", { text: EVENT_LABELS[name] || name }),
        make("small", { text: "checking..." })
      ]);
      button.addEventListener("click", () => window.VD_ASSET_AUDIO?.play?.(name, 1, { force: true }));
      eventButtons.appendChild(button);
    }

    const panel = make("section", { id: "vdSoundPanel", class: "vd-sound-panel hidden", "aria-label": "Sound configuration" }, [
      make("div", { class: "vd-sound-head" }, [
        make("div", {}, [
          make("p", { class: "vd-help-eyebrow", text: "Sound config" }),
          make("h3", { class: "vd-sound-title", text: "Audio troubleshooting" })
        ]),
        make("label", { class: "vd-sound-toggle" }, [
          enabled,
          make("span", { text: "Audio enabled" })
        ])
      ]),
      make("p", { class: "vd-sound-muted", text: "These buttons play the same event names used by the game. If a button is disabled, the manifest could not map an uploaded Kenney file to that event yet." }),
      make("div", { class: "vd-sound-controls" }, [
        createSlider("Master", "vdMasterVolume", current.masterVolume, (value) => window.VD_ASSET_AUDIO?.setSettings?.({ masterVolume: value })),
        createSlider("SFX", "vdSfxVolume", current.sfxVolume, (value) => window.VD_ASSET_AUDIO?.setSettings?.({ sfxVolume: value }))
      ]),
      make("div", { id: "vdSoundMeta", class: "vd-sound-meta", text: "Loading manifest..." }),
      eventButtons
    ]);

    return panel;
  }

  function install() {
    if (installed) return;
    const panel = document.querySelector("#vdHelpOverlay .vd-help-panel");
    const body = document.querySelector("#vdHelpOverlay .vd-help-body");
    if (!panel || !body) return;
    installed = true;

    const tabs = make("div", { class: "vd-help-tabs", role: "tablist", "aria-label": "Pause menu tabs" }, [
      make("button", { id: "vdTabHelp", class: "vd-help-tab active", type: "button", role: "tab", "aria-selected": "true", text: "Help" }),
      make("button", { id: "vdTabSound", class: "vd-help-tab", type: "button", role: "tab", "aria-selected": "false", text: "Sound config" })
    ]);
    panel.insertBefore(tabs, body);
    panel.insertBefore(createSoundPanel(), body.nextSibling);

    tabs.querySelector("#vdTabHelp").addEventListener("click", () => setActiveTab("help"));
    tabs.querySelector("#vdTabSound").addEventListener("click", () => setActiveTab("sound"));
    updateMeta(document.getElementById("vdSoundPanel"));

    window.addEventListener("vd-audio-settings-changed", () => updateMeta(document.getElementById("vdSoundPanel")));
    window.addEventListener("vd-audio-manifest-ready", () => updateMeta(document.getElementById("vdSoundPanel")));
  }

  function init() {
    install();
    if (!installed) {
      const timer = setInterval(() => {
        install();
        if (installed) clearInterval(timer);
      }, 200);
      setTimeout(() => clearInterval(timer), 8000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
