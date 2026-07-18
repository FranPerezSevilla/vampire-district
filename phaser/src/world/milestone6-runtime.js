import { GameScene } from "../scenes/GameScene.js";
import { UIScene } from "../scenes/UIScene.js";
import { PropDamageSystem } from "../systems/PropDamageSystem.js";

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

function installPropReportState() {
  if (UIScene.prototype.__nbdDamageablePropsPatch) return;

  const originalReadState = UIScene.prototype.readState;
  const originalStatsText = UIScene.prototype.statsText;

  UIScene.prototype.readState = function readStateWithProps(...args) {
    const data = originalReadState.apply(this, args);
    return {
      ...data,
      propText: this.registry.get("propText") || "Props unavailable"
    };
  };

  UIScene.prototype.statsText = function statsTextWithProps(data) {
    const base = originalStatsText.call(this, data);
    const line = data?.propText || "Props unavailable";
    return base.replace("Position:", `${line}\nPosition:`);
  };

  UIScene.prototype.__nbdDamageablePropsPatch = true;
}

installPropRuntime();
installPropReportState();
