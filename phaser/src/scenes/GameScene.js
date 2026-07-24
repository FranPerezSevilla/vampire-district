import { COLORS, WORLD } from "../data/balance.js";
import {
  buildings,
  crosswalks,
  districtZoneAt,
  LAYERS,
  roads,
  sewerAccesses,
  sewerTunnels,
  sidewalks
} from "../data/district.js";
import { GameScene as GameSceneCore } from "./GameSceneCore.js";

const URBAN_RENDER_HALF_WIDTH = 680;
const URBAN_RENDER_HALF_HEIGHT = 480;
const URBAN_RENDER_SECTOR_WIDTH = 360;
const URBAN_RENDER_SECTOR_HEIGHT = 260;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function intersects(a, b, margin = 0) {
  return a.x < b.x + b.w + margin
    && a.x + a.w > b.x - margin
    && a.y < b.y + b.h + margin
    && a.y + a.h > b.y - margin;
}

function clippedRect(area, bounds) {
  const x = Math.max(area.x, bounds.x);
  const y = Math.max(area.y, bounds.y);
  const right = Math.min(area.x + area.w, bounds.x + bounds.w);
  const bottom = Math.min(area.y + area.h, bounds.y + bounds.h);
  return right > x && bottom > y
    ? { x, y, w: right - x, h: bottom - y }
    : null;
}

export class GameScene extends GameSceneCore {
  constructor() {
    super();
    this.urbanRenderBounds = null;
    this.urbanRenderSectorKey = "";
  }

  collectInteractions() {
    if (this.vehicleSystem?.isDriving?.()) return this.vehicleSystem.collectInteractions();
    const options = super.collectInteractions();
    if (!this.feedingSystem?.isActive?.()) {
      options.push(...(this.vehicleSystem?.collectInteractions?.() || []));
      options.push(...(this.trafficMaterializationSystem?.collectInteractions?.() || []));
    }
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
    this.cityStreamSystem?.updateFocus?.(position.x, position.y, { force: true });
    super.switchLayer(layer, position, status);
    this.vehicleSystem?.refreshVisibility?.();
    this.streetFurnitureSystem?.refreshVisibility?.();
  }

  renderFocus() {
    return this.vehicleSystem?.currentVehicle?.() || this.player || { x: 0, y: 0 };
  }

  renderSectorKey() {
    const focus = this.renderFocus();
    return `${this.currentLayer}:${Math.floor(focus.x / URBAN_RENDER_SECTOR_WIDTH)}:${Math.floor(focus.y / URBAN_RENDER_SECTOR_HEIGHT)}`;
  }

  calculateUrbanRenderBounds() {
    const focus = this.renderFocus();
    const width = Math.min(WORLD.width, URBAN_RENDER_HALF_WIDTH * 2);
    const height = Math.min(WORLD.height, URBAN_RENDER_HALF_HEIGHT * 2);
    const left = clamp(focus.x - URBAN_RENDER_HALF_WIDTH, 0, Math.max(0, WORLD.width - width));
    const top = clamp(focus.y - URBAN_RENDER_HALF_HEIGHT, 0, Math.max(0, WORLD.height - height));
    return { x: left, y: top, w: width, h: height };
  }

  prepareUrbanRenderWindow() {
    this.urbanRenderSectorKey = this.renderSectorKey();
    this.urbanRenderBounds = this.calculateUrbanRenderBounds();
    return this.urbanRenderBounds;
  }

  ensureUrbanRenderWindow() {
    const key = this.renderSectorKey();
    if (key === this.urbanRenderSectorKey) return false;
    this.urbanRenderSectorKey = key;
    this.urbanRenderBounds = this.calculateUrbanRenderBounds();
    if (this.map) this.redrawLayer();
    return true;
  }

  visibleRect(area, margin = 0) {
    return Boolean(area && intersects(area, this.urbanRenderBounds || this.calculateUrbanRenderBounds(), margin));
  }

  visiblePoint(point, radius = 0) {
    return this.visibleRect({ x: point.x, y: point.y, w: 0, h: 0 }, radius);
  }

  chunkItems(category, bounds, fallback, options = {}) {
    if (this.cityStreamSystem) return this.cityStreamSystem.query(category, bounds, options);
    return (fallback || []).filter(item => this.visibleRect(item, options.margin || 0));
  }

