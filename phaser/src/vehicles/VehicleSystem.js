import { vehicleArchetype, vehicleDefinitions } from "../data/vehicles.js";
import { createVehicleState } from "./VehicleModel.js";
import { createVehicleHud, installVehicleBrowserApi, paintVehicle, publishVehicleState, refreshVehicleVisibility, updateVehicleHud, vehicleSystemSnapshot, vehicleSystemSummary } from "./VehicleView.js";
import { canVehicleOccupy, filterVehicleInputFrame, handleVehicleWorldCollision, updateVehicleCamera, updateVehicleDriving } from "./VehicleDriving.js";
import { canEnterVehicle, collectVehicleInteractions, enterVehicle, exitVehicle, inspectVehicleTrunk, removeVehicleTrunkItem, storeVehicleTrunkItem, vehicleStatusLabel, vehicleTrunkLabel } from "./VehicleInteractions.js";

export class VehicleSystem {
  constructor(scene, campaign = scene?.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM) {
    if (!scene || !campaign?.vehicles) {
      throw new TypeError("VehicleSystem requires GameScene and a campaign vehicle service.");
    }
    this.scene = scene;
    this.campaign = campaign;
    this.currentVehicleId = null;
    this.persistTimer = 0;
    this.crashCooldown = 0;
    this.pedestrianCooldowns = new Map();
    this.destroyed = false;
    this.vehicles = vehicleDefinitions.map(definition => this.createVehicle(definition));
    this.hud = createVehicleHud(scene);
    installVehicleBrowserApi(this);
    this.publish();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  createVehicle(definition) {
    const archetype = vehicleArchetype(definition.archetypeId);
    if (!archetype) throw new Error(`Unknown vehicle archetype ${definition.archetypeId}.`);
    const condition = this.campaign.vehicles.condition(definition);
    const state = createVehicleState(definition, archetype, condition);
    const container = this.scene.add.container(state.x, state.y).setDepth(46);
    const visual = paintVehicle(this.scene, container, definition, archetype);
    container.setRotation(state.angle);
    if (state.disabled) {
      container.setAlpha(0.52);
      visual.hood.setFillStyle(0x3f2027, 0.92);
    }
    return {
      ...definition,
      ...state,
      archetype,
      container,
      visual,
      status: this.campaign.vehicles.status(definition),
      ownership: definition.ownership,
      lastPersisted: {
        x: state.x,
        y: state.y,
        angle: state.angle,
        health: state.health,
        parked: state.parked
      }
    };
  }

  currentVehicle() {
    return this.vehicles.find(vehicle => vehicle.id === this.currentVehicleId) || null;
  }

  vehicle(id) {
    return this.vehicles.find(candidate => candidate.id === id) || null;
  }

  isDriving() {
    return Boolean(this.currentVehicle());
  }

  collectInteractions() {
    return collectVehicleInteractions(this);
  }

  statusLabel(vehicle) {
    return vehicleStatusLabel(vehicle);
  }

  trunkLabel(vehicle) {
    return vehicleTrunkLabel(this, vehicle);
  }

  canEnter(vehicle) {
    return canEnterVehicle(this, vehicle);
  }

  enterVehicle(vehicleId, options = {}) {
    return enterVehicle(this, vehicleId, options);
  }

  exitVehicle(options = {}) {
    return exitVehicle(this, options);
  }

  filterInputFrame(frame) {
    return filterVehicleInputFrame(this, frame);
  }

  updateDriving(dt, frame) {
    return updateVehicleDriving(this, dt, frame);
  }

  canOccupy(vehicle, x, y, angle) {
    return canVehicleOccupy(this, vehicle, x, y, angle);
  }

  handleWorldCollision(vehicle, impactSpeed) {
    return handleVehicleWorldCollision(this, vehicle, impactSpeed);
  }

  damageVehicle(vehicleId, amount, { reason = "damage", persist = true } = {}) {
    const vehicle = this.vehicle(vehicleId);
    const damage = Math.max(0, Number(amount) || 0);
    if (!vehicle || !damage || vehicle.disabled) return false;
    vehicle.health = Math.max(0, vehicle.health - damage);
    if (vehicle.health <= 0) {
      vehicle.disabled = true;
      vehicle.speed = 0;
      vehicle.parked = true;
      vehicle.container.setAlpha(0.52);
      vehicle.visual.hood.setFillStyle(0x3f2027, 0.92);
      this.scene.lastActionText = `${vehicle.name} disabled by ${reason}.`;
      if (this.currentVehicleId === vehicle.id) this.exitVehicle({ force: true });
    }
    if (persist) this.persistVehicle(vehicle);
    this.publish();
    return true;
  }

  inspectTrunk(vehicleId) {
    return inspectVehicleTrunk(this, vehicleId);
  }

  storeInTrunk(vehicleId, itemId) {
    return storeVehicleTrunkItem(this, vehicleId, itemId);
  }

  removeFromTrunk(vehicleId, itemId) {
    return removeVehicleTrunkItem(this, vehicleId, itemId);
  }

  persistVehicle(vehicle, { emit = true } = {}) {
    if (!vehicle) return false;
    const condition = {
      x: vehicle.x,
      y: vehicle.y,
      angle: vehicle.angle,
      health: vehicle.health,
      parked: vehicle.parked
    };
    const changed = Object.entries(condition).some(([key, value]) => {
      const previous = vehicle.lastPersisted[key];
      return typeof value === "number"
        ? Math.abs(Number(previous) - value) > 0.01
        : previous !== value;
    });
    if (!changed) return false;
    this.campaign.vehicles.updateCondition(vehicle.id, condition, { emit });
    vehicle.lastPersisted = { ...condition };
    return true;
  }

  updateCamera() {
    return updateVehicleCamera(this);
  }

  refreshVisibility() {
    return refreshVehicleVisibility(this);
  }

  updateHud() {
    return updateVehicleHud(this);
  }

  snapshot() {
    return vehicleSystemSnapshot(this);
  }

  summary() {
    return vehicleSystemSummary(this);
  }

  publish() {
    return publishVehicleState(this);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const current = this.currentVehicle();
    if (current) this.persistVehicle(current);
    for (const vehicle of this.vehicles) vehicle.container?.destroy?.();
    this.vehicles = [];
    this.hud?.destroy?.();
    this.hud = null;
    if (typeof window !== "undefined") {
      if (window.NBD_VEHICLES) delete window.NBD_VEHICLES;
      window.NBD_VEHICLES_READY = false;
    }
  }
}
