import { CAMPAIGN_REFUGES } from "./constants.js";
import { createMissionBoardModel } from "./MissionBoard.js";
import { CLEAN_THE_SCENE_ID } from "./missions/cleanTheScene.js";

const STYLE_ID = "nbd-mission-board-style";

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
    .mission-board {
      position: absolute;
      inset: 0;
      z-index: 82;
      display: grid;
      place-items: center;
      padding: 20px;
      background:
        radial-gradient(circle at 18% 12%, rgba(120, 199, 163, .16), transparent 38%),
        radial-gradient(circle at 82% 18%, rgba(167, 92, 255, .16), transparent 42%),
        rgba(3, 4, 8, .90);
      pointer-events: auto;
    }
    .mission-board__panel {
      width: min(820px, 100%);
      max-height: calc(100% - 12px);
      overflow-y: auto;
      padding: 28px;
      border: 1px solid rgba(226, 214, 255, .28);
      border-top: 2px solid #78c7a3;
      background: linear-gradient(145deg, rgba(18, 20, 32, .98), rgba(6, 7, 12, .98));
      box-shadow: 0 24px 90px rgba(0, 0, 0, .68), inset 0 1px rgba(255, 255, 255, .04);
      clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
    }
    .mission-board__eyebrow {
      margin: 0 0 7px;
      color: #78c7a3;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .14em;
    }
    .mission-board h2 {
      margin: 0 0 10px;
      color: #f4ecff;
      font-size: clamp(27px, 5vw, 42px);
      line-height: 1;
    }
    .mission-board__intro {
      margin: 0 0 20px;
      color: #cfc3df;
      font-size: 14px;
      line-height: 1.55;
    }
    .mission-board__cards { display: grid; gap: 12px; }
    .mission-board__card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 17px;
      border: 1px solid rgba(120, 199, 163, .24);
      background: rgba(120, 199, 163, .055);
    }
    .mission-board__card h3 { margin: 0 0 5px; color: #f4ecff; font-size: 20px; }
    .mission-board__card p { margin: 0; color: #b8accb; font-size: 13px; line-height: 1.45; }
    .mission-board__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px 12px;
      margin-top: 10px;
      color: #ffcf87;
      font-size: 11px;
      font-weight: 800;
    }
    .mission-board__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 20px;
    }
    .mission-board__status { min-height: 18px; color: #ffcf87; font-size: 12px; }
    .mission-board [disabled] { cursor: not-allowed; opacity: .55; }
    @media (max-width: 720px) {
      .mission-board { padding: 9px; }
      .mission-board__panel { padding: 20px 17px; }
      .mission-board__card { grid-template-columns: 1fr; }
      .mission-board__card .hud-button { width: 100%; }
      .mission-board__actions { align-items: stretch; flex-direction: column-reverse; }
      .mission-board__actions .hud-button { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

export class MissionBoardSystem {
  constructor(scene, uiScene, campaign) {
    if (!scene || !uiScene || !campaign) {
      throw new TypeError("MissionBoardSystem requires GameScene, UIScene and CampaignSystem.");
    }
    this.scene = scene;
    this.uiScene = uiScene;
    this.campaign = campaign;
    this.overlay = null;
    this.busy = false;
    this.modalSnapshot = null;
    this.disposers = [];
    this.onClick = event => this.handleClick(event);
    this.onKeyDown = event => this.handleKeyDown(event);
    this.onResultDismissed = result => this.handleResultDismissed(result);

    for (const type of ["mission:started", "mission:completed", "mission:failed", "campaign:loaded"]) {
      this.disposers.push(campaign.events.on(type, () => this.publish()));
    }
    uiScene.events?.on?.("ui:mission-result-dismissed", this.onResultDismissed);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.publish();
  }

  model() {
    return createMissionBoardModel(this.campaign.snapshot());
  }

  snapshot() {
    return this.model();
  }

  marker() {
    const model = this.model();
    return model.available && !this.overlay ? { ...model.marker } : null;
  }

  collectInteractions() {
    const marker = this.marker();
    if (!marker || this.scene.currentLayer !== marker.layer) return [];
    const distance = Phaser.Math.Distance.Between(
      this.scene.player.x,
      this.scene.player.y,
      marker.x,
      marker.y
    );
    if (distance > marker.radius) return [];
    return [{
      id: "open_refuge_mission_board",
      type: "mission-board",
      label: "Open contract board",
      detail: "select a Directorate contract",
      priority: 150,
      distance,
      x: marker.x,
      y: marker.y,
      run: () => this.open()
    }];
  }

  open() {
    if (this.overlay || this.busy) return false;
    const model = this.model();
    if (!model.available || this.scene.registry?.get?.("campaignEntryOpen")) return false;

    installStyle();
    const root = this.uiScene.dom?.root || document.getElementById("game-ui");
    if (!root) throw new Error("Mission board requires #game-ui.");

    this.scene.registry?.set?.("campaignBoardOpen", true);
    this.hideUnderlyingModal();
    this.scene.scene?.pause?.();

    const cards = model.cards.map(card => {
      const factionReward = Object.values(card.rewards.reputation || {})[0] || 0;
      const contactReward = Object.values(card.rewards.contacts || {})[0] || 0;
      const rewardText = [
        `$${Number(card.rewards.cash || 0).toFixed(0)}`,
        factionReward ? `Directorate +${factionReward}` : "",
        contactReward ? `Contact +${contactReward}` : ""
      ].filter(Boolean).join(" · ");
      const runText = card.completionCount > 0 ? `Completed ${card.completionCount} time${card.completionCount === 1 ? "" : "s"}` : "New contract";
      return `
        <article class="mission-board__card" data-mission-card="${escapeHtml(card.id)}">
          <div>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.description)}</p>
            <div class="mission-board__meta">
              <span>${escapeHtml(card.contactLabel)}</span>
              <span>${escapeHtml(rewardText)}</span>
              <span>${escapeHtml(runText)}</span>
            </div>
          </div>
          <button class="hud-button mission" type="button" data-mission-board-action="accept" data-mission-id="${escapeHtml(card.id)}" ${card.available ? "" : "disabled"}>
            ${escapeHtml(card.actionLabel)}
          </button>
        </article>
      `;
    }).join("");

    const overlay = document.createElement("section");
    overlay.className = "mission-board";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "mission-board-title");
    overlay.innerHTML = `
      <div class="mission-board__panel">
        <p class="mission-board__eyebrow">ROOFTOP REFUGE · BLACKGLASS DIRECTORATE</p>
        <h2 id="mission-board-title">Contract board</h2>
        <p class="mission-board__intro">The opening order is settled. Choose the next problem the Directorate wants erased.</p>
        <div class="mission-board__cards">${cards || "<p>No contracts are currently available.</p>"}</div>
        <div class="mission-board__actions">
          <button class="hud-button menu" type="button" data-mission-board-action="close">Close · Esc</button>
          <p class="mission-board__status" role="status" aria-live="polite"></p>
        </div>
      </div>
    `;
    overlay.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKeyDown, true);
    root.appendChild(overlay);
    this.overlay = overlay;
    queueMicrotask(() => this.focusableButtons()[0]?.focus?.());
    this.publish();
    return true;
  }

  close(status = "Contract board closed.") {
    if (!this.overlay) return false;
    this.overlay.removeEventListener("click", this.onClick);
    this.overlay.remove();
    this.overlay = null;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.restoreUnderlyingModal();
    this.scene.registry?.set?.("campaignBoardOpen", false);
    if (!this.uiScene.introOpen && !this.uiScene.pauseOpen && !this.uiScene.resultOpen) {
      this.scene.scene?.resume?.();
    }
    this.scene.inputSystem?.resetWorldEdges?.();
    this.scene.lastActionText = status;
    this.publish();
    return true;
  }

  acceptMission(missionId) {
    if (this.busy) return false;
    const model = this.model();
    const card = model.cards.find(candidate => candidate.id === missionId);
    if (!model.available || !card?.available) return false;

    this.setBusy(true);
    try {
      this.scene.missionSystem?.resetResultState?.(missionId);
      const existing = this.campaign.missions.record(missionId);
      const started = this.campaign.startMission(missionId, {
        replay: Boolean(existing),
        metadata: {
          integration: "refuge_mission_board",
          refugeId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE
        }
      });
      const objectiveId = started?.currentObjective?.id || this.campaign.missions.currentObjective()?.id;
      if (objectiveId) this.scene.campaignCheckpointSystem?.requestObjective?.(missionId, objectiveId);
      this.campaign.save();
      this.close(`CONTRACT ACCEPTED: ${card.title}.`);
      this.scene.missionSystem?.syncFromCampaign?.({
        force: true,
        emitStep: false,
        actionText: `CONTRACT ACCEPTED: ${card.title}.`
      });
      this.scene.redrawLayer?.(this.scene.lastActionText);
      this.scene.events?.emit?.("mission-board:contract-started", { missionId, objectiveId });
      return true;
    } catch (error) {
      this.setBusy(false);
      this.setStatus(error?.message || "The contract could not be started.");
      return false;
    }
  }

  handleResultDismissed(result = {}) {
    if (result?.missionId !== CLEAN_THE_SCENE_ID || result?.status !== "complete") return;
    window.requestAnimationFrame(() => {
      if (this.model().available) this.open();
    });
  }

  handleClick(event) {
    const button = event.target?.closest?.("[data-mission-board-action]");
    if (!button || !this.overlay?.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.missionBoardAction;
    if (action === "close") this.close();
    if (action === "accept") this.acceptMission(button.dataset.missionId);
  }

  handleKeyDown(event) {
    if (!this.overlay || this.busy || event.repeat) return;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
      return;
    }
    if (event.code !== "Tab") return;
    const buttons = this.focusableButtons();
    if (!buttons.length) return;
    const activeIndex = buttons.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1)
      : (activeIndex < 0 || activeIndex >= buttons.length - 1 ? 0 : activeIndex + 1);
    event.preventDefault();
    event.stopImmediatePropagation();
    buttons[nextIndex].focus();
  }

  focusableButtons() {
    return [...(this.overlay?.querySelectorAll?.("button:not([disabled])") || [])];
  }

  hideUnderlyingModal() {
    const modal = this.uiScene.dom?.modal;
    if (!modal) return;
    this.modalSnapshot = {
      display: modal.style.display,
      ariaHidden: modal.getAttribute("aria-hidden"),
      inert: Boolean(modal.inert)
    };
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
  }

  restoreUnderlyingModal() {
    const modal = this.uiScene.dom?.modal;
    if (!modal) return;
    modal.style.display = this.modalSnapshot?.display || "";
    if (this.modalSnapshot?.ariaHidden == null) modal.removeAttribute("aria-hidden");
    else modal.setAttribute("aria-hidden", this.modalSnapshot.ariaHidden);
    modal.inert = Boolean(this.modalSnapshot?.inert);
    this.modalSnapshot = null;
  }

  setBusy(busy) {
    this.busy = Boolean(busy);
    for (const button of this.overlay?.querySelectorAll?.("button") || []) button.disabled = this.busy;
  }

  setStatus(text) {
    const status = this.overlay?.querySelector?.(".mission-board__status");
    if (status) status.textContent = String(text || "");
  }

  publish() {
    const snapshot = this.model();
    this.scene.statePublisher?.set?.("missionBoard", snapshot)
      || this.scene.registry?.set?.("missionBoard", snapshot);
    this.scene.registry?.set?.("campaignBoardOpen", Boolean(this.overlay));
    return snapshot;
  }

  destroy() {
    for (const dispose of this.disposers.splice(0)) dispose?.();
    this.uiScene.events?.off?.("ui:mission-result-dismissed", this.onResultDismissed);
    this.overlay?.removeEventListener?.("click", this.onClick);
    this.overlay?.remove?.();
    this.overlay = null;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.restoreUnderlyingModal();
    this.scene.registry?.set?.("campaignBoardOpen", false);
  }
}
