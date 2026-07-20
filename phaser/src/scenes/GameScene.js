import { LAYERS } from "../data/district.js";
import { GameScene as GameSceneCore } from "./GameSceneCore.js";

export class GameScene extends GameSceneCore {
  collectInteractions() {
    if (this.vehicleSystem?.isDriving?.()) {
      return this.vehicleSystem.collectInteractions();
    }
    const options = super.collectInteractions();
    if (!this.feedingSystem?.isActive?.()) {
      options.push(...(this.vehicleSystem?.collectInteractions?.() || []));
    }
    return options;
  }

  updatePlayerMovement(dt, frame = this.currentInputFrame) {
    if (this.vehicleSystem?.isDriving?.()) {
      this.vehicleSystem.updateDriving(dt, frame);
      return;
    }
    super.updatePlayerMovement(dt, frame);
  }

  updateCameraForLayer() {
    if (this.vehicleSystem?.isDriving?.() && this.vehicleSystem.updateCamera()) return;
    super.updateCameraForLayer();
  }

  switchLayer(layer, position, status) {
    if (this.vehicleSystem?.isDriving?.()) this.vehicleSystem.exitVehicle({ force: true });
    super.switchLayer(layer, position, status);
    this.vehicleSystem?.refreshVisibility?.();
  }

  describeCurrentZone() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `driving ${vehicle.name}`;
    return super.describeCurrentZone();
  }

  visibilityText() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `Exposed · inside ${vehicle.name}`;
    return super.visibilityText();
  }

  redrawLayer(statusText = "") {
    super.redrawLayer(statusText);
    this.vehicleSystem?.refreshVisibility?.();
  }

  publishState() {
    super.publishState();
    this.vehicleSystem?.publish?.();
  }

  canVehicleOperate() {
    return this.currentLayer === LAYERS.STREET && Boolean(this.vehicleSystem);
  }
}
