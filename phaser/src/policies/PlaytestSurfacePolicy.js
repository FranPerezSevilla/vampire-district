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

export function installPlaytestSurfacePolicy() {
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
