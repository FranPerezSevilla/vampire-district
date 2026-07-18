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
import { movementSpeed } from "../data/movement.js";
import { GameplayRuntime } from "../runtime/GameplayRuntime.js";
import { RegistryPublisher } from "../runtime/RegistryPublisher.js";
import { EvidenceSystem } from "../systems/EvidenceSystem.js";
import { ExposureSystem } from "../systems/ExposureSystem.js";
import { FeedingSystem } from "../systems/FeedingSystem.js";
import { HunterSystem } from "../systems/HunterSystem.js";
import { InteractionSystem } from "../systems/InteractionSystem.js";
import { MissionSystem } from "../systems/MissionSystem.js";
import { NpcSystem } from "../systems/NpcSystem.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";
import { PowersSystem } from "../systems/PowersSystem.js";
import { TransitionSystem } from "../systems/TransitionSystem.js";
import { WitnessSystem } from "../systems/WitnessSystem.js";

const ROOF_DROPS = Object.freeze([
  {
    id: "drop_market_north_alley",
    label: "drop to north alley",
    roof: { x: 286, y: 208, layer: LAYERS.ROOF_LOW },
    street: { x: 268, y: 244 }
  },
  {
    id: "drop_warehouse_alley",
    label: "drop to warehouse alley",
    roof: { x: 180, y: 416, layer: LAYERS.ROOF_LOW },
    street: { x: 176, y: 392 }
  },
  {
    id: "drop_club_rear",
    label: "drop to club rear shadow",
    roof: { x: 736, y: 478, layer: LAYERS.ROOF_LOW },
    street: { x: 750, y: 502 }
  },
  {
    id: "drop_old_block_service",
    label: "drop to south service alley",
    roof: { x: 538, y: 540, layer: LAYERS.ROOF_LOW },
    street: { x: 520, y: 540 }
  }
]);

