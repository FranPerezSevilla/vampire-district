import { COLORS, WORLD } from "../data/balance.js";
import { buildings, crosswalks, districtZoneAt, LAYERS, roads, sidewalks } from "../data/district.js";
import { GameScene as GameSceneCore } from "./GameSceneCore.js";

export class GameScene extends GameSceneCore {
  collectInteractions() {
    if (this.vehicleSystem?.isDriving?.()) return this.vehicleSystem.collectInteractions();
    const options = super.collectInteractions();
    if (!this.feedingSystem?.isActive?.()) options.push(...(this.vehicleSystem?.collectInteractions?.() || []));
    return options;
  }

  updatePlayerMovement(dt, frame = this.currentInputFrame) {
    if (this.vehicleSystem?.isDriving?.()) { this.vehicleSystem.updateDriving(dt, frame); return; }
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
    this.streetFurnitureSystem?.refreshVisibility?.();
  }

  drawDistrictStreet() {
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    for (const road of roads) this.drawRoad(road);
    this.drawSidewalkNetwork();
    this.drawCrosswalkNetwork();
    this.drawShadowZones();
    this.drawLights();
    this.drawSewerManholes();
    for (const item of buildings) this.drawBuilding(item);
    if (this.currentLayer > LAYERS.STREET) this.map.fillStyle(0x000000, 0.46).fillRect(0, 0, WORLD.width, WORLD.height);
  }

  drawSidewalkNetwork() {
    this.map.fillStyle(COLORS.sidewalk, 1);
    this.map.lineStyle(1, COLORS.sidewalkTrim, 0.72);
    for (const walk of sidewalks) {
      this.map.fillRect(walk.x, walk.y, walk.w, walk.h);
      this.map.strokeRect(walk.x, walk.y, walk.w, walk.h);
    }
  }

  drawCrosswalkNetwork() {
    this.map.fillStyle(COLORS.crosswalk, 0.68);
    for (const crossing of crosswalks) {
      const stripe = 5;
      const gap = 5;
      if (crossing.orientation === "horizontal") {
        for (let x = crossing.x + 3; x < crossing.x + crossing.w - 2; x += stripe + gap) this.map.fillRect(x, crossing.y, Math.min(stripe, crossing.x + crossing.w - x), crossing.h);
      } else {
        for (let y = crossing.y + 3; y < crossing.y + crossing.h - 2; y += stripe + gap) this.map.fillRect(crossing.x, y, crossing.w, Math.min(stripe, crossing.y + crossing.h - y));
      }
    }
  }

  describeCurrentZone() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `driving ${vehicle.name} through ${districtZoneAt(vehicle.x, vehicle.y).name}`;
    if (this.currentLayer !== LAYERS.STREET) return super.describeCurrentZone();
    const zone = districtZoneAt(this.player.x, this.player.y).name;
    const light = this.currentLight();
    if (light) return `${zone} · under ${light.name}`;
    const shadow = this.currentShadow();
    return shadow ? `${zone} · in ${shadow.name}` : `${zone} · open street`;
  }

  visibilityText() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `Exposed · inside ${vehicle.name}`;
    return super.visibilityText();
  }

  redrawLayer(statusText = "") {
    super.redrawLayer(statusText);
    this.vehicleSystem?.refreshVisibility?.();
    this.streetFurnitureSystem?.refreshVisibility?.();
  }

  publishState() {
    super.publishState();
    this.vehicleSystem?.publish?.();
    this.streetFurnitureSystem?.publish?.();
    this.pedestrianSystem?.publish?.();
  }

  canVehicleOperate() { return this.currentLayer === LAYERS.STREET && Boolean(this.vehicleSystem); }
}