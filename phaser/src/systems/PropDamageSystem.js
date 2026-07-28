/**
 * Compatibility boundary for the retired streetlight-damage system.
 *
 * Streetlights and darkness no longer participate in Viceblood gameplay, but
 * combat still calls resolveAttack() through the generic prop-damage seam.
 * Keeping this no-op authority avoids parallel feature flags and lets callers
 * remain unaware of the retired implementation.
 */
export class PropDamageSystem {
  constructor(scene) {
    this.scene = scene;
    this.props = [];
    scene.propDamageSystem = this;
  }

  resolveAttack() {
    return 0;
  }

  validTarget() {
    return false;
  }

  damage() {
    return Object.freeze({
      applied: false,
      damage: 0,
      durability: 0,
      maxDurability: 0,
      broken: false
    });
  }

  summary() {
    return "Props · streetlights disabled";
  }
}
