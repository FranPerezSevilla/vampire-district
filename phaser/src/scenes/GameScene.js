import { COLORS, WORLD } from "../data/balance.js";
import {
  buildings,
  crosswalks,
  districtZoneAt,
  LAYERS,
  lights,
  roads,
  sewerAccesses,
  sewerTunnels,
  shadowZones,
  sidewalks
} from "../data/district.js";
import { GameScene as GameSceneCore } from "./GameSceneCore.js";

const URBAN_RENDER_HALF_WIDTH = 680;
const URBAN_RENDER_HALF_HEIGHT = 480;
const URBAN_RENDER_SECTOR_WIDTH = 360;
const URBAN_RENDER_SECTOR_HEIGHT = 260;
const LIGHT_GLOW_LIMIT = 12;

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

  renderFocus() {
    return this.vehicleSystem?.currentVehicle?.() || this.player || { x: 0, y: 0 };
  }

  renderSectorKey() {
    const focus = this.renderFocus();
    return `${this.currentLayer}:${Math.floor(focus.x / URBAN_RENDER_SECTOR_WIDTH)}:${Math.floor(focus.y / URBAN_RENDER_SECTOR_HEIGHT)}`;
  }

  calculateUrbanRenderBounds() {
    const focus = this.renderFocus();
    const left = clamp(focus.x - URBAN_RENDER_HALF_WIDTH, 0, WORLD.width);
    const top = clamp(focus.y - URBAN_RENDER_HALF_HEIGHT, 0, WORLD.height);
    const right = clamp(focus.x + URBAN_RENDER_HALF_WIDTH, 0, WORLD.width);
    const bottom = clamp(focus.y + URBAN_RENDER_HALF_HEIGHT, 0, WORLD.height);
    return {
      x: left,
      y: top,
      w: Math.max(1, right - left),
      h: Math.max(1, bottom - top)
    };
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

  drawDistrictStreet() {
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    for (const road of roads) {
      if (this.visibleRect(road, 12)) this.drawRoadWindow(road);
    }
    this.drawSidewalkNetwork();
    this.drawCrosswalkNetwork();
    this.drawShadowZones();
    this.drawLights();
    this.drawSewerManholes();
    for (const item of buildings) {
      if (this.visibleRect(item, 80)) this.drawBuilding(item);
    }
    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  }

  drawRoadWindow(road) {
    const fragment = clippedRect(road, this.urbanRenderBounds);
    if (!fragment) return;
    this.map.fillStyle(COLORS.road, 1).fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
    this.map.lineStyle(2, COLORS.roadTrim, 0.85).strokeRect(fragment.x, fragment.y, fragment.w, fragment.h);
    this.map.fillStyle(COLORS.roadStripe, 1);
    if (road.w > road.h) {
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
    this.map.fillStyle(COLORS.sidewalk, 1);
    this.map.lineStyle(1, COLORS.sidewalkTrim, 0.72);
    for (const walk of sidewalks) {
      if (!this.visibleRect(walk, 4)) continue;
      const fragment = clippedRect(walk, this.urbanRenderBounds);
      if (!fragment) continue;
      this.map.fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
      this.map.strokeRect(fragment.x, fragment.y, fragment.w, fragment.h);
    }
  }

  drawCrosswalkNetwork() {
    this.map.fillStyle(COLORS.crosswalk, 0.68);
    for (const crossing of crosswalks) {
      if (!this.visibleRect(crossing, 6)) continue;
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

  drawShadowZones() {
    for (const zone of shadowZones) {
      if (!this.visibleRect(zone, 32)) continue;
      const fragment = clippedRect(zone, this.urbanRenderBounds);
      if (!fragment) continue;
      const alpha = zone.id === "districtDarkness" ? 0.20 : 0.44 + zone.strength * 0.18;
      this.map.fillStyle(0x0d0a18, alpha).fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
      if (zone.id !== "districtDarkness") {
        this.map.lineStyle(1, 0xd7c8ff, 0.14).strokeRect(fragment.x, fragment.y, fragment.w, fragment.h);
      }
    }

    for (const light of lights) {
      if (!this.brokenLights.has(light.id) || !this.visiblePoint(light, light.radius)) continue;
      const radius = light.radius * 0.72;
      this.map.fillStyle(0x05030a, 0.50).fillCircle(light.x, light.y, radius);
      this.map.lineStyle(1, 0xa75cff, 0.22).strokeCircle(light.x, light.y, radius);
    }
  }

  drawLights() {
    const focus = this.renderFocus();
    const visible = lights.filter(light => this.visiblePoint(light, light.radius + 20));
    const glowIds = new Set(
      visible
        .filter(light => !this.brokenLights.has(light.id))
        .sort((a, b) => (
          Phaser.Math.Distance.Between(focus.x, focus.y, a.x, a.y)
          - Phaser.Math.Distance.Between(focus.x, focus.y, b.x, b.y)
        ))
        .slice(0, LIGHT_GLOW_LIMIT)
        .map(light => light.id)
    );

    for (const light of visible) {
      if (this.brokenLights.has(light.id)) {
        this.map.fillStyle(0x5d2535, 1).fillRect(light.x - 3, light.y - 2, 6, 2);
        this.map.fillStyle(0x302734, 1).fillRect(light.x - 2, light.y - 14, 4, 16);
        this.map.fillStyle(0xff3b50, 1).fillRect(light.x - 5, light.y - 18, 10, 2);
        continue;
      }
      if (glowIds.has(light.id)) {
        this.map.fillStyle(0xffdc74, 0.07).fillCircle(light.x, light.y, light.radius * 0.72);
        this.map.lineStyle(1, 0xffdc74, 0.18).strokeCircle(light.x, light.y, light.radius * 0.72);
      }
      this.map.fillStyle(0xffe16b, 1).fillRect(light.x - 2, light.y - 14, 4, 16);
      this.map.fillStyle(0xfff2a8, 1).fillRect(light.x - 5, light.y - 18, 10, 3);
    }
  }

  drawSewerManholes() {
    for (const access of sewerAccesses) {
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
    for (const tunnel of sewerTunnels) {
      if (!this.visibleRect(tunnel, 20)) continue;
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