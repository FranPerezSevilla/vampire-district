import { CAMERA, COLORS, PLAYER, WORLD } from "../data/balance.js";
import {
  buildings,
  fireEscapes,
  LAYER_NAMES,
  LAYERS,
  lights,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  sewerTunnels,
  shadowZones
} from "../data/district.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.currentLayer = LAYERS.ROOF_HIGH;
    this.playerSpeed = PLAYER.baseSpeed;
    this.nearestInteraction = null;
    this.lastActionText = "Initial rooftop refuge.";
    this.brokenLights = new Set();
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    this.mapLabels = [];
    this.map = this.add.graphics();
    this.routeGraphics = this.add.graphics();
    this.promptGraphics = this.add.graphics().setDepth(40);

    this.player = this.add.container(PLAYER.startX, PLAYER.startY);
    this.playerBody = this.add.rectangle(0, 2, 10, 14, COLORS.playerBody).setStrokeStyle(1, COLORS.player);
    this.playerHead = this.add.rectangle(0, -7, 7, 7, COLORS.player).setStrokeStyle(1, 0x120f19);
    this.player.add([this.playerBody, this.playerHead]);
    this.player.setDepth(50);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      street: Phaser.Input.Keyboard.KeyCodes.ONE,
      roofLow: Phaser.Input.Keyboard.KeyCodes.TWO,
      roofHigh: Phaser.Input.Keyboard.KeyCodes.THREE,
      sewer: Phaser.Input.Keyboard.KeyCodes.FOUR
    });

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.redrawLayer(this.lastActionText);
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.handleLayerDebugKeys();

    this.nearestInteraction = this.findNearestInteraction();
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact) && this.nearestInteraction) {
      this.runInteraction(this.nearestInteraction);
      this.nearestInteraction = this.findNearestInteraction();
    }

    this.updatePlayerMovement(dt);
    this.nearestInteraction = this.findNearestInteraction();
    this.updateCameraForLayer();
    this.drawPromptMarker();
    this.publishState();
  }

  handleLayerDebugKeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.street)) this.switchLayer(LAYERS.STREET, { x: 488, y: 326 }, "Debug: street layer.");
    if (Phaser.Input.Keyboard.JustDown(this.keys.roofLow)) this.switchLayer(LAYERS.ROOF_LOW, { x: 345, y: 168 }, "Debug: low rooftops.");
    if (Phaser.Input.Keyboard.JustDown(this.keys.roofHigh)) this.switchLayer(LAYERS.ROOF_HIGH, { x: 150, y: 146 }, "Debug: high refuge rooftop.");
    if (Phaser.Input.Keyboard.JustDown(this.keys.sewer)) this.switchLayer(LAYERS.SEWER, { x: 472, y: 326 }, "Debug: sewer layer.");
  }

  switchLayer(layer, position, status) {
    this.currentLayer = layer;
    this.player.setPosition(position.x, position.y);
    this.lastActionText = status || "Layer changed.";
    this.redrawLayer(this.lastActionText);
  }

  updatePlayerMovement(dt) {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.keys.left.isDown || this.keys.a.isDown) dir.x -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) dir.x += 1;
    if (this.keys.up.isDown || this.keys.w.isDown) dir.y -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown) dir.y += 1;
    if (dir.lengthSq() === 0) return;

    dir.normalize();
    const speed = this.playerSpeed * (this.keys.shift.isDown ? PLAYER.sprintMultiplier : 1);
    const nextX = this.player.x + dir.x * speed * dt;
    const nextY = this.player.y + dir.y * speed * dt;

    if (this.canStandAt(nextX, this.player.y)) this.player.x = nextX;
    if (this.canStandAt(this.player.x, nextY)) this.player.y = nextY;
  }

  canStandAt(x, y) {
    if (x < 8 || y < 8 || x > WORLD.width - 8 || y > WORLD.height - 8) return false;

    if (this.currentLayer === LAYERS.SEWER) {
      return sewerTunnels.some(t => this.pointInRect(x, y, t));
    }

    if (this.currentLayer === LAYERS.ROOF_LOW || this.currentLayer === LAYERS.ROOF_HIGH) {
      return (roofAreas[this.currentLayer] || []).some(r => this.pointInRect(x, y, r));
    }

    return !buildings.some(b => this.rectsOverlap({ x: x - 5, y: y - 7, w: 10, h: 14 }, b));
  }

  findNearestInteraction() {
    const options = this.collectInteractions();
    options.sort((a, b) => a.distance - b.distance);
    return options[0] || null;
  }

  collectInteractions() {
    const options = [];
    const radius = 26;

    if (this.currentLayer === LAYERS.STREET) {
      for (const light of lights) {
        if (this.brokenLights.has(light.id)) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, light.x, light.y);
        if (d <= 32) {
          options.push({
            type: "breakLight",
            label: `E: break ${light.name}`,
            distance: d,
            x: light.x,
            y: light.y,
            light,
            status: `${light.name} broken. The light dies and the street becomes safer for you.`
          });
        }
      }
    }

    for (const escape of fireEscapes) {
      if (this.currentLayer === LAYERS.STREET) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, escape.street.x, escape.street.y);
        if (d <= radius) {
          options.push({
            type: "fireEscapeUp",
            label: `E: climb ${escape.name}`,
            distance: d,
            x: escape.street.x,
            y: escape.street.y,
            targetLayer: escape.roof.layer,
            target: { x: escape.roof.x, y: escape.roof.y },
            status: `You climb the ${escape.name} to the roof.`
          });
        }
      }

      if (this.currentLayer === escape.roof.layer) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, escape.roof.x, escape.roof.y);
        if (d <= radius) {
          options.push({
            type: "fireEscapeDown",
            label: `E: descend ${escape.name}`,
            distance: d,
            x: escape.roof.x,
            y: escape.roof.y,
            targetLayer: LAYERS.STREET,
            target: { x: escape.street.x, y: escape.street.y },
            status: `You climb down the ${escape.name} to street level.`
          });
        }
      }
    }

    for (const access of sewerAccesses) {
      if (this.currentLayer === LAYERS.STREET && access.street) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, access.street.x, access.street.y);
        if (d <= radius) {
          options.push({
            type: "sewerDown",
            label: `E: enter ${access.name}`,
            distance: d,
            x: access.street.x,
            y: access.street.y,
            targetLayer: LAYERS.SEWER,
            target: { x: access.sewer.x, y: access.sewer.y },
            status: `You descend through the ${access.name}.`
          });
        }
      }

      if (this.currentLayer === LAYERS.SEWER) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, access.sewer.x, access.sewer.y);
        if (d <= radius) {
          const targetLayer = access.roof ? access.roof.layer : LAYERS.STREET;
          const target = access.roof ? access.roof : access.street;
          if (target) {
            options.push({
              type: access.roof ? "privateShaft" : "sewerUp",
              label: access.roof ? "E: climb private shaft to refuge" : `E: exit ${access.name}`,
              distance: d,
              x: access.sewer.x,
              y: access.sewer.y,
              targetLayer,
              target: { x: target.x, y: target.y },
              status: access.roof ? "You climb the private shaft onto your rooftop refuge." : `You climb out through the ${access.name}.`
            });
          }
        }
      }
    }

    for (const route of rooftopRoutes) {
      if (this.currentLayer === route.aLayer) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, route.ax, route.ay);
        if (d <= radius) {
          options.push({
            type: "roofJump",
            label: `E: ${route.aToB}`,
            distance: d,
            x: route.ax,
            y: route.ay,
            targetLayer: route.bLayer,
            target: { x: route.bx, y: route.by },
            status: `You leap across: ${route.aToB}.`
          });
        }
      }

      if (this.currentLayer === route.bLayer) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, route.bx, route.by);
        if (d <= radius) {
          options.push({
            type: "roofJump",
            label: `E: ${route.bToA}`,
            distance: d,
            x: route.bx,
            y: route.by,
            targetLayer: route.aLayer,
            target: { x: route.ax, y: route.ay },
            status: `You leap across: ${route.bToA}.`
          });
        }
      }
    }

    return options;
  }

  runInteraction(interaction) {
    if (!interaction) return;
    if (interaction.type === "breakLight") {
      this.breakLight(interaction.light);
      return;
    }
    this.switchLayer(interaction.targetLayer, interaction.target, interaction.status);
  }

  breakLight(light) {
    if (!light || this.brokenLights.has(light.id)) return;
    this.brokenLights.add(light.id);
    this.lastActionText = `${light.name} broken. You create a useful patch of darkness.`;
    this.redrawLayer(this.lastActionText);
  }

  updateCameraForLayer() {
    const camera = this.cameras.main;
    const targetZoom = this.currentLayer === LAYERS.ROOF_HIGH
      ? CAMERA.roofHighZoom
      : this.currentLayer === LAYERS.ROOF_LOW
        ? CAMERA.roofLowZoom
        : this.currentLayer === LAYERS.SEWER
          ? CAMERA.sewerZoom
          : CAMERA.streetZoom;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.08));
  }

  publishState() {
    const layerName = LAYER_NAMES[this.currentLayer] || "Unknown";
    const zone = this.describeCurrentZone();
    this.registry.set("currentLayer", this.currentLayer);
    this.registry.set("statusText", `${layerName} · ${zone}`);
    this.registry.set("visibilityText", this.visibilityText());
    this.registry.set("playerXY", `${Math.round(this.player.x)}, ${Math.round(this.player.y)}`);
    this.registry.set("interactionPrompt", this.nearestInteraction ? this.nearestInteraction.label : "");
    this.registry.set("lastActionText", this.lastActionText);
  }

  describeCurrentZone() {
    if (this.currentLayer === LAYERS.SEWER) return "hidden in connected sewer network";
    if (this.currentLayer === LAYERS.ROOF_HIGH) return "safe rooftop refuge";
    if (this.currentLayer === LAYERS.ROOF_LOW) return "roof route network";
    const light = this.currentLight();
    if (light) return `under ${light.name}`;
    const shadow = this.currentShadow();
    return shadow ? `in ${shadow.name}` : "dark street";
  }

  visibilityText() {
    if (this.currentLayer === LAYERS.SEWER) return "Hidden · sewers";
    if (this.currentLayer > LAYERS.STREET) return "Hidden · rooftop";
    const light = this.currentLight();
    if (light) return `Exposed · ${light.name}`;
    const shadow = this.currentShadow();
    return shadow ? `Hidden · ${shadow.name}` : "Hidden · street darkness";
  }

  currentLight() {
    if (this.currentLayer !== LAYERS.STREET) return null;
    return lights.find(l => !this.brokenLights.has(l.id) && Phaser.Math.Distance.Between(this.player.x, this.player.y, l.x, l.y) < l.radius) || null;
  }

  currentShadow() {
    if (this.currentLayer !== LAYERS.STREET) return null;
    const brokenLamp = lights.find(l => this.brokenLights.has(l.id) && Phaser.Math.Distance.Between(this.player.x, this.player.y, l.x, l.y) < l.radius * 0.72);
    if (brokenLamp) return { id: `broken-${brokenLamp.id}`, name: `broken light shadow` };
    return shadowZones.find(z => this.pointInRect(this.player.x, this.player.y, z)) || null;
  }

  redrawLayer(statusText = "") {
    this.map.clear();
    this.routeGraphics.clear();
    this.promptGraphics.clear();
    this.clearMapLabels();

    if (this.currentLayer === LAYERS.SEWER) this.drawSewers();
    else this.drawDistrictStreet();

    if (this.currentLayer > LAYERS.STREET) {
      this.drawRoofLayer();
      this.drawRooftopRouteNetwork();
    }

    this.drawRouteMarkers();
    if (statusText) this.registry.set("lastActionText", statusText);
  }

  drawDistrictStreet() {
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(0, 0, WORLD.width, WORLD.height);

    for (const road of roads) this.drawRoad(road);
    this.drawShadowZones();
    this.drawLights();
    this.drawSewerManholes();
    for (const building of buildings) this.drawBuilding(building);

    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  drawRoad(road) {
    this.map.fillStyle(COLORS.road, 1).fillRect(road.x, road.y, road.w, road.h);
    this.map.fillStyle(COLORS.roadTrim, 1).fillRect(road.x, road.y, road.w, 3);
    this.map.fillStyle(COLORS.roadTrim, 1).fillRect(road.x, road.y + road.h - 3, road.w, 3);
    this.map.fillStyle(COLORS.roadStripe, 1);
    if (road.w > road.h) {
      for (let x = road.x; x < road.x + road.w; x += 32) this.map.fillRect(x, road.y + Math.floor(road.h / 2), 16, 2);
    } else {
      for (let y = road.y; y < road.y + road.h; y += 32) this.map.fillRect(road.x + Math.floor(road.w / 2), y, 2, 16);
    }
  }

  drawShadowZones() {
    for (const zone of shadowZones) {
      const alpha = zone.id === "districtDarkness" ? 0.20 : 0.44 + zone.strength * 0.18;
      this.map.fillStyle(0x0d0a18, alpha).fillRect(zone.x, zone.y, zone.w, zone.h);
      if (zone.id !== "districtDarkness") {
        this.map.lineStyle(1, 0xd7c8ff, 0.14).strokeRect(zone.x, zone.y, zone.w, zone.h);
      }
    }

    for (const light of lights) {
      if (!this.brokenLights.has(light.id)) continue;
      const radius = light.radius * 0.72;
      this.map.fillStyle(0x05030a, 0.50).fillCircle(light.x, light.y, radius);
      this.map.lineStyle(1, 0xa75cff, 0.22).strokeCircle(light.x, light.y, radius);
    }
  }

  drawLights() {
    for (const light of lights) {
      if (this.brokenLights.has(light.id)) {
        this.map.fillStyle(0x5d2535, 1).fillRect(light.x - 3, light.y - 2, 6, 2);
        this.map.fillStyle(0x302734, 1).fillRect(light.x - 2, light.y - 14, 4, 16);
        this.map.fillStyle(0xff3b50, 1).fillRect(light.x - 5, light.y - 18, 10, 2);
        continue;
      }
      this.map.fillStyle(0xffdc74, 0.09).fillCircle(light.x, light.y, light.radius);
      this.map.lineStyle(1, 0xffdc74, 0.23).strokeCircle(light.x, light.y, light.radius);
      this.map.fillStyle(0xffe16b, 1).fillRect(light.x - 2, light.y - 14, 4, 16);
      this.map.fillStyle(0xfff2a8, 1).fillRect(light.x - 5, light.y - 18, 10, 3);
    }
  }

  drawSewerManholes() {
    for (const access of sewerAccesses) {
      if (!access.street) continue;
      this.map.fillStyle(0x0b2a22, 1).fillCircle(access.street.x, access.street.y, 8);
      this.map.lineStyle(1, 0x78c7a3, 0.65).strokeCircle(access.street.x, access.street.y, 8);
    }
  }

  drawBuilding(building) {
    this.map.fillStyle(building.color, 1).fillRect(building.x, building.y, building.w, building.h);
    this.map.lineStyle(3, building.trim, 1).strokeRect(building.x, building.y, building.w, building.h);
    this.map.fillStyle(0xffffff, 0.08);
    for (let x = building.x + 14; x < building.x + building.w - 14; x += 26) {
      for (let y = building.y + 18; y < building.y + building.h - 14; y += 24) this.map.fillRect(x, y, 8, 5);
    }
    this.addMapLabel(building.sign, building.x + 9, building.y + 15, 0xefe6ff);
  }

  drawRoofLayer() {
    for (const layer of [LAYERS.ROOF_LOW, LAYERS.ROOF_HIGH]) {
      for (const roof of roofAreas[layer]) this.drawRoof(roof, layer !== this.currentLayer);
    }
  }

  drawRoof(roof, dimmed) {
    this.map.fillStyle(dimmed ? COLORS.roofDim : roof.color, dimmed ? 0.35 : 1).fillRect(roof.x, roof.y, roof.w, roof.h);
    this.map.lineStyle(3, dimmed ? 0xdcdcff : 0xc7c5df, dimmed ? 0.25 : 1).strokeRect(roof.x, roof.y, roof.w, roof.h);
    this.map.fillStyle(dimmed ? 0x000000 : 0x1f2030, dimmed ? 0.25 : 1).fillRect(roof.x + 16, roof.y + 16, 24, 18);
    this.map.fillStyle(dimmed ? 0x000000 : 0x1f2030, dimmed ? 0.25 : 1).fillRect(roof.x + roof.w - 44, roof.y + 22, 18, 26);
    this.addMapLabel(dimmed ? "other height" : roof.label, roof.x + 8, roof.y + 12, dimmed ? 0x9d93b8 : 0xf1e6ff);
  }

  drawRooftopRouteNetwork() {
    this.routeGraphics.lineStyle(2, COLORS.accent, 0.45);
    for (const route of rooftopRoutes) {
      if (route.aLayer !== this.currentLayer && route.bLayer !== this.currentLayer) continue;
      this.routeGraphics.beginPath();
      this.routeGraphics.moveTo(route.ax, route.ay);
      this.routeGraphics.lineTo(route.bx, route.by);
      this.routeGraphics.strokePath();
      this.routeGraphics.fillStyle(COLORS.accent, 0.75).fillCircle(route.ax, route.ay, 4).fillCircle(route.bx, route.by, 4);
    }
  }

  drawRouteMarkers() {
    this.routeGraphics.lineStyle(1, 0x78c7a3, 0.55);
    this.routeGraphics.fillStyle(0x78c7a3, 0.90);

    for (const escape of fireEscapes) {
      if (this.currentLayer === LAYERS.STREET) this.drawRouteMarker(escape.street.x, escape.street.y, "FIRE", 0x78c7a3);
      if (this.currentLayer === escape.roof.layer) this.drawRouteMarker(escape.roof.x, escape.roof.y, "DOWN", 0x78c7a3);
    }

    for (const access of sewerAccesses) {
      if (this.currentLayer === LAYERS.STREET && access.street) this.drawRouteMarker(access.street.x, access.street.y, "SEWER", 0x78c7a3);
      if (this.currentLayer === LAYERS.SEWER) this.drawRouteMarker(access.sewer.x, access.sewer.y, access.roof ? "SHAFT" : "EXIT", 0x78c7a3);
    }

    if (this.currentLayer === LAYERS.STREET) {
      for (const light of lights) {
        if (!this.brokenLights.has(light.id)) this.drawRouteMarker(light.x, light.y, "LAMP", 0xffe16b);
      }
    }

    if (this.currentLayer > LAYERS.STREET) {
      for (const route of rooftopRoutes) {
        if (route.aLayer === this.currentLayer) this.drawRouteMarker(route.ax, route.ay, "JUMP", 0xd7c8ff);
        if (route.bLayer === this.currentLayer) this.drawRouteMarker(route.bx, route.by, "JUMP", 0xd7c8ff);
      }
    }
  }

  drawRouteMarker(x, y, label, color) {
    this.routeGraphics.lineStyle(1, color, 0.70).strokeCircle(x, y, 11);
    this.routeGraphics.fillStyle(color, 0.18).fillCircle(x, y, 11);
    this.addMapLabel(label, x + 10, y - 8, color);
  }

  drawPromptMarker() {
    this.promptGraphics.clear();
    if (!this.nearestInteraction) return;
    const { x, y } = this.nearestInteraction;
    this.promptGraphics.lineStyle(2, 0xfff2a8, 0.95).strokeCircle(x, y, 15);
    this.promptGraphics.fillStyle(0xfff2a8, 0.15).fillCircle(x, y, 15);
  }

  drawSewers() {
    this.map.fillStyle(COLORS.sewerBase, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    for (const tunnel of sewerTunnels) {
      this.map.fillStyle(COLORS.sewerTunnel, 1).fillRect(tunnel.x, tunnel.y, tunnel.w, tunnel.h);
      this.map.lineStyle(3, COLORS.sewerTrim, 1).strokeRect(tunnel.x, tunnel.y, tunnel.w, tunnel.h);
    }
    this.addMapLabel("SEWERS · mirrored escape network", 500, 300, 0x78c7a3);
  }

  addMapLabel(text, x, y, color) {
    const label = this.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: `#${color.toString(16).padStart(6, "0")}`
    }).setDepth(20);
    this.mapLabels.push(label);
  }

  clearMapLabels() {
    for (const label of this.mapLabels) label.destroy();
    this.mapLabels.length = 0;
  }

  pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}
