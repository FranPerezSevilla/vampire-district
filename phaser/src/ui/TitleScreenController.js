import { loadInputBindings } from "../input/bindings.js";
import { buildControlReference } from "./ControlReference.js";

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const TITLE_BODY_CLASS = "viceblood-title-active";
const WORLD_BODY_CLASS = "viceblood-world-active";

const QUALITY_OPTIONS = Object.freeze([
  Object.freeze({ key: "compact", label: "LOW", detail: "960 × 640" }),
  Object.freeze({ key: "large", label: "HIGH", detail: "1280 × 853" }),
  Object.freeze({ key: "qhd", label: "VERY HIGH", detail: "1440 × 960" }),
  Object.freeze({ key: "ultra", label: "ULTRA", detail: "1920 × 1280" })
]);

function nextFrame(windowRef) {
  return new Promise(resolve => windowRef.requestAnimationFrame(resolve));
}

function waitForOpacityTransition(windowRef, element, timeoutMs = 500) {
  return new Promise(resolve => {
    if (!element || windowRef.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      windowRef.clearTimeout(timer);
      element.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = event => {
      if (event.target === element && event.propertyName === "opacity") finish();
    };
    const timer = windowRef.setTimeout(finish, timeoutMs);
    element.addEventListener("transitionend", onTransitionEnd);
  });
}

export class TitleScreenController {
  constructor({ documentRef = document, windowRef = window } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.root = documentRef.getElementById("viceblood-title-screen");
    this.menu = this.root?.querySelector("[data-title-menu]") || null;
    this.menuVeil = this.root?.querySelector(".viceblood-title-menu-veil") || null;
    this.drawer = this.root?.querySelector("[data-title-drawer]") || null;
    this.drawerTitle = this.root?.querySelector("[data-title-drawer-title]") || null;
    this.drawerBody = this.root?.querySelector("[data-title-drawer-body]") || null;
    this.drawerContent = this.root?.querySelector("[data-title-drawer-content]") || null;
    this.drawerHint = this.root?.querySelector("[data-title-drawer-hint]") || null;
    this.bootMessage = this.root?.querySelector("[data-title-boot-message]") || null;
    this.ensureControlsAction();
    this.menuButtons = this.root
      ? Array.from(this.root.querySelectorAll("[data-title-action]"))
      : [];
    this.qualityButtons = [];
    this.selectedIndex = Math.max(0, this.menuButtons.findIndex(button => button.dataset.titleAction === "new-night"));
    this.qualityIndex = 0;
    this.panelMode = null;
    this.state = "boot";
    this.inputLocked = true;
    this.onNewNight = null;
    this.presentationToken = 0;
    this.exitPromise = null;
    this.keyboardBound = false;
    this.boundKeydown = event => this.handleKeydown(event);

    this.buildQualityOptions();
    this.bindPointerInput();
    this.renderMenuSelection();
    this.publishState("boot");
  }

  ensureControlsAction() {
    if (!this.menu || this.root?.querySelector('[data-title-action="controls"]')) return;
    const nav = this.menu.querySelector(".viceblood-title-nav");
    if (!nav) return;
    const button = this.document.createElement("button");
    button.className = "viceblood-title-action";
    button.dataset.titleAction = "controls";
    button.type = "button";
    button.textContent = "Controls";
    const credits = nav.querySelector('[data-title-action="credits"]');
    nav.insertBefore(button, credits || null);
  }

  get available() {
    return Boolean(this.root && this.menu && this.drawer);
  }

  publishState(state = this.state, detail = null) {
    this.window.NBD_TITLE_SCREEN_STATE = Object.freeze({
      state,
      detail,
      available: this.available,
      timestamp: Date.now()
    });
  }

  buildQualityOptions() {
    if (!this.drawerContent) return;
    this.drawerContent.replaceChildren();
    const fragment = this.document.createDocumentFragment();

    this.qualityButtons = QUALITY_OPTIONS.map((option, index) => {
      const button = this.document.createElement("button");
      button.type = "button";
      button.className = "viceblood-title-quality";
      button.dataset.qualityKey = option.key;
      button.innerHTML = `
        <span class="viceblood-title-quality-marker" aria-hidden="true">›</span>
        <span class="viceblood-title-quality-label">${option.label}</span>
        <span class="viceblood-title-quality-detail">${option.detail}</span>
      `;
      button.addEventListener("pointerenter", () => {
        if (this.inputLocked || this.panelMode !== "options") return;
        this.qualityIndex = index;
        this.renderQualitySelection();
      });
      button.addEventListener("click", event => {
        event.preventDefault();
        if (this.inputLocked || this.panelMode !== "options") return;
        this.qualityIndex = index;
        this.renderQualitySelection();
        this.applySelectedQuality();
      });
      fragment.append(button);
      return button;
    });

    this.drawerContent.append(fragment);
  }

  bindPointerInput() {
    this.menuButtons.forEach((button, index) => {
      button.addEventListener("pointerenter", () => {
        if (this.inputLocked || this.panelMode || button.disabled) return;
        this.selectedIndex = index;
        this.renderMenuSelection();
      });
      button.addEventListener("click", event => {
        event.preventDefault();
        if (this.inputLocked || this.panelMode || button.disabled) return;
        this.selectedIndex = index;
        this.renderMenuSelection();
        this.activateSelected();
      });
    });
  }

  bindKeyboard() {
    if (this.keyboardBound) return;
    this.keyboardBound = true;
    this.window.addEventListener("keydown", this.boundKeydown, true);
  }

  unbindKeyboard() {
    if (!this.keyboardBound) return;
    this.keyboardBound = false;
    this.window.removeEventListener("keydown", this.boundKeydown, true);
  }

  async present({ onNewNight } = {}) {
    if (!this.available) throw new Error("ViceBlood title-screen markup is missing.");

    const token = ++this.presentationToken;
    this.onNewNight = typeof onNewNight === "function" ? onNewNight : null;
    this.state = "preparing";
    this.publishState("preparing");
    this.inputLocked = true;
    this.panelMode = null;
    this.exitPromise = null;
    this.root.hidden = false;
    if (this.bootMessage) this.bootMessage.textContent = "The city never sleeps";
    this.root.removeAttribute("data-panel");
    this.root.dataset.state = "prepared";
    this.root.setAttribute("aria-hidden", "false");
    this.menu.setAttribute("aria-hidden", "false");
    this.drawer.setAttribute("aria-hidden", "true");
    this.document.body.classList.remove(WORLD_BODY_CLASS);
    this.document.body.classList.add(TITLE_BODY_CLASS);
    this.renderMenuSelection();
    this.bindKeyboard();

    // Commit the already-positioned viewport UI while the boot cover is opaque.
    await nextFrame(this.window);
    await nextFrame(this.window);
    if (token !== this.presentationToken || this.state !== "preparing") return;

    this.state = "menu";
    this.root.dataset.state = "menu";
    this.inputLocked = false;
    this.publishState("menu");
  }

  async exitToGame() {
    if (!this.available || this.state === "disabled") return;
    if (this.state === "exiting") return this.exitPromise;

    this.state = "exiting";
    this.publishState("exiting");
    this.inputLocked = true;
    this.closePanel();
    this.unbindKeyboard();
    this.root.dataset.state = "exiting";
    this.root.setAttribute("aria-busy", "true");

    this.exitPromise = (async () => {
      await waitForOpacityTransition(this.window, this.menuVeil, 520);
      this.root.hidden = true;
      this.root.removeAttribute("aria-busy");
      this.root.setAttribute("aria-hidden", "true");
      this.document.body.classList.remove(TITLE_BODY_CLASS);
      this.document.body.classList.add(WORLD_BODY_CLASS);
      this.onNewNight = null;
      this.state = "world";
      this.publishState("world");
    })();

    return this.exitPromise;
  }

  disableForHarness() {
    this.presentationToken += 1;
    this.state = "disabled";
    this.publishState("disabled");
    this.inputLocked = true;
    this.onNewNight = null;
    this.unbindKeyboard();
    if (this.root) {
      this.root.hidden = true;
      this.root.dataset.state = "boot";
      this.root.setAttribute("aria-hidden", "true");
    }
    this.document.body.classList.remove(TITLE_BODY_CLASS, WORLD_BODY_CLASS);
  }

  resetToBoot() {
    if (!this.available || this.state === "disabled") return;
    this.presentationToken += 1;
    this.state = "boot";
    this.publishState("boot");
    this.inputLocked = true;
    this.onNewNight = null;
    this.closePanel();
    this.unbindKeyboard();
    this.root.hidden = false;
    if (this.bootMessage) this.bootMessage.textContent = "The city never sleeps";
    this.root.dataset.state = "boot";
    this.root.setAttribute("aria-hidden", "false");
    this.document.body.classList.remove(WORLD_BODY_CLASS);
    this.document.body.classList.add(TITLE_BODY_CLASS);
  }

  showFailure(error) {
    if (!this.available) return false;
    this.presentationToken += 1;
    this.state = "failure";
    const message = String(error?.message || error || "Unknown boot error");
    this.publishState("failure", message);
    this.inputLocked = true;
    this.onNewNight = null;
    this.unbindKeyboard();
    this.root.hidden = false;
    this.root.dataset.state = "failure";
    this.root.setAttribute("aria-hidden", "false");
    this.document.body.classList.remove(WORLD_BODY_CLASS);
    this.document.body.classList.add(TITLE_BODY_CLASS);
    if (this.bootMessage) {
      this.bootMessage.textContent = `VICEBLOOD COULD NOT START · ${message}`;
    }
    return true;
  }

  detachNewNightHandler() {
    this.onNewNight = null;
  }

  handleKeydown(event) {
    if (this.inputLocked || this.state !== "menu") return;
    const key = String(event.key || "").toLowerCase();
    const moveUp = key === "arrowup" || key === "w";
    const moveDown = key === "arrowdown" || key === "s";
    const activate = key === "enter" || key === " ";
    const back = key === "escape";
    if (!moveUp && !moveDown && !activate && !back) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.panelMode === "options") {
      if (moveUp) this.moveQualitySelection(-1);
      else if (moveDown) this.moveQualitySelection(1);
      else if (activate) this.applySelectedQuality();
      else if (back) this.closePanel();
      return;
    }

    if (this.panelMode === "controls" || this.panelMode === "credits") {
      if (activate || back) this.closePanel();
      return;
    }

    if (moveUp) this.moveMenuSelection(-1);
    else if (moveDown) this.moveMenuSelection(1);
    else if (activate) this.activateSelected();
  }

  moveMenuSelection(direction) {
    if (!this.menuButtons.length) return;
    let next = this.selectedIndex;
    do {
      next = (next + direction + this.menuButtons.length) % this.menuButtons.length;
    } while (this.menuButtons[next]?.disabled && next !== this.selectedIndex);
    this.selectedIndex = next;
    this.renderMenuSelection();
  }

  moveQualitySelection(direction) {
    if (!this.qualityButtons.length) return;
    this.qualityIndex = (this.qualityIndex + direction + this.qualityButtons.length) % this.qualityButtons.length;
    this.renderQualitySelection();
  }

  renderMenuSelection() {
    this.menuButtons.forEach((button, index) => {
      const selected = index === this.selectedIndex && !button.disabled;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-current", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
  }

  currentResolutionKey() {
    if (this.window.NBD_RESOLUTION_PRESET?.key) return this.window.NBD_RESOLUTION_PRESET.key;
    try {
      const saved = this.window.localStorage.getItem(RESOLUTION_STORAGE_KEY);
      if (QUALITY_OPTIONS.some(option => option.key === saved)) return saved;
    } catch {}
    return "qhd";
  }

  renderQualitySelection() {
    const activeKey = this.currentResolutionKey();
    this.qualityButtons.forEach((button, index) => {
      const selected = index === this.qualityIndex;
      const active = button.dataset.qualityKey === activeKey;
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
  }

  activateSelected() {
    const button = this.menuButtons[this.selectedIndex];
    if (!button || button.disabled) return;
    const action = button.dataset.titleAction;

    if (action === "new-night") {
      this.inputLocked = true;
      this.onNewNight?.();
      return;
    }
    if (action === "options") this.openOptions();
    else if (action === "controls") this.openControls();
    else if (action === "credits") this.openCredits();
  }

  openOptions() {
    this.panelMode = "options";
    const currentKey = this.currentResolutionKey();
    this.qualityIndex = Math.max(0, QUALITY_OPTIONS.findIndex(option => option.key === currentKey));
    this.drawerTitle.textContent = "OPTIONS";
    this.drawerBody.textContent = "Choose the internal render quality. Applying a change reloads the game.";
    this.drawerHint.textContent = "ENTER  APPLY     ESC  BACK";
    this.drawerContent.hidden = false;
    this.root.dataset.panel = "options";
    this.drawer.setAttribute("aria-hidden", "false");
    this.renderQualitySelection();
  }

  openControls() {
    this.panelMode = "controls";
    const bindings = loadInputBindings(this.window.localStorage);
    this.drawerTitle.textContent = "CONTROLS";
    this.drawerBody.textContent = buildControlReference(bindings);
    this.drawerHint.textContent = "ESC / ENTER  BACK";
    this.drawerContent.hidden = true;
    this.root.dataset.panel = "controls";
    this.drawer.setAttribute("aria-hidden", "false");
  }

  openCredits() {
    this.panelMode = "credits";
    this.drawerTitle.textContent = "CREDITS";
    this.drawerBody.textContent = "VICEBLOOD\n\nCreated by Fran Pérez Sevilla.\n\nDesign, code and direction by Frainzzel.\nBuilt with Phaser.";
    this.drawerHint.textContent = "ESC / ENTER  BACK";
    this.drawerContent.hidden = true;
    this.root.dataset.panel = "credits";
    this.drawer.setAttribute("aria-hidden", "false");
  }

  closePanel() {
    this.panelMode = null;
    if (!this.root) return;
    this.root.removeAttribute("data-panel");
    this.drawer?.setAttribute("aria-hidden", "true");
  }

  applySelectedQuality() {
    const option = QUALITY_OPTIONS[this.qualityIndex];
    if (!option) return;
    try {
      this.window.localStorage.setItem(RESOLUTION_STORAGE_KEY, option.key);
    } catch {}
    this.window.location.reload();
  }
}

export const titleScreenController = new TitleScreenController();
globalThis.NBD_TITLE_SCREEN = titleScreenController;
