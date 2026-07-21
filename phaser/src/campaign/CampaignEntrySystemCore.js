import {
  CAMPAIGN_ENTRY_ACTIONS,
  CAMPAIGN_ENTRY_MODES,
  CAMPAIGN_ENTRY_SESSION_KEY
} from "./CampaignEntry.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

const STYLE_ID = "nbd-campaign-entry-style";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .campaign-entry {
      position: absolute;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 20px;
      background:
        radial-gradient(circle at 50% 18%, rgba(82, 41, 105, .28), transparent 44%),
        rgba(3, 4, 8, .88);
      pointer-events: auto;
    }
    .campaign-entry-panel {
      width: min(720px, 100%);
      max-height: calc(100% - 12px);
      overflow-y: auto;
      padding: 28px;
      border: 1px solid rgba(226, 214, 255, .28);
      border-top: 2px solid #a75cff;
      background: linear-gradient(145deg, rgba(18, 20, 32, .98), rgba(6, 7, 12, .97));
      box-shadow: 0 24px 90px rgba(0, 0, 0, .65), inset 0 1px rgba(255, 255, 255, .04);
      clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
    }
    .campaign-entry-eyebrow {
      margin: 0 0 7px;
      color: #ffb02e;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .14em;
    }
    .campaign-entry h2 {
      margin: 0 0 16px;
      color: #f4ecff;
      font-size: clamp(26px, 5vw, 40px);
      line-height: 1;
    }
    .campaign-entry-copy {
      color: #d7c8ff;
      font-size: 14px;
      line-height: 1.58;
    }
    .campaign-entry-copy p { margin: 0 0 12px; }
    .campaign-entry-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 8px;
      margin: 18px 0;
    }
    .campaign-entry-detail {
      min-width: 0;
      padding: 9px 10px;
      border: 1px solid rgba(120, 199, 163, .16);
      background: rgba(120, 199, 163, .045);
    }
    .campaign-entry-detail small {
      display: block;
      margin-bottom: 3px;
      color: #a99fbe;
      font-size: 10px;
      font-weight: 850;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .campaign-entry-detail strong {
      display: block;
      overflow-wrap: anywhere;
      color: #d7ffec;
      font-size: 13px;
    }
    .campaign-entry-actions {
      display: flex;
      align-items: stretch;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .campaign-entry-actions .hud-button { min-width: 190px; }
    .campaign-entry-status {
      min-height: 20px;
      margin: 12px 0 0;
      color: #ffcf87;
      font-size: 12px;
    }
    .campaign-entry [disabled] { cursor: wait; opacity: .62; }
    @media (max-width: 720px) {
      .campaign-entry { padding: 9px; }
      .campaign-entry-panel { padding: 20px 17px; }
      .campaign-entry-actions { display: grid; }
      .campaign-entry-actions .hud-button { width: 100%; min-width: 0; }
    }
  `;
  document.head.appendChild(style);
}

function interactiveTarget(target) {
  const tag = String(target?.tagName || "").toUpperCase();
  return ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(tag);
}

export class CampaignEntrySystem {
  constructor(scene, uiScene, campaign, entry) {
    if (!scene || !uiScene || !campaign || !entry) {
      throw new TypeError("CampaignEntrySystem requires GameScene, UIScene, CampaignSystem and an entry descriptor.");
    }
    this.scene = scene;
    this.uiScene = uiScene;
    this.campaign = campaign;
    this.entry = entry;
    this.overlay = null;
    this.busy = false;
    this.onClick = event => this.handleClick(event);
    this.onKeyDown = event => this.handleKeyDown(event);

    scene.registry?.set?.("campaignEntry", entry);
    scene.registry?.set?.("campaignEntryOpen", false);
    scene.events?.once?.("shutdown", this.destroy, this);

    if (entry.autoEnter || !entry.show) {
      if (!entry.preserveNativeIntro) this.dismissNativeModal();
      return;
    }
    this.open();
  }

  open() {
    if (this.overlay) return;
    installStyle();
    const root = this.uiScene.dom?.root || document.getElementById("game-ui");
    if (!root) throw new Error("Campaign entry UI requires #game-ui.");

    this.uiScene.introOpen = true;
    this.uiScene.pauseOpen = false;
    this.uiScene.resultOpen = false;
    this.uiScene.resultType = null;
    this.uiScene.updateUiPause?.();
    this.hideUnderlyingModal();
    this.scene.registry?.set?.("campaignEntryOpen", true);

    const details = this.entry.details
      .map(detail => `
        <div class="campaign-entry-detail">
          <small>${escapeHtml(detail.label)}</small>
          <strong>${escapeHtml(detail.value)}</strong>
        </div>
      `)
      .join("");
    const copy = this.entry.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("");
    const secondary = this.entry.secondary
      .map(action => `
        <button class="hud-button menu" type="button" data-campaign-entry-action="${escapeHtml(action.action)}">
          ${escapeHtml(action.label)}
        </button>
      `)
      .join("");

    const overlay = document.createElement("section");
    overlay.className = "campaign-entry";
    overlay.dataset.campaignEntryMode = this.entry.mode;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "campaign-entry-title");
    overlay.innerHTML = `
      <div class="campaign-entry-panel">
        <p class="campaign-entry-eyebrow">${escapeHtml(this.entry.eyebrow)}</p>
        <h2 id="campaign-entry-title">${escapeHtml(this.entry.title)}</h2>
        <div class="campaign-entry-copy">${copy}</div>
        <div class="campaign-entry-details">${details}</div>
        <div class="campaign-entry-actions">
          <button class="hud-button mission" type="button" data-campaign-entry-primary data-campaign-entry-action="${escapeHtml(this.entry.primary.action)}">
            ${escapeHtml(this.entry.primary.label)}
          </button>
          ${secondary}
        </div>
        <p class="campaign-entry-status" role="status" aria-live="polite"></p>
      </div>
    `;
    overlay.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKeyDown, true);
    root.appendChild(overlay);
    this.overlay = overlay;
    queueMicrotask(() => this.primaryButton()?.focus?.());
  }

  primaryButton() {
    return this.overlay?.querySelector?.("[data-campaign-entry-primary]") || null;
  }

  focusableButtons() {
    return [...(this.overlay?.querySelectorAll?.("button:not([disabled])") || [])];
  }

  hideUnderlyingModal() {
    const modal = this.uiScene.dom?.modal;
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
  }

  restoreUnderlyingModal() {
    const modal = this.uiScene.dom?.modal;
    if (!modal) return;
    modal.classList.remove("open");
    modal.style.removeProperty("display");
    modal.removeAttribute("aria-hidden");
    modal.inert = false;
  }

  handleClick(event) {
    const button = event.target?.closest?.("[data-campaign-entry-action]");
    if (!button || !this.overlay?.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    this.execute(button.dataset.campaignEntryAction);
  }

  handleKeyDown(event) {
    if (!this.overlay || this.busy || event.repeat) return;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.code === "Tab") {
      const buttons = this.focusableButtons();
      if (!buttons.length) return;
      const activeIndex = buttons.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1)
        : (activeIndex < 0 || activeIndex >= buttons.length - 1 ? 0 : activeIndex + 1);
      event.preventDefault();
      event.stopImmediatePropagation();
      buttons[nextIndex].focus();
      return;
    }
    if (event.code !== "Enter") return;

    const button = event.target?.closest?.("[data-campaign-entry-action]");
    if (button && this.overlay.contains(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.execute(button.dataset.campaignEntryAction);
      return;
    }
    if (interactiveTarget(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.execute(this.entry.primary.action);
  }

  execute(action) {
    if (this.busy) return false;
    if (action === CAMPAIGN_ENTRY_ACTIONS.CONTINUE) {
      this.dismissNativeModal();
      return true;
    }

    this.setBusy(true);
    try {
      if (action === CAMPAIGN_ENTRY_ACTIONS.NEW_GAME) {
        this.campaign.reset({ persist: true });
        this.campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
          metadata: {
            integration: "campaign_entry",
            rooftopJumps: 0
          }
        });
        this.campaign.save();
        this.reloadIntoCampaign("Starting a new campaign…");
        return true;
      }

      if ([CAMPAIGN_ENTRY_ACTIONS.RETRY_CHECKPOINT, CAMPAIGN_ENTRY_ACTIONS.RETRY_MISSION].includes(action)) {
        const missionId = this.entry.missionId || SILENCE_THE_JOURNALIST_ID;
        this.campaign.startMission(missionId, {
          replay: true,
          metadata: {
            integration: "campaign_entry_retry",
            retryMode: action
          }
        });
        this.campaign.save();
        this.reloadIntoCampaign(action === CAMPAIGN_ENTRY_ACTIONS.RETRY_CHECKPOINT
          ? "Restoring the safe checkpoint…"
          : "Restarting the contract…");
        return true;
      }

      throw new Error(`Unsupported campaign entry action: ${action}`);
    } catch (error) {
      this.setBusy(false);
      this.setStatus(error?.message || "The campaign could not be prepared.");
      return false;
    }
  }

  reloadIntoCampaign(status) {
    this.setStatus(status);
    try {
      window.sessionStorage.setItem(CAMPAIGN_ENTRY_SESSION_KEY, "enter");
    } catch {
      // The next page will simply show Continue when session storage is unavailable.
    }
    window.location.reload();
  }

  setBusy(busy) {
    this.busy = Boolean(busy);
    for (const button of this.overlay?.querySelectorAll?.("button") || []) button.disabled = this.busy;
  }

  setStatus(text) {
    const status = this.overlay?.querySelector?.(".campaign-entry-status");
    if (status) status.textContent = String(text || "");
  }

  dismissNativeModal() {
    this.overlay?.removeEventListener?.("click", this.onClick);
    this.overlay?.remove?.();
    this.overlay = null;
    window.removeEventListener("keydown", this.onKeyDown, true);

    this.uiScene.introOpen = false;
    this.uiScene.pauseOpen = false;
    this.uiScene.resultOpen = false;
    this.uiScene.resultType = null;
    this.uiScene.resultDismissed = this.entry.mode === CAMPAIGN_ENTRY_MODES.FREE_ROAM;
    this.uiScene.pauseSnapshot = null;
    this.restoreUnderlyingModal();
    this.scene.registry?.set?.("campaignEntryOpen", false);
    this.uiScene.updateUiPause?.();
    this.scene.inputSystem?.resetWorldEdges?.();
  }

  destroy() {
    this.overlay?.removeEventListener?.("click", this.onClick);
    this.overlay?.remove?.();
    this.overlay = null;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.restoreUnderlyingModal();
    this.scene.registry?.set?.("campaignEntryOpen", false);
  }
}