import { createUiStore } from "../ui/UiStore.js";
import { gameUiReadMethods } from "../ui/GameUiReadModel.js";
import { cityMapGeometry, projectGameUi } from "../ui/GameUiProjection.js";
import { buildControlReference } from "../ui/ControlReference.js";
import { UX_STORAGE_KEYS, normalizeBooleanPreference } from "../data/ux-guidance.js";
import { domainDestination } from "../vampire/VampireDomainModel.js";
import { DOMAIN_TABS } from "../vampire/DomainNavigation.js";

const textEntry = node => /^(INPUT|SELECT|TEXTAREA)$/.test(node?.tagName || "") || node?.isContentEditable;
const activatable = node => Boolean(node?.closest?.("button,a,input,select,textarea,[role=tab],[role=button]"));

/** Phaser lifecycle/input facade; React alone renders the in-game interface. */
export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.store = createUiStore();
    this.introOpen = false;
    this.pauseOpen = false;
    this.resultOpen = false;
    this.resultType = null;
    this.resultDismissed = false;
    this.ledgerOpen = false;
    this.missionOpen = false;
    this.external = null;
    this.pendingAction = null;
    this.uiError = null;
    this.confirmation = null;
    this.ownsPause = false;
    this.nextRefresh = 0;
    this.notice = "";
    this.feedback = "";
    this.lastAction = "";
    this.noticeUntil = 0;
    this.ledgerRefreshAt = 0;
    this.renderUi = null;
  }
  create() {
    const root = document.getElementById("interface-root");
    const overlay = document.getElementById("ui-overlay-host");
    if (!root || !overlay || !globalThis.NBD_INTERFACE_VIEW?.mount) throw new Error("ViceBlood interface bundle was not prepared before gameplay.");
    this.dom = { root: document.getElementById("game-ui") };
    try {
      this.registry.set("aimHighContrast", normalizeBooleanPreference(localStorage.getItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST), false));
    } catch { this.registry.set("aimHighContrast", false); }
    this.renderUi = globalThis.NBD_INTERFACE_VIEW.mount(root, {
      store: this.store, geometry: cityMapGeometry, overlay,
      command: (type, payload) => this.command(type, payload),
      controls: buildControlReference(this.registry.get("inputBindings")?.bindings || {})
    });
    this.onDomKeyDown = event => this.handleDomKeyDown(event);
    window.addEventListener("keydown", this.onDomKeyDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.refresh();
  }
  game() { return this.scene.get("GameScene"); }
  activeMode() {
    if (this.uiError) return "error";
    if (this.external) return this.external.id;
    if (this.introOpen) return "intro";
    if (this.resultOpen) return "result";
    if (this.pauseOpen) return "pause";
    if (this.ledgerOpen) return "ledger";
    const menu = this.game()?.interactionSystem?.menu;
    return menu ? menu.view === "vampire-domain" ? "domain" : "interaction" : null;
  }
  update() {
    this.updateUiPause();
    const now = this.time?.now || 0;
    if (now < this.nextRefresh) return;
    this.nextRefresh = now + 100;
    this.refresh();
  }
  refresh() {
    const game = this.game();
    const action = game?.lastActionText || this.registry.get("lastActionText") || "";
    const now = this.time?.now || 0;
    if (action && action !== this.lastAction) {
      this.lastAction = action;
      this.notice = action;
      this.noticeUntil = now + 3600;
    } else if (now >= this.noticeUntil) this.notice = "";
    this.updateMissionResult(this.readState());
    this.updateUiPause();
    try { this.store.publish(projectGameUi(this)); }
    catch (error) {
      console.error("ViceBlood UI projection failed", error);
      this.store.publish({ ready: true, visible: true, mode: "error", error: String(error.message || error) });
      this.pauseOpen = true;
      this.updateUiPause();
    }
  }
  resetEdges() { this.game()?.inputSystem?.resetWorldEdges?.(); }
  updateUiPause() {
    const game = this.game();
    if (!game) return;
    const mode = this.activeMode();
    const blocked = Boolean(mode);
    // A domain menu pauses the scene but remains navigable. The service's
    // domainAvailable contract intentionally distinguishes it from a pause modal.
    const modal = blocked && !["domain", "interaction"].includes(mode);
    if (this.registry.get("uiPaused") !== modal) this.registry.set("uiPaused", modal);
    if (this.registry.get("uiKeyboardOwned") !== blocked) {
      this.registry.set("uiKeyboardOwned", blocked);
      this.resetEdges();
    }
    if (blocked && !this.ownsPause && !this.scene.isPaused("GameScene")) {
      this.scene.pause("GameScene");
      this.ownsPause = true;
    } else if (!blocked && this.ownsPause) {
      // Do not release another cinematic/external lock that is still active.
      const externalLock = ["campaignEntryOpen", "vehicleMaintenanceOpen"].some(key => this.registry.get(key));
      if (!externalLock) { this.scene.resume("GameScene"); this.ownsPause = false; this.resetEdges(); }
    }
  }
  cancelPendingAction() {
    if (!this.pendingAction) return;
    this.game()?.events?.off?.(Phaser.Scenes.Events.POST_UPDATE || "postupdate", this.pendingAction);
    this.pendingAction = null;
  }
  queueGameplayAction(action) {
    if (this.pendingAction || typeof action !== "function") return false;
    const game = this.game();
    // Execute after the existing authoritative frame has resumed, never fake a
    // worldEnabled flag just to satisfy a service guard while its scene is paused.
    const run = () => {
      if (this.pendingAction !== run) return;
      this.pendingAction = null;
      if (this.activeMode() || !game.currentInputFrame?.worldEnabled || game.inputSystem?.sceneBlocked?.()) return;
      try { action(); } catch (error) { this.feedback = String(error.message || error); }
      this.resetEdges(); this.refresh();
    };
    this.pendingAction = run;
    this.resetEdges();
    game.events.once(Phaser.Scenes.Events.POST_UPDATE || "postupdate", run);
    return true;
  }
  allowedToOpen() {
    const game = this.game();
    return Boolean(game?.player && !this.registry.get("mainMenuActive") && !this.registry.get("taskRevealActive")
      && !game.transitionSystem?.active && !game.playerDamageSystem?.isDead?.() && !this.external && !this.pendingAction);
  }
  openDomain(tab = "city", target = null) {
    if (!this.allowedToOpen() || this.resultOpen || this.introOpen) return false;
    this.pauseOpen = false;
    this.ledgerOpen = false;
    this.updateUiPause();
    const result = this.game().vampireRuntime?.openDomain(tab, target);
    this.resetEdges();
    this.refresh();
    return Boolean(result);
  }
  closeInteraction() {
    if (this.game()?.interactionSystem?.isOpen) this.game().interactionSystem.close("Back to the city.");
    this.confirmation = null;
    this.feedback = "";
    this.resetEdges();
    this.refresh();
    return true;
  }
  closeActive() {
    this.cancelPendingAction();
    if (this.confirmation) { this.confirmation = null; this.refresh(); return true; }
    if (this.external) return this.external.close?.() ?? false;
    if (this.pauseOpen) return this.closePause();
    if (this.ledgerOpen) return this.closeNightLedger();
    if (this.introOpen) { this.closeIntro(); return true; }
    if (this.resultOpen) return this.closeResult();
    return this.closeInteraction();
  }
  command(type, payload = {}) {
    const game = this.game(), runtime = game?.vampireRuntime;
    try {
      if (type === "ui-error") { this.uiError = String(payload.message || "Interface interrupted"); this.cancelPendingAction(); this.refresh(); return false; }
      if (this.pendingAction && type !== "pause" && type !== "close") return false;
      if (type === "close") return this.closeActive();
      if (type === "open") return this.openDomain(payload.tab, payload.target);
      if (type === "pause") return this.togglePause();
      if (type === "ledger") return this.toggleNightLedger();
      if (type === "contrast") {
        const value = !Boolean(this.registry.get("aimHighContrast"));
        this.registry.set("aimHighContrast", value);
        try { localStorage.setItem(UX_STORAGE_KEYS.AIM_HIGH_CONTRAST, String(value)); } catch {}
      } else if (type === "choose" && this.activeMode() === "interaction") {
        const menu = game.interactionSystem.menu;
        const option = menu.options.find(item => item.id === payload.id);
        if (!option || option.disabled) return false;
        // Resume through the existing frame so in-person service guards see a
        // genuine current frame, not the last locked frame from the menu.
        this.closeInteraction();
        return this.queueGameplayAction(() => game.interactionSystem.runOption(option));
      } else if (type === "tab" && this.activeMode() === "domain") {
        runtime.domain.navigate(payload.tab);
        this.confirmation = null;
      } else if (type === "select" && this.activeMode() === "domain") {
        runtime.domain.selection = payload.target;
      } else if (type === "locate" && this.activeMode() === "domain") {
        if (!domainDestination(runtime, payload.target)) return false;
        runtime.domain.navigate("city", payload.target);
      } else if (type === "go" && this.activeMode() === "domain") {
        if (!runtime.track(payload.target)) return false;
        this.closeInteraction();
      } else if (type === "save-marker" && this.activeMode() === "domain") {
        this.feedback = runtime.saveMarker(payload.target || null, payload.point || null)?.text || "Location saved.";
        runtime.domain.invalidate();
      } else if (type === "remove-marker" && this.activeMode() === "domain") {
        runtime.outcome(runtime.service.removeMarker(payload.id));
        runtime.domain.invalidate();
      } else if (type === "abandon" && this.activeMode() === "domain") {
        if (!runtime.service.state.job) return false;
        // Capture identity/stage: a confirmation must not abandon a replacement job.
        this.confirmation = { kind: "abandon", job: JSON.stringify(runtime.service.state.job) };
      } else if (type === "confirm-abandon" && this.confirmation?.kind === "abandon") {
        if (this.confirmation.job !== JSON.stringify(runtime.service.state.job)) return false;
        runtime.outcome(runtime.service.abandonDelivery());
        this.confirmation = null;
      } else if (type === "cancel-confirm") {
        this.confirmation = null;
      } else if (type === "blood" || type === "mend") {
        if (![null, "domain"].includes(this.activeMode())) return false;
        if (this.activeMode() === "domain") this.closeInteraction();
        // These remain guarded by VampireRuntime, including frenzy and feeding.
        return this.queueGameplayAction(() => type === "blood" ? runtime.useBlood() : runtime.mendBlood());
      } else if (type === "external") {
        return this.external?.command?.(payload);
      }
      this.resetEdges();
      this.refresh();
      return true;
    } catch (error) {
      this.feedback = String(error.message || error);
      this.refresh();
      return false;
    }
  }
  handleDomKeyDown(event) {
    if (event.repeat || event.defaultPrevented || textEntry(event.target) || this.registry.get("mainMenuActive")) return;
    const mode = this.activeMode();
    const finish = () => { event.preventDefault(); event.stopImmediatePropagation?.(); this.resetEdges(); };
    if (event.code === "Escape") {
      finish();
      if (mode) this.closeActive(); else this.togglePause();
      return;
    }
    // Native controls (including Radix tabs) own Enter/Space/arrow keys.
    if (activatable(event.target) && ["Enter", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
    if (mode === "interaction") {
      const interaction = this.game().interactionSystem, menu = interaction.menu;
      const digit = Number(event.code?.match(/^Digit([1-9])$/)?.[1]);
      if (digit && menu.options[digit - 1]) { finish(); this.command("choose", { id: menu.options[digit - 1].id }); }
      else if (["KeyE", "Enter"].includes(event.code)) { finish(); this.command("choose", { id: menu.options[menu.index]?.id }); }
      else if (["KeyW", "ArrowUp", "KeyS", "ArrowDown"].includes(event.code)) {
        finish();
        const direction = ["KeyW", "ArrowUp"].includes(event.code) ? -1 : 1;
        menu.index = (menu.index + direction + menu.options.length) % menu.options.length;
        interaction.publish(); this.refresh();
      }
      return;
    }
    if (mode === "domain") {
      const digit = Number(event.code?.match(/^Digit([1-6])$/)?.[1]);
      if (digit) { finish(); this.command("tab", { tab: DOMAIN_TABS[digit - 1].toLowerCase() }); return; }
    }
    if (!mode || mode === "domain" || mode === "ledger") {
      if (event.code === "KeyM") { finish(); this.toggleMissionDrawer(); }
      else if (event.code === "KeyL") { finish(); this.toggleNightLedger(); }
    }
  }
  modalBlocksInput() { return this.introOpen || this.pauseOpen || this.resultOpen || this.ledgerOpen || Boolean(this.external); }
  openModal(type) { if (type === "intro") return false; this.pauseOpen = type === "pause"; this.resultOpen = type === "result"; this.refresh(); return true; }
  closeIntro() { this.introOpen = false; this.refresh(); }
  togglePause() {
    this.cancelPendingAction();
    if (!this.allowedToOpen() || this.introOpen || this.resultOpen || this.external) return false;
    if (this.activeMode() === "domain" || this.activeMode() === "interaction") return this.closeInteraction();
    this.pauseOpen = !this.pauseOpen; this.ledgerOpen = false; this.refresh(); return true;
  }
  closePause() { this.pauseOpen = false; this.refresh(); return true; }
  toggleNightLedger() { return this.ledgerOpen ? this.closeNightLedger() : this.openNightLedger(); }
  openNightLedger() {
    if (!this.allowedToOpen() || this.resultOpen || this.introOpen) return false;
    if (this.game()?.interactionSystem?.isOpen) this.game().interactionSystem.close("Inspecting the city ledger.");
    this.pauseOpen = false; this.ledgerOpen = true; this.refresh(); return true;
  }
  closeNightLedger() { this.ledgerOpen = false; this.refresh(); return true; }
  toggleMissionDrawer() {
    if (this.activeMode() === "domain" && this.game()?.vampireRuntime?.domain.tab === "errand") return this.closeInteraction();
    return this.openDomain("errand");
  }
  closeMissionDrawer() { this.missionOpen = false; }
  updateMissionResult(data) {
    if (data.campaignMission?.status === "active" && !data.result) this.resultDismissed = false;
    if (data.result?.status === "failed") { this.resultOpen = true; this.resultType = "failure"; }
    else if (data.result?.status === "complete" && !this.resultDismissed) { this.resultOpen = true; this.resultType = "success"; }
  }
  openResult(type) { this.resultOpen = true; this.resultType = type; this.pauseOpen = false; this.ledgerOpen = false; this.refresh(); }
  closeResult() {
    if (this.resultType === "failure") return false;
    this.resultOpen = false; this.resultDismissed = true;
    this.events?.emit?.("ui:mission-result-dismissed", this.registry.get("missionResult") || {});
    this.refresh(); return true;
  }
  handleModalAction() { return this.closeActive(); }
  presentDialogue(payload) {
    this.hideDialogue();
    return new Promise(resolve => {
      const notBefore = performance.now() + 240;
      const finish = (force = false) => {
        if (!force && performance.now() < notBefore) return false;
        this.dialogueResolve = null;
        this.closeExternal("dialogue");
        this.resetEdges();
        resolve();
        return true;
      };
      this.dialogueResolve = () => finish(true);
      if (!this.openExternal({ id: "dialogue", read: () => payload, close: () => finish(), command: () => finish() })) {
        this.dialogueResolve = null;
        resolve();
      }
    });
  }
  hideDialogue() { this.dialogueResolve?.(); }
  openExternal(panel) {
    if (!panel?.id || this.external || this.pauseOpen || this.resultOpen || this.introOpen) return false;
    this.external = panel; this.refresh(); return true;
  }
  closeExternal(id) { if (this.external?.id !== id) return false; this.external = null; this.refresh(); return true; }
  cleanup() {
    this.cancelPendingAction();
    if (this.onDomKeyDown) window.removeEventListener("keydown", this.onDomKeyDown, true);
    this.hideDialogue();
    this.renderUi?.unmount?.(); this.store.destroy();
    this.registry.set("uiKeyboardOwned", false); this.registry.set("uiPaused", false);
    if (this.ownsPause) this.scene.resume("GameScene");
    this.ownsPause = false; this.resetEdges();
  }
}
Object.assign(UIScene.prototype, gameUiReadMethods);