  canStandAt(x, y) {
    if (this.currentLayer !== LAYERS.STREET || !this.cityStreamSystem) return super.canStandAt(x, y);
    if (x < 8 || y < 8 || x > WORLD.width - 8 || y > WORLD.height - 8) return false;
    const body = { x: x - 5, y: y - 7, w: 10, h: 14 };
    return !this.cityStreamSystem.query("buildings", body, { margin: 1 })
      .some(building => this.rectsOverlap(body, building));
  }

  currentLight() {
    return null;
  }

  currentShadowAt() {
    return null;
  }

  drawDistrictStreet() {
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (const road of this.chunkItems("roads", bounds, roads, { margin: 12 })) this.drawRoadWindow(road);
    this.drawSidewalkNetwork();
    this.drawCrosswalkNetwork();
    this.drawSewerManholes();
    for (const item of this.chunkItems("buildings", bounds, buildings, { margin: 80 })) this.drawBuilding(item);
    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  }

  drawRoadWindow(road) {
    if (road.geometry === "polygon" && Array.isArray(road.points)) {
      this.map.fillStyle(COLORS.road, 1).fillPoints(road.points, true);
      return;
    }

    const fragment = clippedRect(road, this.urbanRenderBounds);
    if (!fragment) return;
    this.map.fillStyle(COLORS.road, 1).fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
    if (road.pieceKind !== "segment") return;

    this.map.fillStyle(COLORS.roadTrim, 0.85);
    if (road.orientation === "horizontal" || road.w > road.h) {
      this.map.fillRect(fragment.x, road.y, fragment.w, 2);
      this.map.fillRect(fragment.x, road.y + road.h - 2, fragment.w, 2);
    } else {
      this.map.fillRect(road.x, fragment.y, 2, fragment.h);
      this.map.fillRect(road.x + road.w - 2, fragment.y, 2, fragment.h);
    }

    this.map.fillStyle(COLORS.roadStripe, 1);
    if (road.orientation === "horizontal" || road.w > road.h) {
      const y = road.y + Math.floor(road.h / 2);
      const start = Math.floor(fragment.x / 32) * 32;
      for (let x = start; x < fragment.x + fragment.w; x += 32) {
        const stripeX = Math.max(x, fragment.x);
        const width = Math.min(16, fragment.x + fragment.w - stripeX);
        if (width > 0) this.map.fillRect(stripeX, y, width, 2);
      }
    } else {
      const x = road.x + Math.floor(road.w / 2);
      const start = Math.floor(fragment.y / 32) * 32;
      for (let y = start; y < fragment.y + fragment.h; y += 32) {
        const stripeY = Math.max(y, fragment.y);
        const height = Math.min(16, fragment.y + fragment.h - stripeY);
        if (height > 0) this.map.fillRect(x, stripeY, 2, height);
      }
    }
  }

  drawSidewalkNetwork() {
    const visible = this.chunkItems("sidewalks", this.urbanRenderBounds, sidewalks, { margin: 6 });
    this.map.fillStyle(COLORS.sidewalk, 1);
    for (const walk of visible) {
      if (walk.geometry === "polygon" && Array.isArray(walk.points)) {
        this.map.fillPoints(walk.points, true);
        continue;
      }
      const fragment = clippedRect(walk, this.urbanRenderBounds);
      if (fragment) this.map.fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
    }

    this.map.lineStyle(1, COLORS.sidewalkTrim, 0.72);
    for (const walk of visible) {
      for (const segment of walk.trimSegments || []) {
        if (!Array.isArray(segment) || segment.length !== 2) continue;
        this.map.lineBetween(segment[0].x, segment[0].y, segment[1].x, segment[1].y);
      }
      for (const edge of walk.trimEdges || []) {
        if (edge === "north") this.map.lineBetween(walk.x, walk.y, walk.x + walk.w, walk.y);
        else if (edge === "south") this.map.lineBetween(walk.x, walk.y + walk.h, walk.x + walk.w, walk.y + walk.h);
        else if (edge === "west") this.map.lineBetween(walk.x, walk.y, walk.x, walk.y + walk.h);
        else if (edge === "east") this.map.lineBetween(walk.x + walk.w, walk.y, walk.x + walk.w, walk.y + walk.h);
      }
    }
  }

