import { RawAudio } from "../systems/RawAudioSystem.js";
import { vehicleHealthPercent, vehicleImpactDamage } from "../vehicles/VehicleModel.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

export function trafficImpactTier(speed, {
  hardThreshold = 125,
  severeThreshold = 210
} = {}) {
  const impact = Math.abs(finite(speed));
  if (impact >= Math.max(hardThreshold, severeThreshold)) return "severe";
  if (impact >= Math.max(0, hardThreshold)) return "hard";
  return "soft";
}

export function trafficImpactDamage(speed, {
  hardThreshold = 125,
  severeThreshold = 210,
  damageThreshold = 105,
  damageScale = 0.018,
  hardMinimumDamage = 4,
  severeMinimumDamage = 16,
  severeDamageMultiplier = 1.35
} = {}) {
  const tier = trafficImpactTier(speed, { hardThreshold, severeThreshold });
  if (tier === "soft") return 0;
  const base = vehicleImpactDamage(Math.abs(finite(speed)), {
    threshold: Math.max(0, finite(damageThreshold, 105)),
    scale: Math.max(0, finite(damageScale, 0.018))
  });
  if (tier === "severe") {
    return round(Math.max(base, Math.max(0, finite(severeMinimumDamage, 16)))
      * Math.max(1, finite(severeDamageMultiplier, 1.35)), 1);
  }
  return round(Math.max(base, Math.max(0, finite(hardMinimumDamage, 4))), 1);
}

export function trafficImpactExposure(speed, {
  hardThreshold = 125,
  severeThreshold = 210,
  hardExposure = 2,
  severeExposure = 5,
  maximumExposure = 7
} = {}) {
  const impact = Math.abs(finite(speed));
  const tier = trafficImpactTier(impact, { hardThreshold, severeThreshold });
  if (tier === "soft") return 0;
  if (tier === "severe") {
    return clamp(
      Math.max(1, finite(severeExposure, 5)) + Math.floor(Math.max(0, impact - severeThreshold) / 70),
      1,
      Math.max(1, finite(maximumExposure, 7))
    );
  }
  return clamp(
    Math.max(1, finite(hardExposure, 2)) + Math.floor(Math.max(0, impact - hardThreshold) / 60),
    1,
    Math.max(1, finite(maximumExposure, 7))
  );
}

