const POWER_CONFIG = Object.freeze({
  dash: { label: "Dash", max: 3.0 },
  whisper: { label: "Whisper", max: 4.8 },
  sense: { label: "Sense", max: 4.0 }
});

const WANTED_LABELS = Object.freeze({
  0: "CLEAR",
  1: "SEARCH",
  2: "PURSUIT",
  3: "AIR SUPPORT"
});

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.introOpen = true;
    this.pauseOpen = false;
    this.resultOpen = false;
    this.resultType = null;
    this.resultDismissed = false;
    this.missionOpen = false;
    this.lastToastText = "";
    this.toastUntil = 0;
  }

  create() {
    this.keys = this.input.keyboard.addKeys({
      help: Phaser.Input.Keyboard.KeyCodes.H,
      mission: Phaser.Input.Keyboard.KeyCodes.M,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    this.bindDom();
    this.openModal("intro");
    this.updateUiPause();
  }

  bindDom() {
    const $ = id => document.getElementById(id);
    this.dom = {
      root: $("game-ui"),
      vitals: document.querySelector(".hud-vitals"),
      hungerValue: $("hud-hunger-value"),
      hungerFill: $("hud-hunger-fill"),
      wanted: $("hud-wanted"),
      wantedState: $("hud-wanted-state"),
      wantedPips: [...document.querySelectorAll("[data-wanted-pip]")],
      missionButton: $("hud-mission-button"),
      missionStep: $("hud-mission-step"),
      menuButton: $("hud-menu-button"),
      missionDrawer: $("mission-drawer"),
      missionCurrent: $("mission-current"),
      missionChecklist: $("mission-checklist"),
      missionLast: $("mission-last"),
      prompt: $("hud-prompt"),
      promptText: $("hud-prompt-text"),
      toast: $("hud-toast"),
      toastText: $("hud-toast-text"),
      interactionMenu: $("interaction-menu"),
      modal: $("ui-modal"),
      modalTitle: $("ui-modal-title"),
      modalBody: $("ui-modal-body"),
      modalAction: $("ui-modal-action"),
      powers: {
        dash: document.querySelector('[data-power="dash"]'),
        whisper: document.querySelector('[data-power="whisper"]'),
        sense: document.querySelector('[data-power="sense"]')
      }
    };

    this.dom.missionButton?.addEventListener("pointerdown", event => {
      event.preventDefault();
      this.toggleMissionDrawer();
    });
    this.dom.menuButton?.addEventListener("pointerdown", event => {
      event.preventDefault();
      this.togglePause();
    });
    this.dom.modalAction?.addEventListener("pointerdown", event => {
      event.preventDefault();
      this.handleModalAction();
    });
  }

  update() {
    const data = this.readState();
    this.updateMissionResult(data);
    this.handleKeys();
    this.renderHud(data);
    this.renderMission(data);
    this.renderPowers(data.powersText);
    this.renderPrompt(data);
    this.renderInteractionMenu(data.menu);
    this.renderModal(data);
    this.updateUiPause();
  }

  readState() {
    const get = (key, fallback = "") => this.registry.get(key) || fallback;
    return {
      mission: get("missionText", "Objective unavailable"),
      visibility: get("visibilityText", "Visibility unknown"),
      exposureText: get("exposureText", "Exposure unavailable"),
      policeText: get("policeText", "Police unavailable"),
      witnessText: get("witnessText", "Witnesses unavailable"),
      hunterText: get("hunterText", "Hunters dormant"),
      evidenceText: get("evidenceText", "Evidence unavailable"),
      npcText: get("npcText", "NPCs unavailable"),
      hungerText: get("hungerText", "Hunger unavailable"),
      powersText: get("powersText", "Powers unavailable"),
      xy: get("playerXY", "0, 0"),
      prompt: get("interactionPrompt", ""),
      lastAction: get("lastActionText", ""),
      menu: this.registry.get("interactionMenu") || null,
      result: this.registry.get("missionResult") || null
    };
  }

  handleKeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      if (this.introOpen) this.closeIntro();
      else if (this.resultOpen && this.resultType === "success") this.closeResult();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.mission) && !this.modalBlocksInput()) {
      this.toggleMissionDrawer();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.help) && !this.resultOpen && !this.introOpen) {
      this.togglePause();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
      if (this.resultOpen && this.resultType === "success") this.closeResult();
      else if (this.pauseOpen) this.closePause();
      else if (this.missionOpen) this.closeMissionDrawer();
      else if (this.introOpen) this.closeIntro();
    }
  }

  renderHud(data) {
    const hunger = this.hungerPercent(data.hungerText);
    this.setText(this.dom.hungerValue, `${Math.round(hunger)}%`);
    if (this.dom.hungerFill) this.dom.hungerFill.style.width = `${Phaser.Math.Clamp(hunger, 0, 100)}%`;

    const hungerState = hunger >= 78 ? "critical" : hunger >= 52 ? "warning" : "safe";
    if (this.dom.vitals) this.dom.vitals.dataset.hungerState = hungerState;

    const wantedLevel = this.wantedLevel(data.exposureText);
    if (this.dom.wanted) {
      this.dom.wanted.classList.remove("level-0", "level-1", "level-2", "level-3");
      this.dom.wanted.classList.add(`level-${wantedLevel}`);
    }
    this.setText(this.dom.wantedState, WANTED_LABELS[wantedLevel]);
    for (const pip of this.dom.wantedPips) {
      const pipLevel = Number(pip.dataset.wantedPip || 0);
      pip.classList.toggle("active", pipLevel <= wantedLevel);
    }

    this.dom.root?.classList.toggle("hunger-critical", hungerState === "critical");
    this.dom.root?.classList.toggle("wanted-high", wantedLevel >= 2);
    this.dom.root?.classList.toggle("wanted-air", wantedLevel >= 3);

    this.dom.missionButton?.classList.toggle("active", this.missionOpen);
    this.dom.menuButton?.classList.toggle("active", this.pauseOpen);
    this.setText(this.dom.missionStep, this.missionProgressLabel(data.mission));
  }

  renderMission(data) {
    this.dom.missionDrawer?.classList.toggle("open", this.missionOpen && !this.modalBlocksInput());
    this.setText(this.dom.missionCurrent, data.mission);
    this.setText(this.dom.missionLast, data.lastAction && data.lastAction !== data.mission ? `Last: ${data.lastAction}` : "");

    if (!this.dom.missionChecklist) return;
    this.dom.missionChecklist.innerHTML = "";
    for (const item of this.missionChecklist(data.mission, data.lastAction)) {
      const li = document.createElement("li");
      li.className = item.state;
      li.textContent = `${item.icon} ${item.text}`;
      this.dom.missionChecklist.appendChild(li);
    }
  }

  renderPowers(powersText) {
    const text = String(powersText || "");
    for (const [id, cfg] of Object.entries(POWER_CONFIG)) {
      const node = this.dom.powers[id];
      if (!node) continue;
      const remaining = this.cooldownFor(text, cfg.label);
      node.classList.toggle("cooldown", remaining > 0);
      const state = node.querySelector(".power-state");
      if (state) state.textContent = remaining > 0 ? `${remaining.toFixed(1)}s` : "Ready";
    }
  }

  renderPrompt(data) {
    const hasMenu = Boolean(data.menu && data.menu.options?.length);
    const prompt = !this.modalBlocksInput() && !hasMenu ? data.prompt : "";
    const cleanPrompt = prompt.replace(/^E:\s*/i, "");
    this.setText(this.dom.promptText, cleanPrompt);
    this.dom.prompt?.classList.toggle("visible", Boolean(cleanPrompt));

    const toast = !this.modalBlocksInput() && data.lastAction ? data.lastAction : "";
    if (toast && toast !== this.lastToastText) {
      this.lastToastText = toast;
      this.toastUntil = this.time.now + 2800;
      this.setText(this.dom.toastText, toast);
    }
    const toastVisible = !this.modalBlocksInput() && Boolean(this.dom.toastText?.textContent) && this.time.now < this.toastUntil;
    this.dom.toast?.classList.toggle("visible", toastVisible);
  }

  renderInteractionMenu(menu) {
    const open = !this.modalBlocksInput() && Boolean(menu && menu.options && menu.options.length);
    if (!this.dom.interactionMenu) return;
    this.dom.interactionMenu.classList.toggle("open", open);
    if (!open) {
      this.dom.interactionMenu.innerHTML = "";
      return;
    }

    const rows = menu.options.slice(0, 9).map((option, index) => {
      const selected = index === menu.index ? " selected" : "";
      const detail = option.detail || option.type || "action";
      return `<div class="interaction-row${selected}"><span>${index + 1}. ${this.escapeHtml(option.label)}</span><small>${this.escapeHtml(detail)}</small></div>`;
    }).join("");

    this.dom.interactionMenu.innerHTML = `
      <h3>Choose interaction</h3>
      <p>W/S or arrows · E/Enter confirm · Esc cancel · 1-9 quick select</p>
      ${rows}
    `;
  }

  renderModal(data) {
    const modalOpen = this.introOpen || this.pauseOpen || this.resultOpen;
    this.dom.modal?.classList.toggle("open", modalOpen);
    if (!modalOpen) return;

    if (this.introOpen) {
      this.setModal(
        "Night Blood District",
        `<p><strong>You are a vampire fixer for the clan.</strong> A journalist is close to exposing what hunts this district. If civilians understand the truth, the veil breaks and the run is over.</p>
         <p>First task: cross rooftops, neutralize the thug blocking the jump to the police station roof, and collect the informant tip. Then find the journalist near the nightclub, isolate them, and clean the scene.</p>
         <p>Controls: WASD/arrows move · Shift sprint · E interact · Q/Space Dash · R Whisper · F Blood Sense · M Mission · H Menu.</p>`,
        "Start run · Enter"
      );
      return;
    }

    if (this.resultOpen) {
      const failure = this.resultType === "failure";
      const title = failure ? (data.result?.title || "MISSION FAILED") : "MISSION COMPLETE";
      const intro = failure
        ? (data.result?.subtitle || "The run is over and control is locked.")
        : "The journalist is handled and the vampire clan can still contain the district.";
      this.setModal(title, `<p>${this.escapeHtml(intro)}</p><pre>${this.escapeHtml(this.statsText(data))}</pre>`, failure ? "Reload page to restart" : "Continue free roam · Enter/Esc");
      return;
    }

    if (this.pauseOpen) {
      this.setModal(
        "Pause Menu",
        `<p><strong>Controls</strong><br>Movement: WASD/arrows · Shift sprint<br>Interact: E near routes, targets, bodies, witnesses, lamps<br>Powers: Q/Space Dash · R Whisper · F Blood Sense<br>Mission: M toggles active task drawer</p>
         <p><strong>Stats</strong></p><pre>${this.escapeHtml(this.statsText(data))}</pre>`,
        "Close · H / Esc"
      );
    }
  }

  setModal(title, bodyHtml, actionLabel) {
    this.setText(this.dom.modalTitle, title);
    if (this.dom.modalBody) this.dom.modalBody.innerHTML = bodyHtml;
    this.setText(this.dom.modalAction, actionLabel);
  }

  handleModalAction() {
    if (this.introOpen) this.closeIntro();
    else if (this.pauseOpen) this.closePause();
    else if (this.resultOpen && this.resultType === "success") this.closeResult();
  }

  updateMissionResult(data) {
    const result = data.result;
    const mission = String(data.mission || "");
    if (result?.status === "failed" || mission.startsWith("FAILED")) {
      if (!this.resultOpen || this.resultType !== "failure") this.openResult("failure");
      return;
    }
    if ((result?.status === "complete" || mission.startsWith("COMPLETE")) && !this.resultDismissed) {
      if (!this.resultOpen || this.resultType !== "success") this.openResult("success");
    }
  }

  openModal(type) {
    this.introOpen = type === "intro";
    this.pauseOpen = type === "pause";
    this.resultOpen = type === "result";
  }

  closeIntro() {
    this.introOpen = false;
    this.updateUiPause();
  }

  togglePause() {
    if (this.introOpen || this.resultOpen) return;
    this.pauseOpen = !this.pauseOpen;
    if (this.pauseOpen) this.closeMissionDrawer();
    this.updateUiPause();
  }

  closePause() {
    this.pauseOpen = false;
    this.updateUiPause();
  }

  openResult(type) {
    this.resultOpen = true;
    this.resultType = type;
    this.pauseOpen = false;
    this.missionOpen = false;
    if (type === "failure") this.resultDismissed = false;
    this.updateUiPause();
  }

  closeResult() {
    if (this.resultType === "failure") return;
    this.resultOpen = false;
    this.resultType = null;
    this.resultDismissed = true;
    this.updateUiPause();
  }

  toggleMissionDrawer() {
    if (this.modalBlocksInput()) return;
    this.missionOpen = !this.missionOpen;
  }

  closeMissionDrawer() {
    this.missionOpen = false;
  }

  modalBlocksInput() {
    return this.introOpen || this.pauseOpen || this.resultOpen;
  }

  updateUiPause() {
    const paused = this.introOpen || this.pauseOpen || this.resultOpen;
    this.registry.set("uiPaused", paused);
    if (paused) this.scene.pause("GameScene");
    else this.scene.resume("GameScene");
  }

  hungerPercent(text) {
    const match = String(text).match(/Hunger\s+([0-9.]+)%/i);
    return Phaser.Math.Clamp(Number.parseFloat(match?.[1] || "0") || 0, 0, 100);
  }

  wantedLevel(text) {
    const match = String(text).match(/Exposure\s+Lv\s*([0-9]+)/i);
    return Phaser.Math.Clamp(Number.parseInt(match?.[1] || "0", 10) || 0, 0, 3);
  }

  missionProgressLabel(text) {
    const value = String(text || "");
    const match = value.match(/^(\d\/4)/);
    if (match) return match[1];
    if (value.startsWith("COMPLETE")) return "DONE";
    if (value.startsWith("FAILED")) return "FAIL";
    return "1/4";
  }

  cooldownFor(text, label) {
    const match = String(text).match(new RegExp(`${label}\\s+(ready|[0-9.]+)`, "i"));
    if (!match || match[1].toLowerCase() === "ready") return 0;
    return Number.parseFloat(match[1]) || 0;
  }

  missionChecklist(missionText, lastAction) {
    const text = String(missionText || "");
    const last = String(lastAction || "");
    const step = this.missionStep(text);
    return [
      { text: "Cross rooftops toward the police station", state: step > 0 ? "done" : "active" },
      { text: "Neutralize the rooftop blocker", state: step > 0 || /thug neutralized|blocker neutralized|jump path open/i.test(last) ? "done" : "active" },
      { text: "Collect the informant tip", state: step > 0 ? "done" : "todo" },
      { text: "Find the journalist near the nightclub", state: step > 1 ? "done" : step === 1 ? "active" : "todo" },
      { text: "Neutralize the journalist without breaking the veil", state: step > 2 ? "done" : step === 2 ? "active" : "todo" },
      { text: "Return to the rooftop refuge", state: step > 3 ? "done" : step === 3 ? "active" : "todo" }
    ].map(item => ({ ...item, icon: item.state === "done" ? "✓" : item.state === "active" ? "▸" : "○" }));
  }

  missionStep(text) {
    const match = String(text).match(/^(\d)\/4/);
    if (match) return Math.max(0, Number(match[1]) - 1);
    if (text.startsWith("COMPLETE")) return 4;
    if (text.startsWith("FAILED")) return 4;
    return 0;
  }

  statsText(data) {
    return `Objective: ${data.mission}\n` +
      `Visibility: ${data.visibility}\n` +
      `${data.hungerText}\n` +
      `${data.exposureText}\n` +
      `${data.powersText}\n` +
      `${data.policeText}\n` +
      `${data.hunterText}\n` +
      `${data.witnessText}\n` +
      `${data.evidenceText}\n` +
      `NPCs: ${data.npcText}\n` +
      `Position: ${data.xy}\n` +
      `Last: ${data.lastAction || "--"}`;
  }

  setText(node, text) {
    if (node && node.textContent !== String(text || "")) node.textContent = String(text || "");
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