const HIDDEN_MAP_LABELS = new Set([
  "LAMP",
  "JUMP",
  "JUMP ARC",
  "LAND",
  "DOWN",
  "DROP",
  "FIRE",
  "SEWER"
]);

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.currentLayer = LAYERS.ROOF_HIGH;
    this.playerSpeed = PLAYER.baseSpeed;
    this.nearestInteraction = null;
    this.nearestMovement = null;
    this.lastActionText = "Initial rooftop refuge.";
    this.brokenLights = new Set();
    this.taskRevealCinematic = { active: false, queued: null, initialPlayed: false };
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.statePublisher = new RegistryPublisher(this.registry);

    this.mapLabels = [];
    this.map = this.add.graphics();
    this.routeGraphics = this.add.graphics();
    this.promptGraphics = this.add.graphics().setDepth(40);

    this.player = this.add.container(PLAYER.startX, PLAYER.startY);
    this.playerBody = this.add.rectangle(0, 2, 10, 14, COLORS.playerBody).setStrokeStyle(1, COLORS.player);
    this.playerHead = this.add.rectangle(0, -7, 7, 7, COLORS.player).setStrokeStyle(1, 0x120f19);
    this.player.add([this.playerBody, this.playerHead]);
    this.player.setDepth(50);

    this.interactionSystem = new InteractionSystem(this);
    this.missionSystem = new MissionSystem(this);
    this.npcSystem = new NpcSystem(this);
    this.feedingSystem = new FeedingSystem(this);
    this.exposureSystem = new ExposureSystem(this);
    this.witnessSystem = new WitnessSystem(this);
    this.evidenceSystem = new EvidenceSystem(this);
    this.policeSystem = new PoliceSystem(this);
    this.hunterSystem = new HunterSystem(this);
    this.powersSystem = new PowersSystem(this);
    this.transitionSystem = new TransitionSystem(this);
    this.gameplayRuntime = new GameplayRuntime(this);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.redrawLayer(this.lastActionText);
    this.publishState();
  }

  update(time, deltaMs) {
    this.gameplayRuntime?.update(time, deltaMs);
  }

  handleLayerDebugInput(frame = this.currentInputFrame) {
    const layer = Number(frame?.debugLayerPressed || 0);
    if (layer === 1) this.switchLayer(LAYERS.STREET, { x: 488, y: 326 }, "Debug: street layer.");
    if (layer === 2) this.switchLayer(LAYERS.ROOF_LOW, { x: 345, y: 168 }, "Debug: low rooftops.");
    if (layer === 3) this.switchLayer(LAYERS.ROOF_HIGH, { x: 150, y: 146 }, "Debug: high refuge rooftop.");
    if (layer === 4) this.switchLayer(LAYERS.SEWER, { x: 472, y: 326 }, "Debug: sewer layer.");
  }

  switchLayer(layer, position, status) {
    this.currentLayer = layer;
    this.player.setPosition(position.x, position.y);
    this.player.setScale(1);
    this.lastActionText = status || "Layer changed.";
    this.inputSystem?.resetWorldEdges?.();
    this.redrawLayer(this.lastActionText);
    this.npcSystem?.refreshVisibility();
  }

  playerHasMovementIntent(frame = this.currentInputFrame) {
    return Boolean(frame?.hasMovementIntent);
  }

  updatePlayerMovement(dt, frame = this.currentInputFrame) {
    if (!frame?.hasMovementIntent) return;
    const speed = movementSpeed(this.playerSpeed, frame.quietHeld);
    const nextX = this.player.x + frame.move.x * speed * dt;
    const nextY = this.player.y + frame.move.y * speed * dt;

    if (this.canStandAt(nextX, this.player.y)) this.player.x = nextX;
    if (this.canStandAt(this.player.x, nextY)) this.player.y = nextY;
  }

  canStandAt(x, y) {
    if (x < 8 || y < 8 || x > WORLD.width - 8 || y > WORLD.height - 8) return false;

    if (this.currentLayer === LAYERS.SEWER) {
      return sewerTunnels.some(tunnel => this.pointInRect(x, y, tunnel));
    }

    if (this.currentLayer === LAYERS.ROOF_LOW || this.currentLayer === LAYERS.ROOF_HIGH) {
      return (roofAreas[this.currentLayer] || []).some(roof => this.pointInRect(x, y, roof));
    }

    return !buildings.some(building => this.rectsOverlap({ x: x - 5, y: y - 7, w: 10, h: 14 }, building));
  }

  findNearestInteraction(options = this.collectInteractions()) {
    return this.interactionSystem.sortOptions(options)[0] || null;
  }

  collectInteractions() {
    const options = [];
    const radius = 26;

    options.push(...this.witnessSystem.collectInteractions());
    options.push(...this.missionSystem.collectInteractions());
    options.push(...this.feedingSystem.collectInteractions());
    if (this.feedingSystem.isActive()) return options;
    options.push(...this.evidenceSystem.collectInteractions());

    for (const escape of fireEscapes) {
      if (this.currentLayer === LAYERS.STREET) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, escape.street.x, escape.street.y);
        if (distance <= radius) {
          options.push({
            id: `${escape.id}_up`,
            type: "fireEscapeUp",
            label: `Climb ${escape.name}`,
            detail: "street → rooftop · animated climb",
            priority: 40,
            distance,
            x: escape.street.x,
            y: escape.street.y,
            run: () => this.transitionSystem.fireEscape({
              from: escape.street,
              to: escape.roof,
              toLayer: escape.roof.layer,
              direction: "up",
              status: `You climb the ${escape.name} to the roof.`
            })
          });
        }
      }

      if (this.currentLayer === escape.roof.layer) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, escape.roof.x, escape.roof.y);
        if (distance <= radius) {
          options.push({
            id: `${escape.id}_down`,
            type: "fireEscapeDown",
            label: `Descend ${escape.name}`,
            detail: "rooftop → street · animated descent",
            priority: 40,
            distance,
            x: escape.roof.x,
            y: escape.roof.y,
            run: () => this.transitionSystem.fireEscape({
              from: escape.roof,
              to: escape.street,
              toLayer: LAYERS.STREET,
              direction: "down",
              status: `You climb down the ${escape.name} to street level.`
            })
          });
        }
      }
    }

    for (const access of sewerAccesses) {
      if (this.currentLayer === LAYERS.STREET && access.street) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, access.street.x, access.street.y);
        if (distance <= radius) {
          options.push({
            id: `${access.id}_down`,
            type: "sewerDown",
            label: `Enter ${access.name}`,
            detail: "street → sewers",
            priority: 35,
            distance,
            x: access.street.x,
            y: access.street.y,
            run: () => this.switchLayer(LAYERS.SEWER, { x: access.sewer.x, y: access.sewer.y }, `You descend through the ${access.name}.`)
          });
        }
      }

      if (this.currentLayer === LAYERS.SEWER) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, access.sewer.x, access.sewer.y);
        if (distance <= radius) {
          const targetLayer = access.roof ? access.roof.layer : LAYERS.STREET;
          const target = access.roof ? access.roof : access.street;
          if (target) {
            options.push({
              id: `${access.id}_up`,
              type: access.roof ? "privateShaft" : "sewerUp",
              label: access.roof ? "Climb private shaft to refuge" : `Exit ${access.name}`,
              detail: access.roof ? "sewers → rooftop refuge" : "sewers → street",
              priority: access.roof ? 55 : 35,
              distance,
              x: access.sewer.x,
              y: access.sewer.y,
              run: () => this.switchLayer(
                targetLayer,
                { x: target.x, y: target.y },
                access.roof ? "You climb the private shaft onto your rooftop refuge." : `You climb out through the ${access.name}.`
              )
            });
          }
        }
      }
    }

    for (const route of rooftopRoutes) {
      if (this.currentLayer === route.aLayer) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, route.ax, route.ay);
        if (distance <= radius) {
          options.push({
            id: `${route.id}_a_to_b`,
            type: "roofJump",
            label: route.aToB,
            detail: "animated rooftop jump",
            priority: 45,
            distance,
            x: route.ax,
            y: route.ay,
            run: () => this.transitionSystem.roofJump({
              from: { x: route.ax, y: route.ay },
              to: { x: route.bx, y: route.by },
              toLayer: route.bLayer,
              status: `You leap across: ${route.aToB}.`
            })
          });
        }
      }

      if (this.currentLayer === route.bLayer) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, route.bx, route.by);
        if (distance <= radius) {
          options.push({
            id: `${route.id}_b_to_a`,
            type: "roofJump",
            label: route.bToA,
            detail: "animated rooftop jump",
            priority: 45,
            distance,
            x: route.bx,
            y: route.by,
            run: () => this.transitionSystem.roofJump({
              from: { x: route.bx, y: route.by },
              to: { x: route.ax, y: route.ay },
              toLayer: route.aLayer,
              status: `You leap across: ${route.bToA}.`
            })
          });
        }
      }
    }

    if (this.currentLayer === LAYERS.ROOF_LOW) {
      for (const drop of ROOF_DROPS) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.roof.x, drop.roof.y);
        if (distance <= radius) {
          options.push({
            id: drop.id,
            type: "roofDrop",
            label: drop.label,
            detail: "fast roof → street drop · noisy landing",
            priority: 42,
            distance,
            x: drop.roof.x,
            y: drop.roof.y,
            run: () => this.transitionSystem.roofDrop({
              from: drop.roof,
              to: drop.street,
              toLayer: LAYERS.STREET,
              status: `You drop from the roof: ${drop.label}.`
            })
          });
        }
      }
    }

    return options;
  }

  breakLight(light) {
    if (!light || this.brokenLights.has(light.id)) return;
    const prop = this.propDamageSystem?.props?.find(candidate => candidate.id === light.id);
    if (prop) this.propDamageSystem.damage(prop, prop.durability || 1, 0);
  }

  updateCameraForLayer() {
    const camera = this.cameras.main;
    const baseZoom = this.currentLayer === LAYERS.ROOF_HIGH
      ? CAMERA.roofHighZoom
      : this.currentLayer === LAYERS.ROOF_LOW
        ? CAMERA.roofLowZoom
        : this.currentLayer === LAYERS.SEWER
          ? CAMERA.sewerZoom
          : CAMERA.streetZoom;
    const renderScale = typeof window !== "undefined"
      ? window.NBD_RESOLUTION_PRESET?.renderScale || 1
      : 1;
    const targetZoom = baseZoom * renderScale;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.08));
  }

  publishState() {
    const layerName = LAYER_NAMES[this.currentLayer] || "Unknown";
    const zone = this.describeCurrentZone();
    const movementPrompt = this.nearestMovement ? `SPACE: ${this.nearestMovement.label}` : "";
    const interactionPrompt = this.nearestInteraction ? `E: ${this.nearestInteraction.label}` : "";
    this.statePublisher?.setMany?.({
      currentLayer: this.currentLayer,
      statusText: `${layerName} · ${zone}`,
      visibilityText: this.visibilityText(),
      missionText: this.missionSystem.objectiveText(),
      npcText: this.npcSystem?.summary() || "NPCs loading",
      hungerText: this.feedingSystem?.summary() || "Hunger loading",
      powersText: this.powersSystem?.summary() || "Powers loading",
      exposureText: this.exposureSystem?.summary() || "Exposure loading",
      witnessText: this.witnessSystem?.summary() || "Witnesses loading",
      evidenceText: this.evidenceSystem?.summary() || "Evidence loading",
      policeText: this.policeSystem?.summary() || "Police loading",
      hunterText: this.hunterSystem?.summary() || "Hunters dormant",
      propText: this.propDamageSystem?.summary() || "Props loading",
      aiText: this.aiStateSystem?.summary() || "AI loading",
      playerXY: `${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
      interactionPrompt: this.interactionSystem.isOpen ? "" : movementPrompt || interactionPrompt,
      lastActionText: this.lastActionText,
      interactionMenu: this.interactionSystem.snapshot()
    });
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
    return lights.find(light => !this.brokenLights.has(light.id)
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, light.x, light.y) < light.radius) || null;
  }

  currentShadow() {
    return this.currentShadowAt(this.player.x, this.player.y, this.currentLayer);
  }

  currentShadowAt(x, y, layer = this.currentLayer) {
    if (layer !== LAYERS.STREET) return null;
    const brokenLamp = lights.find(light => this.brokenLights.has(light.id)
      && Phaser.Math.Distance.Between(x, y, light.x, light.y) < light.radius * 0.72);
    if (brokenLamp) return { id: `broken-${brokenLamp.id}`, name: "broken light shadow" };
    return shadowZones.find(zone => this.pointInRect(x, y, zone)) || null;
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
    this.drawMissionMarker();
    this.drawHunterRouteBlocks();
    this.npcSystem?.refreshVisibility();
    if (statusText) this.statePublisher?.set?.("lastActionText", statusText);
  }

  drawDistrictStreet() {
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(0, 0, WORLD.width, WORLD.height);
    for (const road of roads) this.drawRoad(road);
    this.drawShadowZones();
    this.drawLights();
    this.drawSewerManholes();
    for (const building of buildings) this.drawBuilding(building);
    if (this.currentLayer > LAYERS.STREET) this.map.fillStyle(0x000000, 0.46).fillRect(0, 0, WORLD.width, WORLD.height);
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
      if (zone.id !== "districtDarkness") this.map.lineStyle(1, 0xd7c8ff, 0.14).strokeRect(zone.x, zone.y, zone.w, zone.h);
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
    if (this.currentLayer === LAYERS.STREET) this.addMapLabel(building.sign, building.x + 9, building.y + 15, 0xefe6ff);
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

    if (this.currentLayer === LAYERS.ROOF_LOW) {
      this.routeGraphics.lineStyle(1, 0xffb02e, 0.40);
      for (const drop of ROOF_DROPS) {
        this.routeGraphics.beginPath();
        this.routeGraphics.moveTo(drop.roof.x, drop.roof.y);
        this.routeGraphics.lineTo(drop.street.x, drop.street.y);
        this.routeGraphics.strokePath();
      }
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

    if (this.currentLayer > LAYERS.STREET) {
      for (const route of rooftopRoutes) {
        if (route.aLayer === this.currentLayer) this.drawRouteMarker(route.ax, route.ay, "JUMP", 0xd7c8ff);
        if (route.bLayer === this.currentLayer) this.drawRouteMarker(route.bx, route.by, "JUMP", 0xd7c8ff);
      }
    }

    if (this.currentLayer === LAYERS.ROOF_LOW) {
      for (const drop of ROOF_DROPS) this.drawRouteMarker(drop.roof.x, drop.roof.y, "DROP", 0xffb02e);
    }
  }

  drawMissionMarker() {
    const marker = this.missionSystem.marker();
    if (!marker || marker.layer !== this.currentLayer) return;
    this.routeGraphics.lineStyle(2, 0xffb02e, 0.90).strokeCircle(marker.x, marker.y, marker.radius || 22);
    this.routeGraphics.fillStyle(0xffb02e, 0.13).fillCircle(marker.x, marker.y, marker.radius || 22);
    this.addMapLabel(marker.label || "OBJ", marker.x + 12, marker.y - 14, 0xffb02e);
  }

  drawHunterRouteBlocks() {
    const blocks = this.hunterSystem?.routeBlocks || [];
    for (const block of blocks) {
      if (block.layer !== this.currentLayer) continue;
      this.routeGraphics.lineStyle(2, 0xff9d35, 0.92).strokeCircle(block.x, block.y, 22);
      this.routeGraphics.fillStyle(0xff9d35, 0.14).fillCircle(block.x, block.y, 22);
      this.addMapLabel("HUNTER BLOCK", block.x + 14, block.y - 18, 0xff9d35);
    }
  }

  drawRouteMarker(x, y, label, color) {
    this.routeGraphics.lineStyle(1, color, 0.70).strokeCircle(x, y, 11);
    this.routeGraphics.fillStyle(color, 0.18).fillCircle(x, y, 11);
    this.addMapLabel(label, x + 10, y - 8, color);
  }

  drawPromptMarker() {
    this.promptGraphics.clear();
    this.traversalPromptLabel?.setVisible(false);

    if (this.nearestMovement) {
      const { x, y } = this.nearestMovement;
      this.promptGraphics.lineStyle(2, 0x78c7a3, 0.95).strokeCircle(x, y, 17);
      this.promptGraphics.fillStyle(0x78c7a3, 0.12).fillCircle(x, y, 17);
      this.traversalPromptLabel?.setText("SPACE").setPosition(x, y - 21).setVisible(true);
    } else if (this.nearestInteraction) {
      const { x, y } = this.nearestInteraction;
      this.promptGraphics.lineStyle(2, 0xfff2a8, 0.95).strokeCircle(x, y, 15);
      this.promptGraphics.fillStyle(0xfff2a8, 0.15).fillCircle(x, y, 15);
    }

    this.npcSystem?.drawMarkers?.(this.promptGraphics);
    this.witnessSystem?.drawMarkers(this.promptGraphics);
    this.evidenceSystem?.drawMarkers(this.promptGraphics);
    this.drawFeedingProgress();
  }

  drawFeedingProgress() {
    const progress = this.feedingSystem?.progress();
    if (!progress) return;
    const x = progress.x;
    const y = progress.y - 26;
    const width = 46;
    const height = 6;
    this.promptGraphics.fillStyle(0x000000, 0.68).fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);
    this.promptGraphics.fillStyle(0x35101b, 1).fillRect(x - width / 2, y, width, height);
    this.promptGraphics.fillStyle(0xff3b50, 1).fillRect(x - width / 2, y, width * progress.pct, height);
    this.promptGraphics.lineStyle(1, 0xffd1da, 0.85).strokeRect(x - width / 2, y, width, height);
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
    const value = HIDDEN_MAP_LABELS.has(String(text || "").trim().toUpperCase()) ? "" : text;
    if (!value) return null;
    const label = this.add.text(x, y, value, {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`
    }).setDepth(20);
    label.setResolution?.(3);
    label.setStroke?.("#05060b", 3);
    this.mapLabels.push(label);
    return label;
  }

  clearMapLabels() {
    for (const label of this.mapLabels) label.destroy();
    this.mapLabels.length = 0;
  }

  pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}
