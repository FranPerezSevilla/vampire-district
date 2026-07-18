import { CombatSystem } from "../combat/CombatSystem.js";
import { UNARMED_ATTACK } from "../data/combat.js";
import { GameScene } from "../scenes/GameScene.js";
import { PropDamageSystem } from "../systems/PropDamageSystem.js";

function installPropAttackBridge() {
  if (CombatSystem.prototype.__nbdDamageablePropsPatch) return;

  const originalResolveAttackHits = CombatSystem.prototype.resolveAttackHits;
  CombatSystem.prototype.resolveAttackHits = function resolveNpcAndPropHits(...args) {
    const result = originalResolveAttackHits.apply(this, args);
    if (this.attack) {
      const origin = { x: this.scene.player.x, y: this.scene.player.y };
      this.scene.propDamageSystem?.resolveAttack?.(this.attack, origin, UNARMED_ATTACK);
    }
    return result;
  };

  CombatSystem.prototype.__nbdDamageablePropsPatch = true;
}

function installPropRuntime() {
  if (GameScene.prototype.__nbdDamageablePropsPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalCollectInteractions = GameScene.prototype.collectInteractions;
  const originalPublishState = GameScene.prototype.publishState;

  GameScene.prototype.create = function createWithDamageableProps(...args) {
    const result = originalCreate.apply(this, args);
    this.propDamageSystem = new PropDamageSystem(this);
    return result;
  };

  GameScene.prototype.collectInteractions = function collectWithoutLightBreakInteraction(...args) {
    return originalCollectInteractions.apply(this, args)
      .filter(option => option?.type !== "breakLight");
  };

  GameScene.prototype.publishState = function publishStateWithProps(...args) {
    const result = originalPublishState.apply(this, args);
    this.registry.set("propText", this.propDamageSystem?.summary?.() || "Props unavailable");
    return result;
  };

  GameScene.prototype.__nbdDamageablePropsPatch = true;
}

installPropAttackBridge();
installPropRuntime();
