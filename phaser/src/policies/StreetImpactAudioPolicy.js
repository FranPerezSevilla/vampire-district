import { CombatSystem } from "../combat/CombatSystem.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const RANGE_EPSILON = 1e-5;

export function projectileExpiredAgainstStreet(scene, projectile) {
  return Boolean(
    projectile
    && projectile.alive === false
    && (Number(projectile.remainingRange) || 0) <= RANGE_EPSILON
    && projectile.layer === LAYERS.STREET
    && scene?.currentLayer === LAYERS.STREET
  );
}

export function installStreetImpactAudioPolicy() {
  if (CombatSystem.prototype.__viceBloodStreetImpactAudioPolicy) return;
  CombatSystem.prototype.__viceBloodStreetImpactAudioPolicy = true;
  const originalUpdateProjectiles = CombatSystem.prototype.updateProjectiles;

  CombatSystem.prototype.updateProjectiles = function viceBloodUpdateProjectiles(dt) {
    const candidates = (this.projectiles || []).filter(projectile => projectile?.alive);
    const result = originalUpdateProjectiles.call(this, dt);
    for (const projectile of candidates) {
      if (!projectileExpiredAgainstStreet(this.scene, projectile)) continue;
      RawAudio.play("bulletHitWorld", { cooldown: 0.035, gain: 0.72 });
      this.impactEffects?.push?.({
        x: projectile.x,
        y: projectile.y,
        kind: "street",
        ttl: 0.12,
        duration: 0.12
      });
      this.scene.events?.emit?.("combat:street-hit", {
        attackId: projectile.attackId,
        projectileId: projectile.id,
        weaponId: projectile.config?.id || null,
        x: projectile.x,
        y: projectile.y
      });
    }
    return result;
  };
}
