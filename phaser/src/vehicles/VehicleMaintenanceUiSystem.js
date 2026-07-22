import { REFUGE_GARAGE } from "../data/vehicle-maintenance.js";

const STYLE_ID = "nbd-vehicle-maintenance-style";

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
    .vehicle-maintenance {
      position: absolute;
      inset: 0;
      z-index: 84;
      display: grid;
      place-items: center;
      padding: 20px;
      background:
        radial-gradient(circle at 18% 12%, rgba(255, 176, 46, .13), transparent 38%),
        radial-gradient(circle at 82% 20%, rgba(120, 199, 163, .12), transparent 42%),
        rgba(3, 4, 8, .92);
      pointer-events: auto;
    }
    .vehicle-maintenance__panel {
      width: min(860px, 100%);
      max-height: calc(100% - 12px);
      overflow-y: auto;
      padding: 28px;
      border: 1px solid rgba(255, 207, 135, .30);
      border-top: 2px solid #ffb02e;
      background: linear-gradient(145deg, rgba(23, 20, 25, .98), rgba(6, 7, 12, .98));
      box-shadow: 0 24px 90px rgba(0, 0, 0, .70), inset 0 1px rgba(255, 255, 255, .04);
      clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
    }
    .vehicle-maintenance__eyebrow {
      margin: 0 0 7px;
      color: #ffb02e;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .14em;
    }
    .vehicle-maintenance h2 {
      margin: 0 0 9px;
      color: #f4ecff;
      font-size: clamp(27px, 5vw, 42px);
      line-height: 1;
    }
    .vehicle-maintenance__intro {
      margin: 0 0 18px;
      color: #cfc3df;
      font-size: 14px;
      line-height: 1.55;
    }
    .vehicle-maintenance__balance {
      display: inline-flex;
      margin-bottom: 18px;
      padding: 6px 9px;
      border: 1px solid rgba(120, 199, 163, .28);
      color: #d7ffec;
      background: rgba(120, 199, 163, .07);
      font-size: 12px;
      font-weight: 900;
    }
    .vehicle-maintenance__cards { display: grid; gap: 12px; }
    .vehicle-maintenance__card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 15px;
      align-items: center;
      padding: 17px;
      border: 1px solid rgba(255, 207, 135, .22);
      background: rgba(255, 176, 46, .045);
    }
    .vehicle-maintenance__card h3 { margin: 0 0 5px; color: #f4ecff; font-size: 19px; }
    .vehicle-maintenance__card p { margin: 0; color: #b8accb; font-size: 13px; line-height: 1.45; }
    .vehicle-maintenance__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px 12px;
      margin-top: 10px;
      color: #ffcf87;
      font-size: 11px;
      font-weight: 800;
    }
    .vehicle-maintenance__health {
      height: 5px;
      margin-top: 10px;
      overflow: hidden;
      background: rgba(255, 255, 255, .08);
    }
    .vehicle-maintenance__health span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #b63a4a, #ffb02e, #78c7a3);
    }
    .vehicle-maintenance__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 20px;
    }
    .vehicle-maintenance__status { min-height: 18px; color: #ffcf87; font-size: 12px; }
    .vehicle-maintenance [disabled] { cursor: not-allowed; opacity: .52; }
    @media (max-width: 720px) {
      .vehicle-maintenance { padding: 9px; }
      .vehicle-maintenance__panel { padding: 20px 17px; }
      .vehicle-maintenance__card { grid-template-columns: 1fr; }
      .vehicle-maintenance__card .hud-button { width: 100%; }
      .vehicle-maintenance__actions { align-items: stretch; flex-direction: column-reverse; }
      .vehicle-maintenance__actions .hud-button { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

export class VehicleMaintenanceUiSystem {
  constructor(scene, uiScene, campaign, service = campaign?.vehicleMaintenance) {
    if (!scene || !uiScene || !campaign || !service) {
      throw new TypeError("VehicleMaintenanceUiSystem requires GameScene, UIScene, CampaignSystem and maintenance service.");
    }
    this.scene = scene;
    this.uiScene = uiScene;
    this.campaign = campaign;
    this.service = service;
    this.garage = REFUGE_GARAGE;
    this.overlay = null;
    this.busy = false;
    this.status = "";
    this.destroyed = false;
    this.disposers = [];
    this.originalCollectInteractions = scene.collectInteractions;
    this.wrappedCollectInteractions = null;
    this.onClick = event => this.handleClick(event);
    this.onKeyDown = event => this.handleKeyDown(event);
    this.installInteractionHook();
    for (const type of ["wallet:changed", "vehicle:condition-changed", "vehicle:maintenance-completed", "campaign:loaded"]) {
      this.disposers.push(campaign.events.on(type, () => {
        if (this.overlay) this.render();
        this.publish();
      }));
    }
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.publish();
  }

  installInteractionHook() {
    const system = this;
    const original = this.originalCollectInteractions;
    this.wrappedCollectInteractions = function maintenanceAwareInteractions() {
      const options = typeof original === "function" ? original.call(system.scene) || [] : [];
      if (!system.overlay) options.push(...system.collectInteractions());
      return options;
    };
    this.scene.collectInteractions = this.wrappedCollectInteractions;
  }

  wantedLevel() {
    return this.scene.exposureSystem?.level?.() || 0;
  }

  distanceToGarage() {
    return Phaser.Math.Distance.Between(
      this.scene.player?.x || 0,
      this.scene.player?.y || 0,
      this.garage.x,
      this.garage.y
    );
  }

  nearGarage() {
    return this.scene.currentLayer === this.garage.layer
      && this.distanceToGarage() <= this.garage.interactionRadius;
  }

  serviceBlockedReason() {
    if (this.scene.vehicleSystem?.isDriving?.()) return "Exit the vehicle before using the garage.";
    if (!this.nearGarage()) return "Reach the refuge garage to request service.";
    if (this.wantedLevel() > 0) return "Lose the police before using the refuge garage.";
    if (this.scene.registry?.get?.("campaignEntryOpen")) return "Finish the campaign entry decision first.";
    return "";
  }

  collectInteractions() {
    if (this.destroyed || this.scene.vehicleSystem?.isDriving?.()) return [];
    if (this.scene.currentLayer !== this.garage.layer) return [];
    const distance = this.distanceToGarage();
    if (distance > this.garage.interactionRadius) return [];
    const blocked = this.wantedLevel() > 0;
    return [{
      id: "open_refuge_vehicle_garage",
      type: "vehicle-maintenance",
      label: blocked ? "Garage unavailable" : "Open refuge garage",
      detail: blocked ? "lose wanted level first" : "repair or recover owned vehicles",
      priority: 154,
      distance,
      x: this.garage.x,
      y: this.garage.y,
      run: () => this.open()
    }];
  }

  snapshot() {
    return {
      ...this.service.snapshot(),
      open: Boolean(this.overlay),
      busy: this.busy,
      nearGarage: this.nearGarage(),
      wantedLevel: this.wantedLevel(),
      blockedReason: this.serviceBlockedReason(),
      status: this.status
    };
  }

  cardHtml(quote) {
    const actionLabel = quote.action === "recover"
      ? `Recover · $${quote.cost}`
      : quote.action === "repair"
        ? `Repair · $${quote.cost}`
        : "Roadworthy";
    const action = quote.action === "recover" ? "recover" : "repair";
    const location = quote.atGarage ? "At refuge garage" : `${Math.round(quote.distanceToGarage)} units from garage`;
    const detail = quote.disabled
      ? `Wrecked · tow returns it with ${quote.recoveryHealth}/${quote.maxHealth} hull.`
      : quote.missingHealth > 0
        ? `${quote.missingHealth} hull points missing.`
        : "No maintenance required.";
    return `
      <article class="vehicle-maintenance__card" data-maintenance-card="${escapeHtml(quote.vehicleId)}">
        <div>
          <h3>${escapeHtml(quote.name)}</h3>
          <p>${escapeHtml(detail)} ${escapeHtml(quote.reason)}</p>
          <div class="vehicle-maintenance__health" aria-label="Hull ${quote.healthPercent}%">
            <span style="width:${Math.max(0, Math.min(100, quote.healthPercent))}%"></span>
          </div>
          <div class="vehicle-maintenance__meta">
            <span>Hull ${quote.health}/${quote.maxHealth} · ${quote.healthPercent}%</span>
            <span>${escapeHtml(location)}</span>
            <span>${escapeHtml(quote.archetypeLabel)}</span>
          </div>
        </div>
        <button class="hud-button mission" type="button"
          data-maintenance-action="${action}"
          data-vehicle-id="${escapeHtml(quote.vehicleId)}"
          ${quote.available ? "" : "disabled"}>
          ${escapeHtml(actionLabel)}
        </button>
      </article>
    `;
  }

  render() {
    if (!this.overlay) return false;
    const model = this.snapshot();
    const cards = model.vehicles.map(quote => this.cardHtml(quote)).join("");
    this.overlay.innerHTML = `
      <div class="vehicle-maintenance__panel">
        <p class="vehicle-maintenance__eyebrow">ROOFTOP REFUGE · STREET GARAGE</p>
        <h2 id="vehicle-maintenance-title">Vehicle maintenance</h2>
        <p class="vehicle-maintenance__intro">Repairs require the vehicle to be parked here. A tow can recover an owned wreck from anywhere in the district.</p>
        <div class="vehicle-maintenance__balance">Cash · $${Number(model.balance).toFixed(0)}</div>
        <div class="vehicle-maintenance__cards">${cards || "<p>No owned vehicles are available.</p>"}</div>
        <div class="vehicle-maintenance__actions">
          <button class="hud-button menu" type="button" data-maintenance-action="close">Close · Esc</button>
          <p class="vehicle-maintenance__status" role="status" aria-live="polite">${escapeHtml(this.status)}</p>
        </div>
      </div>
    `;
    queueMicrotask(() => this.focusableButtons()[0]?.focus?.());
    return true;
  }

  open() {
    if (this.overlay || this.busy || this.destroyed) return false;
    const blocked = this.serviceBlockedReason();
    if (blocked) {
      this.scene.lastActionText = blocked;
      this.status = blocked;
      this.publish();
      return false;
    }
    installStyle();
    const root = this.uiScene.dom?.root || document.getElementById("game-ui");
    if (!root) throw new Error("Vehicle maintenance requires #game-ui.");
    const overlay = document.createElement("section");
    overlay.className = "vehicle-maintenance";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "vehicle-maintenance-title");
    overlay.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKeyDown, true);
    root.appendChild(overlay);
    this.overlay = overlay;
    this.status = "Select an owned vehicle.";
    this.scene.registry?.set?.("vehicleMaintenanceOpen", true);
    this.scene.scene?.pause?.();
    this.render();
    this.publish();
    return true;
  }

  close(status = "Refuge garage closed.") {
    if (!this.overlay) return false;
    this.overlay.removeEventListener("click", this.onClick);
    this.overlay.remove();
    this.overlay = null;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.scene.registry?.set?.("vehicleMaintenanceOpen", false);
    if (!this.uiScene.introOpen && !this.uiScene.pauseOpen && !this.uiScene.resultOpen) {
      this.scene.scene?.resume?.();
    }
    this.scene.inputSystem?.resetWorldEdges?.();
    this.scene.lastActionText = status;
    this.status = status;
    this.publish();
    return true;
  }

  perform(action, vehicleId) {
    if (this.busy) return { changed: false, code: "VEHICLE_MAINTENANCE_BUSY" };
    const blocked = this.serviceBlockedReason();
    if (blocked) {
      const result = { changed: false, code: "VEHICLE_MAINTENANCE_BLOCKED", message: blocked };
      this.status = blocked;
      this.scene.lastActionText = blocked;
      if (this.overlay) this.render();
      this.publish();
      return result;
    }
    this.busy = true;
    try {
      const result = action === "recover"
        ? this.service.recover(vehicleId)
        : this.service.repair(vehicleId);
      this.status = result.changed
        ? action === "recover"
          ? `${vehicleId} recovered to the refuge garage for $${result.cost}.`
          : `${vehicleId} repaired for $${result.cost}.`
        : result.code === "VEHICLE_REPAIR_NOT_NEEDED"
          ? "That vehicle already has full hull condition."
          : "That vehicle does not require recovery.";
      this.scene.lastActionText = this.status;
      return result;
    } catch (error) {
      this.status = error?.message || "Vehicle maintenance failed.";
      this.scene.lastActionText = this.status;
      return {
        changed: false,
        code: error?.code || "VEHICLE_MAINTENANCE_FAILED",
        message: this.status,
        vehicleId
      };
    } finally {
      this.busy = false;
      if (this.overlay) this.render();
      this.publish();
    }
  }

  handleClick(event) {
    const button = event.target?.closest?.("[data-maintenance-action]");
    if (!button || !this.overlay?.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.maintenanceAction;
    if (action === "close") this.close();
    if (action === "repair" || action === "recover") this.perform(action, button.dataset.vehicleId);
  }

  focusableButtons() {
    return [...(this.overlay?.querySelectorAll?.("button:not([disabled])") || [])];
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

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      vehicleMaintenanceText: snapshot.open
        ? `Garage open · cash $${snapshot.balance}`
        : "Garage closed",
      vehicleMaintenanceState: snapshot
    });
    return snapshot;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.overlay) this.close("Refuge garage closed.");
    for (const dispose of this.disposers.splice(0)) dispose?.();
    if (this.scene.collectInteractions === this.wrappedCollectInteractions) {
      this.scene.collectInteractions = this.originalCollectInteractions;
    }
    this.wrappedCollectInteractions = null;
  }
}
