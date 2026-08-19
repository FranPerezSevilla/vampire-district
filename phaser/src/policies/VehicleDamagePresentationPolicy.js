import { VehicleSystem } from "../vehicles/VehicleSystem.js";

export function vehicleDamageStage(vehicle) {
  if (vehicle?.exploded) return "exploded";
  if (vehicle?.criticalDamage || (vehicle?.disabled && (Number(vehicle?.health) || 0) <= 0)) return "critical";
  const maximum = Math.max(1, Number(vehicle?.archetype?.maxHealth) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(vehicle?.health) || 0) / maximum));
  if (ratio <= 0.32) return "burning";
  if (ratio <= 0.68) return "smoking";
  return "clean";
}

function ensureDamageFx(system, vehicle) {
  if (vehicle.__viceBloodDamageFx) return vehicle.__viceBloodDamageFx;
  const scene = system.scene;
  const smokeA = scene.add.circle(-3, -1, 4.2, 0x24242a, 0.48).setVisible(false);
  const smokeB = scene.add.circle(2, 1, 3.2, 0x3b3940, 0.38).setVisible(false);
  const fireOuter = scene.add.ellipse(2, 0, 6.8, 10, 0xff5a1f, 0.88).setVisible(false);
  const fireInner = scene.add.ellipse(2, 0, 3.4, 6.4, 0xffd36a, 0.94).setVisible(false);
  vehicle.container?.add?.([smokeA, smokeB, fireOuter, fireInner]);

  scene.tweens?.add?.({
    targets: smokeA,
    y: -10,
    alpha: 0.14,
    scaleX: 1.55,
    scaleY: 1.7,
    duration: 920,
    yoyo: true,
    repeat: -1
  });
  scene.tweens?.add?.({
    targets: smokeB,
    y: -8,
    alpha: 0.10,
    scaleX: 1.45,
    scaleY: 1.55,
    duration: 730,
    delay: 180,
    yoyo: true,
    repeat: -1
  });
  scene.tweens?.add?.({
    targets: [fireOuter, fireInner],
    y: -2.5,
    scaleX: 0.82,
    scaleY: 1.16,
    alpha: 0.62,
    duration: 170,
    yoyo: true,
    repeat: -1
  });

  vehicle.__viceBloodDamageFx = {
    smoke: [smokeA, smokeB],
    fire: [fireOuter, fireInner]
  };
  return vehicle.__viceBloodDamageFx;
}

function restorePalette(vehicle) {
  const visual = vehicle?.visual;
  const archetype = vehicle?.archetype;
  if (!visual || !archetype) return;
  visual.body?.setFillStyle?.(archetype.color, 1);
  visual.body?.setStrokeStyle?.(1, archetype.trim, 0.95);
  visual.cabin?.setFillStyle?.(0x111522, 0.96);
  visual.hood?.setFillStyle?.(archetype.trim, 0.38);
  visual.nose?.setFillStyle?.(archetype.trim, 0.92);
}

function charWreck(vehicle) {
  const visual = vehicle?.visual;
  if (!visual) return;
  visual.body?.setFillStyle?.(0x171416, 1);
  visual.body?.setStrokeStyle?.(1, 0x3a2926, 0.95);
  visual.cabin?.setFillStyle?.(0x08090c, 0.98);
  visual.hood?.setFillStyle?.(0x190908, 1);
  visual.nose?.setFillStyle?.(0x24100d, 0.96);
  for (const wheel of visual.wheels || []) wheel?.setFillStyle?.(0x050506, 1);
}

export function applyVehicleDamagePresentation(system, vehicle) {
  if (!system?.scene || !vehicle?.container) return "clean";
  const stage = vehicleDamageStage(vehicle);
  const fx = stage === "clean" && !vehicle.__viceBloodDamageFx
    ? null
    : ensureDamageFx(system, vehicle);

  if (stage !== "exploded") restorePalette(vehicle);
  if (stage === "critical") {
    vehicle.visual?.hood?.setFillStyle?.(0x3f2027, 0.96);
    vehicle.container?.setAlpha?.(0.76);
  } else if (stage === "exploded") {
    charWreck(vehicle);
    vehicle.container?.setAlpha?.(0.84);
  } else {
    vehicle.container?.setAlpha?.(vehicle.disabled ? 0.64 : 1);
  }

  if (!fx) return stage;
  const smokeVisible = stage !== "clean";
  const fireVisible = ["burning", "critical", "exploded"].includes(stage);
  const smokeScale = stage === "exploded" ? 1.5 : stage === "critical" ? 1.25 : stage === "burning" ? 1.05 : 0.78;
  const fireScale = stage === "exploded" ? 1.35 : stage === "critical" ? 1.12 : 0.82;

  fx.smoke.forEach((shape, index) => {
    shape.setVisible(smokeVisible);
    shape.setScale(smokeScale * (index ? 0.86 : 1));
  });
  fx.fire.forEach((shape, index) => {
    shape.setVisible(fireVisible);
    shape.setScale(fireScale * (index ? 0.82 : 1));
  });
  return stage;
}

export function installVehicleDamagePresentationPolicy() {
  if (VehicleSystem.prototype.__viceBloodDamagePresentationPolicy) return;
  VehicleSystem.prototype.__viceBloodDamagePresentationPolicy = true;

  const originalCreateVehicle = VehicleSystem.prototype.createVehicle;
  const originalDamageVehicle = VehicleSystem.prototype.damageVehicle;
  const originalMarkCritical = VehicleSystem.prototype.markVehicleCritical;
  const originalExplodeVehicle = VehicleSystem.prototype.explodeVehicle;
  const originalSyncFromCampaign = VehicleSystem.prototype.syncFromCampaign;

  VehicleSystem.prototype.createVehicle = function viceBloodCreateVehicle(...args) {
    const vehicle = originalCreateVehicle.apply(this, args);
    applyVehicleDamagePresentation(this, vehicle);
    return vehicle;
  };

  VehicleSystem.prototype.damageVehicle = function viceBloodDamageVehicle(vehicleId, ...args) {
    const result = originalDamageVehicle.call(this, vehicleId, ...args);
    const vehicle = this.vehicle?.(vehicleId);
    if (vehicle) applyVehicleDamagePresentation(this, vehicle);
    return result;
  };

  VehicleSystem.prototype.markVehicleCritical = function viceBloodMarkVehicleCritical(vehicle, ...args) {
    const result = originalMarkCritical.call(this, vehicle, ...args);
    if (result) applyVehicleDamagePresentation(this, vehicle);
    return result;
  };

  VehicleSystem.prototype.explodeVehicle = function viceBloodExplodeVehicle(vehicle, ...args) {
    const result = originalExplodeVehicle.call(this, vehicle, ...args);
    if (result) applyVehicleDamagePresentation(this, vehicle);
    return result;
  };

  VehicleSystem.prototype.syncFromCampaign = function viceBloodSyncFromCampaign(vehicleId, ...args) {
    const result = originalSyncFromCampaign.call(this, vehicleId, ...args);
    const vehicle = this.vehicle?.(vehicleId);
    if (vehicle) applyVehicleDamagePresentation(this, vehicle);
    return result;
  };
}