export class TrafficImpactConsequencesSystem {
  constructor(scene, options = {}) {
    if (!scene?.trafficPhysicalConsequencesSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficImpactConsequencesSystem requires traffic physical consequences and vehicle systems.");
    }
    this.scene = scene;
    this.physical = scene.trafficPhysicalConsequencesSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.options = { ...options };
    this.states = new Map();
    this.hardThreshold = 125;
    this.severeThreshold = 210;
    this.damageThreshold = 105;
    this.damageScale = 0.018;
    this.hardMinimumDamage = 4;
    this.severeMinimumDamage = 16;
    this.severeDamageMultiplier = 1.35;
    this.hardExposure = 2;
    this.severeExposure = 5;
    this.maximumExposure = 7;
    this.hardHeatMinimum = 7;
    this.severeHeatMinimum = 15;
    this.maximumHeat = 24;
    this.impactCooldownSeconds = 0.9;
    this.hardHoldSeconds = 0.42;
    this.severeStallSeconds = 2.2;
    this.hardSpeedRetention = 0.68;
    this.severeSpeedRetention = 0.35;
    this.totalSoftContacts = 0;
    this.totalHardImpacts = 0;
    this.totalSevereImpacts = 0;
    this.totalSuppressedImpacts = 0;
    this.totalDamage = 0;
    this.lastImpact = null;
    this.ready = false;
    this.destroyed = false;
    this.lastPublishedKey = "";
    this.originalUpdateDriving = null;
    this.impactUpdateDriving = null;
    this.originalBehaviorConstraintFor = null;
    this.impactBehaviorConstraintFor = null;
    this.installHooks();
    this.installBrowserApi();
    this.initialization = Promise.resolve(this.physical.initialization)
      .then(() => {
        this.configure();
        this.ready = true;
        this.update(0, { force: true });
        return this;
      });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  configure() {
    const config = this.physical.materializer?.lanes?.impacts || {};
    const option = (key, fallback) => finite(this.options[key], finite(config[key], fallback));
    this.hardThreshold = Math.max(1, option("hardThreshold", 125));
    this.severeThreshold = Math.max(this.hardThreshold + 1, option("severeThreshold", 210));
    this.damageThreshold = clamp(option("damageThreshold", 105), 0, this.hardThreshold);
    this.damageScale = Math.max(0, option("damageScale", 0.018));
    this.hardMinimumDamage = Math.max(0, option("hardMinimumDamage", 4));
    this.severeMinimumDamage = Math.max(this.hardMinimumDamage, option("severeMinimumDamage", 16));
    this.severeDamageMultiplier = Math.max(1, option("severeDamageMultiplier", 1.35));
    this.hardExposure = Math.max(1, option("hardExposure", 2));
    this.severeExposure = Math.max(this.hardExposure, option("severeExposure", 5));
    this.maximumExposure = Math.max(this.severeExposure, option("maximumExposure", 7));
    this.hardHeatMinimum = Math.max(1, option("hardHeatMinimum", 7));
    this.severeHeatMinimum = Math.max(this.hardHeatMinimum, option("severeHeatMinimum", 15));
    this.maximumHeat = Math.max(this.severeHeatMinimum, option("maximumHeat", 24));
    this.impactCooldownSeconds = clamp(option("impactCooldownSeconds", 0.9), 0.2, 3);
    this.hardHoldSeconds = clamp(option("hardHoldSeconds", 0.42), 0.1, 1.5);
    this.severeStallSeconds = clamp(option("severeStallSeconds", 2.2), this.hardHoldSeconds, 6);
    this.hardSpeedRetention = clamp(option("hardSpeedRetention", 0.68), 0.2, 0.9);
    this.severeSpeedRetention = clamp(option("severeSpeedRetention", 0.35), 0.05, this.hardSpeedRetention);
  }

  installHooks() {
    const impacts = this;
    this.originalUpdateDriving = this.vehicleSystem.updateDriving;
    this.impactUpdateDriving = function impactAwareDriving(dt, frame) {
      const vehicleBefore = this.currentVehicle?.() || null;
      const contactCountBefore = impacts.physical.totalContacts;
      const result = impacts.originalUpdateDriving.call(this, dt, frame);
      if (vehicleBefore && impacts.physical.totalContacts > contactCountBefore && impacts.physical.lastContact) {
        impacts.resolveContact(vehicleBefore, impacts.physical.lastContact);
      }
      return result;
    };
    this.vehicleSystem.updateDriving = this.impactUpdateDriving;

    this.originalBehaviorConstraintFor = this.physical.behaviorConstraintFor;
    this.impactBehaviorConstraintFor = function impactAwareConstraint(slot) {
      const impactConstraint = impacts.constraintFor(slot);
      return impactConstraint || impacts.originalBehaviorConstraintFor.call(this, slot);
    };
    this.physical.behaviorConstraintFor = this.impactBehaviorConstraintFor;
  }

  stateFor(tokenId) {
    const id = String(tokenId || "");
    if (!id) return null;
    let state = this.states.get(id);
    if (!state) {
      state = {
        tokenId: id,
        cooldownSeconds: 0,
        stallSeconds: 0,
        lastTier: "soft",
        lastImpactSpeed: 0,
        lastDamage: 0,
        lastExposure: 0,
        lastHeat: 0,
        lastVehicleId: null,
        hardImpacts: 0,
        severeImpacts: 0,
        suppressedImpacts: 0
      };
      this.states.set(id, state);
    }
    return state;
  }

  tierFor(speed) {
    return trafficImpactTier(speed, {
      hardThreshold: this.hardThreshold,
      severeThreshold: this.severeThreshold
    });
  }

  damageFor(speed) {
    return trafficImpactDamage(speed, {
      hardThreshold: this.hardThreshold,
      severeThreshold: this.severeThreshold,
      damageThreshold: this.damageThreshold,
      damageScale: this.damageScale,
      hardMinimumDamage: this.hardMinimumDamage,
      severeMinimumDamage: this.severeMinimumDamage,
      severeDamageMultiplier: this.severeDamageMultiplier
    });
  }

  exposureFor(speed) {
    return trafficImpactExposure(speed, {
      hardThreshold: this.hardThreshold,
      severeThreshold: this.severeThreshold,
      hardExposure: this.hardExposure,
      severeExposure: this.severeExposure,
      maximumExposure: this.maximumExposure
    });
  }

  heatFor(speed, tier) {
    const impact = Math.abs(finite(speed));
    if (tier === "severe") return clamp(impact * 0.07, this.severeHeatMinimum, this.maximumHeat);
    if (tier === "hard") return clamp(impact * 0.055, this.hardHeatMinimum, this.maximumHeat);
    return 0;
  }

  constraintFor(slot) {
    const state = slot?.tokenId ? this.states.get(slot.tokenId) : null;
    if (!state || state.stallSeconds <= 0) return null;
    return {
      reason: "impact-stalled",
      blockerId: state.lastVehicleId || "traffic-impact"
    };
  }

  retainVehicleSpeed(vehicle, tier) {
    if (!vehicle || vehicle.disabled) return vehicle;
    const factor = tier === "severe" ? this.severeSpeedRetention : this.hardSpeedRetention;
    vehicle.speed = finite(vehicle.speed) * factor;
    vehicle.velocityX = Math.cos(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.velocityY = Math.sin(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.driftAngle = finite(vehicle.driftAngle) * factor;
    return vehicle;
  }

  resolveContact(vehicle, contact) {
    const impactSpeed = Math.abs(finite(contact?.impactSpeed));
    const tier = this.tierFor(impactSpeed);
    const state = this.stateFor(contact?.tokenId);
    if (!state) return null;

    if (tier === "soft") {
      this.totalSoftContacts++;
      this.lastImpact = {
        tokenId: state.tokenId,
        vehicleId: vehicle.id,
        tier,
        impactSpeed,
        damage: 0,
        exposure: 0,
        heat: 0,
        suppressed: false
      };
      this.publish(true);
      return this.lastImpact;
    }

    if (state.cooldownSeconds > 0) {
      state.suppressedImpacts++;
      this.totalSuppressedImpacts++;
      this.lastImpact = {
        tokenId: state.tokenId,
        vehicleId: vehicle.id,
        tier,
        impactSpeed,
        damage: 0,
        exposure: 0,
        heat: 0,
        suppressed: true
      };
      this.publish(true);
      return this.lastImpact;
    }

    const damage = this.damageFor(impactSpeed);
    const exposure = this.exposureFor(impactSpeed);
    const heat = this.heatFor(impactSpeed, tier);
    state.cooldownSeconds = this.impactCooldownSeconds;
    state.stallSeconds = Math.max(
      state.stallSeconds,
      tier === "severe" ? this.severeStallSeconds : this.hardHoldSeconds
    );
    state.lastTier = tier;
    state.lastImpactSpeed = impactSpeed;
    state.lastDamage = damage;
    state.lastExposure = exposure;
    state.lastHeat = heat;
    state.lastVehicleId = vehicle.id;
    if (tier === "severe") {
      state.severeImpacts++;
      this.totalSevereImpacts++;
    } else {
      state.hardImpacts++;
      this.totalHardImpacts++;
    }
    this.totalDamage += damage;

    const physicalState = this.physical.states.get(state.tokenId);
    if (physicalState) {
      physicalState.holdSeconds = Math.max(physicalState.holdSeconds, state.stallSeconds);
      physicalState.lastReason = tier === "severe" ? "severe-impact" : "hard-impact";
      physicalState.lastImpactSpeed = impactSpeed;
      physicalState.lastVehicleId = vehicle.id;
    }

    this.vehicleSystem.damageVehicle(vehicle.id, damage, {
      reason: tier === "severe" ? "severe traffic impact" : "traffic impact",
      persist: false
    });
    this.retainVehicleSpeed(vehicle, tier);
    this.vehicleSystem.persistVehicle?.(vehicle, { emit: false });

    const reason = tier === "severe"
      ? `${vehicle.name} slams into traffic at high speed.`
      : `${vehicle.name} collides hard with traffic.`;
    this.scene.exposureSystem?.add?.(exposure, reason);
    this.scene.policeSystem?.addHeat?.(vehicle.x, vehicle.y, heat, tier === "severe" ? "severe traffic collision" : "traffic collision");
    RawAudio.play("bodyDrop", { cooldown: 0.4 });

    const health = vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth);
    this.scene.lastActionText = tier === "severe"
      ? `Severe traffic impact · ${damage} hull damage · ${health}% hull · police alerted.`
      : `Hard traffic impact · ${damage} hull damage · ${health}% hull.`;
    this.lastImpact = {
      tokenId: state.tokenId,
      vehicleId: vehicle.id,
      tier,
      impactSpeed,
      damage,
      exposure,
      heat,
      suppressed: false,
      disabled: Boolean(vehicle.disabled)
    };
    this.publish(true);
    return this.lastImpact;
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const seconds = Math.max(0, finite(dt));
    const activeIds = new Set(this.physical.activeSlots().map(slot => slot.tokenId));
    let changed = false;
    for (const [tokenId, state] of this.states) {
      if (!activeIds.has(tokenId)) {
        this.states.delete(tokenId);
        changed = true;
        continue;
      }
      const beforeCooldown = state.cooldownSeconds;
      const beforeStall = state.stallSeconds;
      state.cooldownSeconds = Math.max(0, state.cooldownSeconds - seconds);
      state.stallSeconds = Math.max(0, state.stallSeconds - seconds);
      changed = changed || beforeCooldown !== state.cooldownSeconds || beforeStall !== state.stallSeconds;
      if (state.stallSeconds > 0) {
        const physicalState = this.physical.states.get(tokenId);
        if (physicalState) physicalState.holdSeconds = Math.max(physicalState.holdSeconds, state.stallSeconds);
      }
    }
    this.publish(force || changed);
    return this.states.size > 0;
  }

  snapshot() {
    const impacts = [...this.states.values()]
      .map(state => ({
        tokenId: state.tokenId,
        cooldownSeconds: round(state.cooldownSeconds, 3),
        stallSeconds: round(state.stallSeconds, 3),
        lastTier: state.lastTier,
        lastImpactSpeed: round(state.lastImpactSpeed),
        lastDamage: round(state.lastDamage, 1),
        lastExposure: round(state.lastExposure),
        lastHeat: round(state.lastHeat, 1),
        lastVehicleId: state.lastVehicleId,
        hardImpacts: state.hardImpacts,
        severeImpacts: state.severeImpacts,
        suppressedImpacts: state.suppressedImpacts
      }))
      .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    return {
      ready: this.ready,
      hardThreshold: round(this.hardThreshold),
      severeThreshold: round(this.severeThreshold),
      impactCooldownSeconds: round(this.impactCooldownSeconds, 2),
      severeStallSeconds: round(this.severeStallSeconds, 2),
      totalSoftContacts: this.totalSoftContacts,
      totalHardImpacts: this.totalHardImpacts,
      totalSevereImpacts: this.totalSevereImpacts,
      totalSuppressedImpacts: this.totalSuppressedImpacts,
      totalDamage: round(this.totalDamage, 1),
      activeStalls: impacts.filter(item => item.stallSeconds > 0).length,
      lastImpact: this.lastImpact ? { ...this.lastImpact, impactSpeed: round(this.lastImpact.impactSpeed), heat: round(this.lastImpact.heat, 1) } : null,
      impacts
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.totalHardImpacts,
      snapshot.totalSevereImpacts,
      snapshot.totalSuppressedImpacts,
      snapshot.activeStalls,
      snapshot.lastImpact
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficImpactText: `Traffic impacts · ${snapshot.totalHardImpacts} hard · ${snapshot.totalSevereImpacts} severe`,
      trafficImpactState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_IMPACTS_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_IMPACTS = Object.freeze({
      snapshot: () => this.snapshot(),
      classify: speed => this.tierFor(speed),
      damage: speed => this.damageFor(speed),
      exposure: speed => this.exposureFor(speed),
      step: (seconds = 0.1) => {
        let remaining = Math.max(0, finite(seconds, 0.1));
        while (remaining > 0.0001) {
          const dt = Math.min(0.05, remaining);
          this.update(dt, { force: true });
          remaining -= dt;
        }
        return this.snapshot();
      }
    });
    window.NBD_TRAFFIC_IMPACTS_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.vehicleSystem.updateDriving === this.impactUpdateDriving) {
      this.vehicleSystem.updateDriving = this.originalUpdateDriving;
    }
    if (this.physical.behaviorConstraintFor === this.impactBehaviorConstraintFor) {
      this.physical.behaviorConstraintFor = this.originalBehaviorConstraintFor;
    }
    this.states.clear();
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_IMPACTS;
      window.NBD_TRAFFIC_IMPACTS_READY = false;
    }
  }
}