  drawCrosswalkNetwork() {
    this.map.fillStyle(COLORS.crosswalk, 0.68);
    for (const crossing of this.chunkItems("crosswalks", this.urbanRenderBounds, crosswalks, { margin: 6 })) {
      const stripe = 5;
      const gap = 5;
      if (crossing.orientation === "horizontal") {
        for (let x = crossing.x + 3; x < crossing.x + crossing.w - 2; x += stripe + gap) {
          this.map.fillRect(x, crossing.y, Math.min(stripe, crossing.x + crossing.w - x), crossing.h);
        }
      } else {
        for (let y = crossing.y + 3; y < crossing.y + crossing.h - 2; y += stripe + gap) {
          this.map.fillRect(crossing.x, y, crossing.w, Math.min(stripe, crossing.y + crossing.h - y));
        }
      }
    }
  }

  drawSewerManholes() {
    for (const access of this.chunkItems("sewerAccesses", this.urbanRenderBounds, sewerAccesses, { margin: 16 })) {
      if (!access.street || !this.visiblePoint(access.street, 16)) continue;
      this.map.fillStyle(0x0b2a22, 1).fillCircle(access.street.x, access.street.y, 8);
      this.map.lineStyle(1, 0x78c7a3, 0.65).strokeCircle(access.street.x, access.street.y, 8);
    }
  }

  drawBuilding(building) {
    const originalQuarter = building.x < 960 && building.y < 640;
    if (originalQuarter) {
      super.drawBuilding(building);
      return;
    }

    this.map.fillStyle(building.color, 1).fillRect(building.x, building.y, building.w, building.h);
    this.map.lineStyle(2, building.trim, 0.92).strokeRect(building.x, building.y, building.w, building.h);
    this.map.fillStyle(0xffffff, 0.07);
    const columns = Math.max(2, Math.min(6, Math.floor(building.w / 42)));
    for (let index = 0; index < columns; index++) {
      const x = building.x + 16 + index * Math.max(24, (building.w - 32) / columns);
      this.map.fillRect(x, building.y + 18, 9, 5);
    }

    const focus = this.renderFocus();
    if (this.currentLayer === LAYERS.STREET
      && Phaser.Math.Distance.Between(focus.x, focus.y, building.x + building.w / 2, building.y + building.h / 2) < 520) {
      this.addMapLabel(building.sign, building.x + 9, building.y + 15, 0xefe6ff);
    }
  }

  drawSewers() {
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();
    this.map.fillStyle(COLORS.sewerBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (const tunnel of this.chunkItems("sewerTunnels", bounds, sewerTunnels, { margin: 20 })) {
      const fragment = clippedRect(tunnel, bounds);
      if (!fragment) continue;
      this.map.fillStyle(COLORS.sewerTunnel, 1).fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
      this.map.lineStyle(3, COLORS.sewerTrim, 1).strokeRect(fragment.x, fragment.y, fragment.w, fragment.h);
    }
    const focus = this.renderFocus();
    this.addMapLabel("SEWERS · connected district network", focus.x + 24, focus.y - 42, 0x78c7a3);
  }

  describeCurrentZone() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `driving ${vehicle.name} through ${districtZoneAt(vehicle.x, vehicle.y).name}`;
    if (this.currentLayer !== LAYERS.STREET) return super.describeCurrentZone();
    return `${districtZoneAt(this.player.x, this.player.y).name} · open street`;
  }

  visibilityText() {
    const vehicle = this.vehicleSystem?.currentVehicle?.();
    if (vehicle) return `Exposed · inside ${vehicle.name}`;
    if (this.currentLayer === LAYERS.STREET) return "Visible · open street";
    return super.visibilityText();
  }

  redrawLayer(statusText = "") {
    this.prepareUrbanRenderWindow();
    super.redrawLayer(statusText);
    this.vehicleSystem?.refreshVisibility?.();
    this.streetFurnitureSystem?.refreshVisibility?.();
  }

  publishState() {
    this.ensureUrbanRenderWindow();
    super.publishState();
    this.vehicleSystem?.publish?.();
    this.streetFurnitureSystem?.publish?.();
    this.pedestrianSystem?.publish?.();
  }

  canVehicleOperate() { return this.currentLayer === LAYERS.STREET && Boolean(this.vehicleSystem); }
}
