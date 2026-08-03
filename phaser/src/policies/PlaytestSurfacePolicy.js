import { UIScene } from "../scenes/UIScene.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";

const HIDDEN_TRAVERSAL_TYPES = new Set([
  "fireEscapeUp",
  "fireEscapeDown",
  "sewerDown",
  "sewerUp",
  "privateShaft",
  "roofJump",
  "roofDrop"
]);

function visibleInteractions(options = []) {
  return (Array.isArray(options) ? options : []).filter(option => !HIDDEN_TRAVERSAL_TYPES.has(option?.type));
}

function hideNode(node) {
  if (!node) return;
  node.hidden = true;
  node.setAttribute?.("aria-hidden", "true");
  node.style?.setProperty?.("display", "none", "important");
}

function removeUnavailableHelp(body) {
  if (!body) return;
  const html = String(body.innerHTML || "")
    .replace(/\s*Traversal:[\s\S]*?<br>\s*/i, "")
    .replace(/\s*·\s*L Night Ledger/gi, "")
    .replace(/\s*L Night Ledger\s*·?/gi, "");
  if (html !== body.innerHTML) body.innerHTML = html;
}

function enhancePlaytestIntro(root = document) {
  const intro = root.querySelector?.("#playtest-intro");
  if (!intro || intro.dataset.controlsEnhanced === "true") return false;

  const lead = intro.querySelector(".playtest-lead");
  if (lead && !intro.querySelector(".playtest-master-call")) {
    const masterCall = document.createElement("blockquote");
    masterCall.className = "playtest-master-call";
    masterCall.style.margin = "16px 0";
    masterCall.style.padding = "11px 14px";
    masterCall.style.borderLeft = "3px solid #a75cff";
    masterCall.style.background = "rgba(167, 92, 255, .08)";
    masterCall.style.color = "#eee5ff";
    masterCall.style.lineHeight = "1.55";
    masterCall.innerHTML = `<span style="display:block;margin-bottom:5px;color:#b8a8ca;font-size:12px;font-style:italic">I feel my master calling. His voice is already inside my head.</span><strong style="color:#f2d9ff;font-style:italic">“You are too weak. Feed, then return to the refuge... but do not make the mistake of leaving witnesses.”</strong>`;
    lead.insertAdjacentElement("afterend", masterCall);
  }

  const grid = intro.querySelector(".playtest-control-grid");
  if (grid) {
    grid.innerHTML = `
      <span><kbd>WASD</kbd> Move</span>
      <span><kbd>LMB</kbd> Attack</span>
      <span><kbd>RMB</kbd> Hold to feed</span>
      <span><kbd>WHEEL</kbd> Change weapon</span>
      <span><kbd>R</kbd> Whisper</span>
      <span><kbd>F</kbd> Blood Sense</span>
      <span><kbd>ENTER</kbd> Enter / leave vehicle</span>
      <span><kbd>H</kbd> Pause + full controls</span>
    `;
  }

  const note = intro.querySelector(".playtest-note");
  if (note) {
    note.innerHTML = `Experiment with weapons, feeding depths, vehicles and vampiric powers. Press <kbd>H</kbd> at any time to reopen the pause menu and review every control.`;
  }

  intro.dataset.controlsEnhanced = "true";
  return true;
}

function watchForPlaytestIntro() {
  if (typeof document === "undefined") return;
  if (enhancePlaytestIntro(document)) return;
  const observer = new MutationObserver(() => {
    if (!enhancePlaytestIntro(document)) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function installPlaytestSurfacePolicy() {
  watchForPlaytestIntro();

  if (!InteractionSystem.prototype.__nbdHiddenTraversalPolicy) {
    const originalSortOptions = InteractionSystem.prototype.sortOptions;
    InteractionSystem.prototype.sortOptions = function hiddenTraversalSort(options = []) {
      return originalSortOptions.call(this, visibleInteractions(options));
    };

    const originalOpen = InteractionSystem.prototype.open;
    InteractionSystem.prototype.open = function hiddenTraversalOpen(options = []) {
      const visible = visibleInteractions(options);
      if (!visible.length) return false;
      return originalOpen.call(this, visible);
    };

    const originalRunOption = InteractionSystem.prototype.runOption;
    InteractionSystem.prototype.runOption = function hiddenTraversalRun(option) {
      if (HIDDEN_TRAVERSAL_TYPES.has(option?.type)) return false;
      return originalRunOption.call(this, option);
    };

    Object.defineProperty(InteractionSystem.prototype, "__nbdHiddenTraversalPolicy", { value: true });
  }

  if (!UIScene.prototype.__nbdSimplifiedSurfacePolicy) {
    const originalBindDom = UIScene.prototype.bindDom;
    UIScene.prototype.bindDom = function simplifiedBindDom() {
      const result = originalBindDom.call(this);
      hideNode(this.dom?.ledgerButton);
      hideNode(this.dom?.ledgerBadge);
      hideNode(this.dom?.ledger);
      hideNode(this.dom?.ledgerScrim);
      this.ledgerOpen = false;
      return result;
    };

    const originalHandleDomKeyDown = UIScene.prototype.handleDomKeyDown;
    UIScene.prototype.handleDomKeyDown = function simplifiedKeyDown(event) {
      if (event?.code === "KeyL") {
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
      }
      return originalHandleDomKeyDown.call(this, event);
    };

    UIScene.prototype.toggleNightLedger = function hiddenLedgerToggle() {
      this.ledgerOpen = false;
      return false;
    };
    UIScene.prototype.openNightLedger = function hiddenLedgerOpen() {
      this.ledgerOpen = false;
      return false;
    };

    const originalRenderNightLedger = UIScene.prototype.renderNightLedger;
    UIScene.prototype.renderNightLedger = function hiddenLedgerRender(model) {
      this.ledgerOpen = false;
      hideNode(this.dom?.ledger);
      hideNode(this.dom?.ledgerScrim);
      return originalRenderNightLedger.call(this, model);
    };

    const originalRenderModal = UIScene.prototype.renderModal;
    UIScene.prototype.renderModal = function simplifiedHelpModal(data) {
      const result = originalRenderModal.call(this, data);
      removeUnavailableHelp(this.dom?.modalBody);
      return result;
    };

    Object.defineProperty(UIScene.prototype, "__nbdSimplifiedSurfacePolicy", { value: true });
  }
}
