import { RawAudio } from "../systems/RawAudioSystem.js";

export const VEHICLE_EXPLOSION_PRESENTATION = Object.freeze({
  cleanupMs: 860,
  duplicateGuardMs: 1200,
  depth: 76,
  debrisCount: 8
});

const DEBRIS_VECTORS = Object.freeze([
  Object.freeze({ x: 1.00, y: 0.00 }),
  Object.freeze({ x: 0.70, y: 0.70 }),
  Object.freeze({ x: 0.00, y: 1.00 }),
  Object.freeze({ x: -0.70, y: 0.70 }),
  Object.freeze({ x: -1.00, y: 0.00 }),
  Object.freeze({ x: -0.70, y: -0.70 }),
  Object.freeze({ x: 0.00, y: -1.00 }),
  Object.freeze({ x: 0.70, y: -0.70 })
]);

function safeDepth(object, depth) {
  object?.setDepth?.(depth);
  return object;
}

function safeDestroy(object) {
  if (!object || object.destroyed) return;
  object.destroy?.();
}

function tween(scene, target, config) {
  if (!target) return null;
  if (!scene?.tweens?.add) return null;
  return scene.tweens.add({ targets: target, ...config });
}

export function playVehicleExplosionSound() {
  // A dedicated semantic cue assembled on the existing raw-audio bus. This
  // keeps the explosion under the same master/narrative ducking authority as
  // every other world sound while giving it a distinct boom/crack signature.
  RawAudio.play("vehicleCollisionHeavy", { cooldown: 0 });
  RawAudio.play("kill", { cooldown: 0 });
  RawAudio.play("breakLight", { cooldown: 0 });
}

export function presentVehicleExplosion(scene, payload = {}) {
  const x = Number(payload.x) || 0;
  const y = Number(payload.y) || 0;
  const objects = [];

  playVehicleExplosionSound();

  const core = safeDepth(scene?.add?.circle?.(x, y, 10, 0xfff4d6, 0.98), VEHICLE_EXPLOSION_PRESENTATION.depth + 3);
  const fire = safeDepth(scene?.add?.circle?.(x, y, 23, 0xff6f24, 0.88), VEHICLE_EXPLOSION_PRESENTATION.depth + 2);
  const ring = safeDepth(scene?.add?.circle?.(x, y, 18, 0x000000, 0), VEHICLE_EXPLOSION_PRESENTATION.depth + 1);
  ring?.setStrokeStyle?.(3, 0xffb34e, 0.94);
  objects.push(core, fire, ring);

  tween(scene, core, { scale: 3.8, alpha: 0, duration: 180, ease: "Cubic.Out" });
  tween(scene, fire, { scale: 2.6, alpha: 0, duration: 330, ease: "Cubic.Out" });
  tween(scene, ring, { scale: 4.8, alpha: 0, duration: 460, ease: "Cubic.Out" });

  const smokeOffsets = [
    { x: -12, y: -8, radius: 11 },
    { x: 13, y: -10, radius: 13 },
    { x: -5, y: 12, radius: 14 },
    { x: 15, y: 9, radius: 10 }
  ];
  for (let index = 0; index < smokeOffsets.length; index++) {
    const offset = smokeOffsets[index];
    const smoke = safeDepth(
      scene?.add?.circle?.(x + offset.x, y + offset.y, offset.radius, index % 2 ? 0x2e2828 : 0x423637, 0.48),
      VEHICLE_EXPLOSION_PRESENTATION.depth
    );
    objects.push(smoke);
    tween(scene, smoke, {
      x: x + offset.x * 1.8,
      y: y + offset.y * 1.8 - 12,
      scale: 2.0,
      alpha: 0,
      duration: 720,
      ease: "Quad.Out"
    });
  }

  for (let index = 0; index < VEHICLE_EXPLOSION_PRESENTATION.debrisCount; index++) {
    const vector = DEBRIS_VECTORS[index];
    const distance = 48 + (index % 3) * 11;
    const debris = safeDepth(
      scene?.add?.rectangle?.(x, y, 4 + (index % 2), 3, index % 3 === 0 ? 0xffb15a : 0x8e4934, 0.94),
      VEHICLE_EXPLOSION_PRESENTATION.depth + 2
    );
    debris?.setRotation?.(index * Math.PI / 4);
    objects.push(debris);
    tween(scene, debris, {
      x: x + vector.x * distance,
      y: y + vector.y * distance,
      rotation: index * Math.PI / 4 + 1.5,
      alpha: 0,
      duration: 520 + (index % 3) * 70,
      ease: "Cubic.Out"
    });
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return false;
    cleaned = true;
    for (const object of objects) safeDestroy(object);
    return true;
  };

  scene?.time?.delayedCall?.(VEHICLE_EXPLOSION_PRESENTATION.cleanupMs, cleanup);
  return { objects: objects.filter(Boolean), cleanup };
}

export function installVehicleExplosionPresentation(scene) {
  if (!scene?.events?.on) return () => {};
  const recentlyPresented = new Set();

  const onExplosion = payload => {
    const vehicleId = String(payload?.vehicleId || "unknown");
    if (recentlyPresented.has(vehicleId)) return false;
    recentlyPresented.add(vehicleId);
    presentVehicleExplosion(scene, payload);
    scene?.time?.delayedCall?.(
      VEHICLE_EXPLOSION_PRESENTATION.duplicateGuardMs,
      () => recentlyPresented.delete(vehicleId)
    );
    return true;
  };

  scene.events.on("vehicle:exploded", onExplosion);
  const remove = () => {
    scene.events?.off?.("vehicle:exploded", onExplosion);
    recentlyPresented.clear();
  };
  scene.events.once?.("shutdown", remove);
  scene.events.once?.("destroy", remove);
  return remove;
}
