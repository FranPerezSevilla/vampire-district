import { VEHICLE_OWNERSHIP, vehicleArchetype, vehicleDefinitions } from "../data/vehicles.js";
import { createVehicleState } from "./VehicleModel.js";
import { createVehicleHud, installVehicleBrowserApi, paintVehicle, publishVehicleState, refreshVehicleVisibility, updateVehicleHud, vehicleSystemSnapshot, vehicleSystemSummary } from "./VehicleView.js";
import { canVehicleOccupy, filterVehicleInputFrame, handleVehicleWorldCollision, updateVehicleCamera, updateVehicleDriving } from "./VehicleDriving.js";
import { canEnterVehicle, collectVehicleInteractions, enterVehicle, exitVehicle, inspectVehicleTrunk, removeVehicleTrunkItem, storeVehicleTrunkItem, vehicleStatusLabel, vehicleTrunkLabel } from "./VehicleInteractions.js";
import { VEHICLE_DESTRUCTION, explosionDamageAtDistance, vehicleDestructionTransition } from "./VehicleDestructionPolicy.js";

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
    this.handbrakeActive = false;
    this.cameraLookAheadX = 0;
    this.cameraLookAheadY = 0;
    this.pedestrianCooldowns = new Map();
    this.transientSequence = 0;
    this.destroyed = false;
    this.vehicles = vehicleDefinitions.map(definition => this.createVehicle(definition));
    this.hud = createVehicleHud(scene);
    this.disposeMaintenance = campaign.events?.on?.("vehicle:maintenance-completed", event => {
      this.syncFromCampaign(event.payload.vehicleId);
    }) || null;
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
      transient: Boolean(definition.transient),
      transientSequence: Number(definition.transientSequence) || 0,
      criticalDamage: Boolean(state.disabled && state.health <= 0),
      exploded: false,
      status: definition.transient
        ? (definition.status || definition.ownership || VEHICLE_OWNERSHIP.STOLEN)
        : this.campaign.vehicles.status(definition),
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

  addTransientVehicle(definition) {
    const transientDefinition = {
      ...definition,
      ownership: definition.ownership || VEHICLE_OWNERSHIP.STOLEN,
      status: definition.status || VEHICLE_OWNERSHIP.STOLEN,
      transient: true,
      transientSequence: ++this.transientSequence
    };
    const vehicle = this.createVehicle(transientDefinition);
    this.vehicles.push(vehicle);
    this.scene.entityStreamSystem?.applyVehicleState?.(vehicle);
    this.refreshVisibility();
    this.publish();
    return vehicle;
  }

  removeTransientVehicle(vehicleOrId, { publish = true } = {}) {
    const vehicle = typeof vehicleOrId === "string" ? this.vehicle(vehicleOrId) : vehicleOrId;
    if (!vehicle?.transient || vehicle.id === this.currentVehicleId) return false;
    const index = this.vehicles.indexOf(vehicle);
    if (index < 0) return false;
    this.vehicles.splice(index, 1);
    this.scene.entityStreamSystem?.vehicleRecords?.delete?.(vehicle.id);
    vehicle.container?.destroy?.();
    if (publish) this.publish();
    return true;
  }

  transientRemovalPriority(vehicle) {
    const focus = this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 };
    const dx = Number(vehicle.x) - Number(focus.x);
    const dy = Number(vehicle.y) - Number(focus.y);
    const view = this.scene.cameras?.main?.worldView;
    const margin = 160;
    const onCamera = Boolean(view
      && vehicle.x >= view.x - margin
      && vehicle.x <= view.x + view.width + margin
      && vehicle.y >= view.y - margin
      && vehicle.y <= view.y + view.height + margin);
    return { onCamera, distanceSquared: dx * dx + dy * dy };
  }

  pruneTransientVehicles(maximum = 6) {
    const limit = Math.max(0, Math.floor(Number(maximum) || 0));
    const removable = this.vehicles
      .filter(vehicle => vehicle.transient && vehicle.id !== this.currentVehicleId)
      .sort((left, right) => {
        const leftPriority = this.transientRemovalPriority(left);
        const rightPriority = this.transientRemovalPriority(right);
        return Number(leftPriority.onCamera) - Number(rightPriority.onCamera)
          || rightPriority.distanceSquared - leftPriority.distanceSquared
          || left.transientSequence - right.transientSequence;
      });
    let transientCount = this.vehicles.filter(vehicle => vehicle.transient).length;
    let removed = 0;
    while (transientCount > limit && removable.length) {
      const vehicle = removable.shift();
      if (!this.removeTransientVehicle(vehicle, { publish: false })) continue;
      transientCount--;
      removed++;
    }
    if (removed) this.publish();
    return removed;
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

  damageVehicle(vehicleId, amount, { reason = "damage", persist = true, destructive = false } = {}) {
    const vehicle = this.vehicle(vehicleId);
    const damage = Math.max(0, Number(amount) || 0);
    if (!vehicle || !damage || vehicle.exploded) return false;
    const transition = vehicleDestructionTransition(vehicle, damage, { destructive });
    if (transition.action === "none") return false;
    vehicle.health = transition.after;
    if (transition.action === "explode") {
      this.explodeVehicle(vehicle, { reason });
    } else if (transition.action === "critical") {
      this.markVehicleCritical(vehicle, { reason });
    }
    if (persist) this.persistVehicle(vehicle);
    this.updateHud();
    this.publish();
    return true;
  }

  markVehicleCritical(vehicle, { reason = "damage" } = {}) {
    if (!vehicle || vehicle.exploded) return false;
    vehicle.health = 0;
    vehicle.disabled = true;
    vehicle.criticalDamage = true;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.gear = 1;
    vehicle.gearShiftTimer = 0;
    vehicle.handbrake = false;
    vehicle.parked = true;
    this.handbrakeActive = false;
    vehicle.container?.setAlpha?.(0.52);
    vehicle.visual?.hood?.setFillStyle?.(0x3f2027, 0.92);
    this.scene.lastActionText = this.currentVehicleId === vehicle.id
      ? `${vehicle.name} is critically damaged. Get out before another hit ignites it.`
      : `${vehicle.name} is critically damaged by ${reason}.`;
    this.scene.events?.emit?.("vehicle:critical", {
      vehicleId: vehicle.id,
      occupied: this.currentVehicleId === vehicle.id,
      reason
    });
    this.scene.events?.emit?.("vehicle:disabled", {
      vehicleId: vehicle.id,
      occupied: this.currentVehicleId === vehicle.id,
      reason
    });
    return true;
  }

  explosionNpcDamage(vehicle) {
    const radius = VEHICLE_DESTRUCTION.explosionRadius;
    const candidates = this.scene.npcSystem?.queryRadius?.(
      vehicle.x,
      vehicle.y,
      radius,
      this.scene.currentLayer
    ) || this.scene.npcSystem?.npcs || [];
    let affected = 0;
    for (const npc of candidates) {
      if (!npc || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted || npc.layer !== this.scene.currentLayer) continue;
      const distance = Math.hypot(npc.x - vehicle.x, npc.y - vehicle.y);
      const damage = explosionDamageAtDistance(distance, {
        radius,
        maxDamage: VEHICLE_DESTRUCTION.npcMaxDamage,
        minDamage: VEHICLE_DESTRUCTION.npcMinDamage
      });
      if (damage <= 0) continue;
      this.scene.combatSystem?.applyHit?.(npc, {
        id: "vehicle_explosion",
        name: "Vehicle explosion",
        attackType: "explosion",
        damage: Math.max(1, Math.round(damage)),
        staggerMs: 900,
        feedbackMs: 700
      }, 0);
      affected++;
    }
    return affected;
  }

  explodeVehicle(vehicle, { reason = "destructive damage" } = {}) {
    if (!vehicle || vehicle.exploded) return false;
    const occupied = this.currentVehicleId === vehicle.id;
    vehicle.health = 0;
    vehicle.disabled = true;
    vehicle.criticalDamage = false;
    vehicle.exploded = true;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.gear = 1;
    vehicle.gearShiftTimer = 0;
    vehicle.handbrake = false;
    vehicle.parked = true;
    this.handbrakeActive = false;
    RawAudio.stopVehicleEngine?.(`player:${vehicle.id}`);
    vehicle.container?.setAlpha?.(0.30);
    vehicle.visual?.hood?.setFillStyle?.(0x1c0b0b, 1);

    const playerDamageSystem = this.scene.playerDamageSystem;
    let playerDamage = 0;
    if (occupied) {
      this.currentVehicleId = null;
      this.scene.registry?.set?.("vehicleOccupied", null);
      this.scene.player?.setActive?.(true);
      this.scene.player?.setVisible?.(true);
      this.scene.player?.setPosition?.(vehicle.x, vehicle.y);
      if (this.scene.player?.body) {
        this.scene.player.body.enable = true;
        this.scene.player.body.setEnable?.(true);
        this.scene.player.body.setVelocity?.(0, 0);
      }
      if (playerDamageSystem && !playerDamageSystem.isDead?.()) {
        playerDamageSystem.state.invulnerableUntil = 0;
        playerDamageSystem.damagePlayer(vehicle, {
          id: "vehicle_explosion",
          label: `${vehicle.name} explosion`,
          damageKind: "explosion",
          vitalityDamage: VEHICLE_DESTRUCTION.occupantVitalityDamage
        });
        playerDamage = VEHICLE_DESTRUCTION.occupantVitalityDamage;
      }
      this.scene.cameras?.main?.setFollowOffset?.(0, 0);
      this.scene.cameras?.main?.startFollow?.(this.scene.player, true, 0.12, 0.12);
    } else if (playerDamageSystem && !playerDamageSystem.isDead?.() && this.scene.currentLayer === vehicle.layer) {
      const distance = Math.hypot(this.scene.player.x - vehicle.x, this.scene.player.y - vehicle.y);
      playerDamage = explosionDamageAtDistance(distance, {
        radius: VEHICLE_DESTRUCTION.explosionRadius,
        maxDamage: VEHICLE_DESTRUCTION.playerMaxDamage,
        minDamage: VEHICLE_DESTRUCTION.playerMinDamage
      });
      if (playerDamage > 0) {
        playerDamageSystem.damagePlayer(vehicle, {
          id: "vehicle_explosion",
          label: `${vehicle.name} explosion`,
          damageKind: "explosion",
          vitalityDamage: playerDamage
        });
      }
    }

    const affectedNpcs = this.explosionNpcDamage(vehicle);
    this.scene.cameras?.main?.shake?.(220, 0.0042);
    this.scene.lastActionText = occupied
      ? `${vehicle.name} explodes with you inside.`
      : `${vehicle.name} explodes after ${reason}.`;
    this.scene.events?.emit?.("vehicle:exploded", {
      vehicleId: vehicle.id,
      occupied,
      reason,
      x: vehicle.x,
      y: vehicle.y,
      radius: VEHICLE_DESTRUCTION.explosionRadius,
      affectedNpcs,
      playerDamage
    });
    return true;
  }

  syncFromCampaign(vehicleId) {
    const vehicle = this.vehicle(vehicleId);
    if (!vehicle || vehicle.transient) return false;
    const condition = this.campaign.vehicles.condition(vehicle);
    vehicle.x = condition.x;
    vehicle.y = condition.y;
    vehicle.angle = condition.angle;
    vehicle.travelAngle = condition.angle;
    vehicle.driftAngle = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.speed = 0;
    vehicle.gear = 1;
    vehicle.gearShiftTimer = 0;
    vehicle.health = condition.health;
    vehicle.disabled = condition.disabled;
    vehicle.criticalDamage = Boolean(vehicle.disabled && vehicle.health <= 0);
    vehicle.exploded = false;
    vehicle.parked = condition.parked;
    vehicle.handbrake = false;
    vehicle.status = this.campaign.vehicles.status(vehicle);
    vehicle.container
      .setPosition(vehicle.x, vehicle.y)
      .setRotation(vehicle.angle)
      .setAlpha(vehicle.disabled ? 0.52 : 1);
    vehicle.visual.hood.setFillStyle(
      vehicle.disabled ? 0x3f2027 : vehicle.archetype.trim,
      vehicle.disabled ? 0.92 : 0.38
    );
    vehicle.visual.label.setRotation(-vehicle.angle);
    vehicle.lastPersisted = {
      x: vehicle.x,
      y: vehicle.y,
      angle: vehicle.angle,
      health: vehicle.health,
      parked: vehicle.parked
    };
    this.handbrakeActive = false;
    this.refreshVisibility();
    this.updateHud();
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
    if (!vehicle || vehicle.transient) return false;
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
    this.disposeMaintenance?.();
    this.disposeMaintenance = null;
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
