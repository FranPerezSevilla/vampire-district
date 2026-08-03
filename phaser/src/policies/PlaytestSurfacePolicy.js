import { PlaytestUi } from "../playtest/PlaytestUi.js";
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

  intro.querySelector(".playtest-master-call")?.remove();

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

function showThoughtBubble(scene, text, { master = false, duration = 3000 } = {}) {
  if (!scene?.add || !scene?.player) return null;

  const label = scene.add.text(0, 0, text, {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13px",
    fontStyle: master ? "italic bold" : "italic",
    color: master ? "#f2d9ff" : "#f4eef8",
    align: "center",
    wordWrap: { width: 280, useAdvancedWrap: true },
    padding: { x: 14, y: 10 }
  }).setOrigin(0.5, 1).setResolution?.(3);

  const width = Math.max(190, label.width + 12);
  const height = label.height + 8;
  const background = scene.add.graphics();
  background.fillStyle(master ? 0x21152f : 0x10131b, 0.94);
  background.lineStyle(2, master ? 0xa75cff : 0xd8cfdf, 0.92);
  background.fillRoundedRect(-width / 2, -height, width, height, 10);
  background.strokeRoundedRect(-width / 2, -height, width, height, 10);
  background.fillTriangle(-10, 0, 10, 0, 0, 12);

  const bubble = scene.add.container(scene.player.x, scene.player.y - 34, [background, label]).setDepth(120);
  const follow = () => bubble?.active && bubble.setPosition(scene.player.x, scene.player.y - 34);
  scene.events?.on?.("update", follow);

  scene.time?.delayedCall?.(duration, () => {
    scene.events?.off?.("update", follow);
    bubble?.destroy?.(true);
  });
  return bubble;
}

function playMasterVoiceSequence(scene) {
  if (!scene || scene.__nbdMasterVoicePlayed) return;
  scene.__nbdMasterVoicePlayed = true;

  scene.time?.delayedCall?.(350, () => {
    showThoughtBubble(scene, "I feel my master's call... His voice is already inside my head.", {
      duration: 2900
    });
  });

  scene.time?.delayedCall?.(3450, () => {
    showThoughtBubble(scene, "You are too weak. Feed, then return to the refuge... but do not make the mistake of leaving witnesses.", {
      master: true,
      duration: 4200
    });
  });
}

export function installPlaytestSurfacePolicy() {
  watchForPlaytestIntro();

  if (!PlaytestUi.prototype.__nbdMasterVoiceAfterIntro) {
    const originalStart = PlaytestUi.prototype.start;
    PlaytestUi.prototype.start = function startWithMasterVoice() {
      const wasOpen = Boolean(this.intro?.classList.contains("open"));
      const result = originalStart.call(this);
      if (wasOpen) playMasterVoiceSequence(this.gameScene);
      return result;
    };
    Object.defineProperty(PlaytestUi.prototype, "__nbdMasterVoiceAfterIntro", { value: true });
  }

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
