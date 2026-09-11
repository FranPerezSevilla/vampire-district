import { REFUGE_GARAGE } from "../data/vehicle-maintenance.js";

// Service coordinator only. React owns the garage view and focus/keyboard.
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
    return this.scene.heatSystem?.level?.() ?? this.scene.exposureSystem?.level?.() ?? 0;
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

  render() { if (this.overlay) this.uiScene.refresh?.(); return Boolean(this.overlay); }
  open() {
    if (this.overlay || this.busy || this.destroyed) return false;
    const blocked = this.serviceBlockedReason();
    if (blocked) { this.scene.lastActionText = this.status = blocked; this.publish(); return false; }
    this.overlay = true;
    this.status = "Select an owned vehicle.";
    this.scene.registry?.set?.("vehicleMaintenanceOpen", true);
    const opened = this.uiScene.openExternal({ id: "garage", read: () => this.snapshot(),
      close: () => this.close(), command: payload => this.perform(payload.action, payload.vehicleId) });
    if (!opened) { this.overlay = null; this.scene.registry?.set?.("vehicleMaintenanceOpen", false); return false; }
    this.publish(); return true;
  }
  close(status = "Refuge garage closed.") {
    if (!this.overlay) return false;
    this.overlay = null;
    this.scene.registry?.set?.("vehicleMaintenanceOpen", false);
    this.uiScene.closeExternal("garage");
    this.scene.inputSystem?.resetWorldEdges?.();
    this.scene.lastActionText = this.status = status;
    this.publish(); return true;
  }
  perform(action, vehicleId) {
    if (!["repair", "recover"].includes(action)) return { changed: false, code: "INVALID_MAINTENANCE_ACTION" };
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
