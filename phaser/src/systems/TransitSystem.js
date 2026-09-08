import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { vehicleArchetype } from "../data/vehicles.js";
import { createVehicleState } from "../vehicles/VehicleModel.js";
import { filterVehicleInputFrame } from "../vehicles/VehicleDriving.js";
import { journeyPoint } from "../streaming/TrafficJourneyPlanner.js";
import { buildTransitRoutes } from "../streaming/TransitRoutes.js";

const DWELL_SECONDS = 7;
const CAPACITY = 24;

export class TransitSystem {
  constructor(scene) {
    this.scene = scene;
    this.lines = [];
    this.buses = new Map();
    this.people = [];
    this.signs = [];
    this.riding = null;
    this.exitRequested = false;
    this.boardedCount = 0;
    this.alightedCount = 0;
    this.evacuatedCount = 0;
    this.onHijack = event => this.retire(event.tokenId);
    scene.events?.on?.("traffic:vehicle-hijacked", this.onHijack);
  }

  createDrivers(topology) {
    this.clearFleet();
    this.lines = buildTransitRoutes(topology);
    const drivers = [];
    for (const line of this.lines) {
      for (const stop of line.stops) this.createStop(line, stop);
      for (let index = 0; index < 2; index++) {
        const archetype = vehicleArchetype("bus"), journey = structuredClone(line.journey);
        const stopIndex = Math.floor(index * line.stops.length / 2);
        const progress = line.stops[stopIndex].progress;
        const point = journeyPoint(journey, progress), tokenId = `bus:${line.id}:${index + 1}`;
        const driver = { tokenId, archetype, journey, progress, transitLineId: line.id,
          pose: createVehicleState({ id: tokenId, ...point }, archetype), cruiseSpeed: 82,
          wait: 0, retryAt: 0, maneuver: null, maneuverSeconds: 0, recovery: null, panicUntil: 0,
          reason: "bus-stop", controls: { move: { x: 0, y: 0 } }, distanceTravelled: 0,
          completedJourneys: 0, adoptedImpacts: 0, rejectedSteps: 0, routeHop: 0 };
        this.buses.set(tokenId, { driver, line, nextStop: stopIndex, nextStopLap: 0, skippedStops: 0, dwell: 0, arrived: false, passengers: [], visits: 0 });
        drivers.push(driver);
      }
    }
    return drivers;
  }

  createStop(line, stop) {
    const sign = this.scene.add?.container?.(stop.x, stop.y);
    if (sign) {
      sign.setDepth?.(32);
      sign.add?.([
        this.scene.add.rectangle(0, 0, 6, 20, 0x303b48),
        this.scene.add.rectangle(0, -8, 14, 12, line.color),
        this.scene.add.text(10, -17, `BUS ${line.id}`, { fontSize: "10px", color: "#eee8cd", backgroundColor: "#18202c" })
      ]);
      this.signs.push({ sign, stop });
    }
    for (let index = 0; index < 2; index++) {
      const x = stop.x + Math.cos(stop.point.angle) * (index * 14 - 7);
      const y = stop.y + Math.sin(stop.point.angle) * (index * 14 - 7);
      if (this.scene.canStandAt && !this.scene.canStandAt(x, y)) continue;
      const npc = this.scene.npcSystem?.createNpc?.({ id: `commuter:${stop.id}:${index}`, type: NPC_TYPES.CIVILIAN,
        x, y, layer: LAYERS.STREET, speed: 34, behavior: "loiter" });
      if (!npc) continue;
      npc.transit = { state: "waiting", stopId: stop.id, lineId: line.id, cooldown: 0 };
      this.scene.npcSystem.npcs.push(npc);
      this.people.push(npc);
    }
  }

  door(bus) {
    const p = bus.driver.pose, angle = p.angle;
    return { x: p.x + Math.cos(angle) * 17 - Math.sin(angle) * 16,
      y: p.y + Math.sin(angle) * 17 + Math.cos(angle) * 16 };
  }

  // Called by the one traffic driver before shared kinematics. This service
  // owns the stop schedule, never the vehicle's position or steering.
  speedLimit(driver, dt) {
    const bus = this.buses.get(driver.tokenId);
    if (!bus) return Infinity;
    let stop = bus.line.stops[bus.nextStop];
    const travelled = driver.progress + driver.completedJourneys * driver.journey.circuitLength;
    let room = stop.progress + bus.nextStopLap * driver.journey.circuitLength - travelled;
    // A physical bypass may carry the bus past a blocked stop. Continue with
    // the next stop instead of silently omitting every stop until another lap.
    while (!bus.arrived && (room < -12 || room < 4 && Math.abs(driver.pose.speed) < 2
      && Math.hypot(driver.pose.x - stop.point.x, driver.pose.y - stop.point.y) >= 12)) {
      bus.skippedStops++; this.advanceStop(bus);
      stop = bus.line.stops[bus.nextStop];
      room = stop.progress + bus.nextStopLap * driver.journey.circuitLength - travelled;
    }
    if (!bus.arrived && room < 4 && Math.abs(driver.pose.speed) < 2
      && Math.hypot(driver.pose.x - stop.point.x, driver.pose.y - stop.point.y) < 12) {
      bus.arrived = true; bus.dwell = DWELL_SECONDS; bus.visits++;
      this.arrive(bus, stop);
    }
    if (bus.arrived) {
      bus.dwell -= dt;
      if (bus.dwell <= 0) {
        for (const npc of this.people) if (npc.transit?.state === "boarding" && npc.transit.busId === driver.tokenId) {
          npc.transit.state = "waiting"; npc.transit.busId = null;
        }
        bus.arrived = false;
        this.advanceStop(bus);
      }
      return 0;
    }
    return Math.min(Math.sqrt(2 * driver.archetype.brake * Math.max(0, room - 1)), Math.max(0, room - 1) * 1.5);
  }

  advanceStop(bus) {
    bus.nextStop = (bus.nextStop + 1) % bus.line.stops.length;
    if (bus.nextStop === 0) bus.nextStopLap++;
  }

  canExchange(bus, point) {
    if (this.scene.trafficMaterializationSystem?.assignments?.has(bus.driver.tokenId)) return true;
    const view = this.scene.cameras?.main?.worldView;
    return !view || point.x < view.x - 80 || point.x > view.x + view.width + 80
      || point.y < view.y - 80 || point.y > view.y + view.height + 80;
  }

  arrive(bus, stop) {
    // Dormant service can exchange people off screen. A visible queue must
    // never board an invisible bus or receive passengers out of empty asphalt.
    if (!this.canExchange(bus, stop)) return;
    const door = this.door(bus);
    for (const npc of [...bus.passengers]) {
      if (npc.transit.destination !== stop.id) continue;
      if (this.scene.canStandAt && !this.scene.canStandAt(door.x, door.y)) continue;
      bus.passengers.splice(bus.passengers.indexOf(npc), 1);
      npc.x = door.x; npc.y = door.y; npc.inactive = false; npc.transitBoarded = false;
      npc.transit = { state: "alighting", stopId: stop.id, lineId: bus.line.id, cooldown: 12 };
      npc.container?.setActive?.(true).setPosition?.(npc.x, npc.y).setVisible?.(true);
      this.alightedCount++;
      this.scene.events?.emit?.("transit:alighted", { npcId: npc.id, busId: bus.driver.tokenId, stopId: stop.id });
    }
    for (const npc of this.people) {
      if (bus.passengers.length >= CAPACITY) break;
      if (npc.transit?.state !== "waiting" || npc.transit.stopId !== stop.id || npc.transit.cooldown > 0
        || npc.dead || npc.inactive || npc.alarmed || npc.stunnedTimer > 0 || npc.whisperCommandTimer > 0) continue;
      npc.transit.state = "boarding"; npc.transit.busId = bus.driver.tokenId;
    }
    if (this.riding === bus.driver.tokenId && this.exitRequested) this.leave();
  }

  // NpcSystem calls this inside its normal update. It remains the sole walker.
  updateNpc(npc, dt, owner) {
    const trip = npc.transit;
    if (!trip) return false;
    if (npc.transitBoarded) { owner.stopNpc(npc); return true; }
    if (npc.dead || npc.intercepted || npc.alarmed || npc.dragged || npc.stunnedTimer > 0 || npc.whisperCommandTimer > 0) {
      npc.transit = null; return false;
    }
    const line = this.lines.find(item => item.id === trip.lineId);
    const stop = line?.stops.find(item => item.id === trip.stopId);
    if (!stop) return false;
    trip.cooldown = Math.max(0, trip.cooldown - dt);
    const bus = this.buses.get(trip.busId);
    if (trip.state === "boarding" && bus && !this.canExchange(bus, npc)) {
      trip.state = "waiting"; trip.busId = null;
    }
    const target = trip.state === "boarding" && bus?.arrived ? this.door(bus) : stop;
    if (Math.hypot(npc.x - target.x, npc.y - target.y) > 5) {
      owner.moveTowardAtSpeed(npc, target.x, target.y, dt, 34);
    } else {
      owner.stopNpc(npc);
      if (trip.state === "boarding" && bus?.arrived && bus.passengers.length < CAPACITY) {
        trip.state = "riding";
        trip.destination = line.stops[(bus.nextStop + 2) % line.stops.length].id;
        npc.transitBoarded = true; npc.inactive = true; bus.passengers.push(npc);
        this.boardedCount++;
        this.scene.events?.emit?.("transit:boarded", { npcId: npc.id, busId: bus.driver.tokenId, stopId: stop.id });
      } else if (trip.state === "alighting") trip.state = "waiting";
    }
    return true;
  }

  isRiding() { return Boolean(this.riding); }
  filterInput(frame) {
    return { ...filterVehicleInputFrame({ isDriving: () => true }, frame), move: { x: 0, y: 0 }, hasMovementIntent: false, handbrakeHeld: false };
  }
  openMenu(tokenId) {
    const bus = this.buses.get(tokenId);
    if (!bus) return false;
    this.scene.interactionSystem.open([
      { id: `ride:${tokenId}`, type: "vehicleEnter", label: "Subir como pasajero",
        detail: `${bus.line.name} · espera a que se detenga`, run: () => this.board(tokenId) },
      { id: `steal:${tokenId}`, type: "vehicleEnter", label: "Robar autobús",
        detail: "Expulsar al conductor y conducir", run: () => this.scene.trafficMaterializationSystem.hijack(tokenId) }
    ]);
    return true;
  }

  board(tokenId) {
    const bus = this.buses.get(tokenId), player = this.scene.player;
    if (!bus || this.isRiding() || this.scene.vehicleSystem?.isDriving?.() || this.scene.currentLayer !== LAYERS.STREET
      || this.scene.feedingSystem?.isActive?.() || this.scene.evidenceSystem?.draggingBody) return false;
    if (!this.scene.trafficMaterializationSystem.assignments.has(tokenId)
      || Math.hypot(player.x - bus.driver.pose.x, player.y - bus.driver.pose.y) > 48) return false;
    if (Math.abs(bus.driver.pose.speed) > 2 || bus.passengers.length >= CAPACITY) {
      this.scene.lastActionText = "Espera a que el autobús se detenga y tenga sitio."; return false;
    }
    this.riding = tokenId; this.exitRequested = false;
    player.body?.setVelocity?.(0, 0);
    if (player.body) { player.body.setEnable?.(false); player.body.enable = false; }
    player.setVisible?.(false);
    this.scene.cameras?.main?.startFollow?.(player, true, 0.1, 0.1);
    this.scene.inputSystem?.resetWorldEdges?.();
    this.syncPlayer();
    this.scene.lastActionText = `${bus.line.name} · ENTER para pedir parada.`;
    return true;
  }

  collectInteractions() {
    return [{ id: "bus-exit", type: "vehicleExit", label: "Bajar del autobús", detail: "ENTER · solicitar parada", priority: 200,
      x: this.scene.player.x, y: this.scene.player.y, distance: 0, run: () => {
        this.exitRequested = true;
        if (!this.leave()) this.scene.lastActionText = "Parada solicitada · bajarás cuando el autobús se detenga.";
      } }];
  }

  leave({ force = false } = {}) {
    const bus = this.buses.get(this.riding);
    if (!this.riding) return false;
    if (!force && (!bus || Math.abs(bus.driver.pose.speed) > 2)) return false;
    const stop = bus?.line.stops[bus.nextStop];
    const p = bus?.driver.pose || this.scene.player;
    const candidates = [bus?.arrived ? stop : null, bus && this.door(bus),
      ...[28, 40, 58, 76].flatMap(offset => [-1, 1].map(side => ({
        x: p.x - Math.sin(p.angle || 0) * offset * side, y: p.y + Math.cos(p.angle || 0) * offset * side
      })))].filter(Boolean);
    const materializer = this.scene.trafficMaterializationSystem;
    const point = candidates.find(q => (!this.scene.canStandAt || this.scene.canStandAt(q.x, q.y))
      && !materializer?.blocksVehicle?.(q.x, q.y, 9, { ignoreTokenId: this.riding }));
    if (!point && !force) return false;
    this.riding = null; this.exitRequested = false;
    const player = this.scene.player;
    player.setPosition?.((point || p).x, (point || p).y).setVisible?.(true);
    if (player.body) { player.body.reset?.(player.x, player.y); player.body.enable = true; player.body.setEnable?.(true); player.body.setVelocity?.(0, 0); }
    this.scene.lastActionText = "Has bajado del autobús.";
    return true;
  }

  syncPlayer() {
    const bus = this.buses.get(this.riding);
    if (!bus) return;
    this.scene.player.setPosition?.(bus.driver.pose.x, bus.driver.pose.y);
    this.scene.player.setVisible?.(false);
  }

  update() {
    for (const bus of this.buses.values()) for (const npc of bus.passengers) {
      npc.x = bus.driver.pose.x; npc.y = bus.driver.pose.y;
      npc.container?.setVisible?.(false);
    }
    this.syncPlayer();
    if (this.exitRequested) this.leave();
    const view = this.scene.cameras?.main?.worldView;
    for (const { sign, stop } of this.signs) sign.setVisible?.(this.scene.currentLayer === LAYERS.STREET && (!view
      || stop.x > view.x - 60 && stop.x < view.x + view.width + 60 && stop.y > view.y - 60 && stop.y < view.y + view.height + 60));
    const bus = this.buses.get(this.riding);
    if (bus) this.scene.lastActionText = `${bus.line.name} · próxima: ${bus.line.stops[bus.nextStop].name} · ${this.exitRequested ? "PARADA SOLICITADA" : "ENTER pedir parada"}`;
  }

  evacuate(tokenId, captured) {
    const bus = this.buses.get(tokenId);
    if (!bus) return [];
    const passengers = [...bus.passengers];
    for (const [i, npc] of passengers.entries()) {
      const point = this.scene.trafficMaterializationSystem.occupantPosition(captured, i, passengers.length);
      npc.x = point.x; npc.y = point.y; npc.transitBoarded = false; npc.inactive = false; npc.transit = null;
      this.evacuatedCount++;
      npc.panicTimer = 4; npc.panicSourceX = captured.x; npc.panicSourceY = captured.y;
      npc.container?.setActive?.(true).setPosition?.(npc.x, npc.y).setVisible?.(true);
    }
    bus.passengers.length = 0;
    return passengers;
  }

  retire(tokenId) {
    if (this.riding === tokenId) this.leave({ force: true });
    this.buses.delete(tokenId);
  }
  snapshot() {
    return { riding: this.riding, exitRequested: this.exitRequested, boarded: this.boardedCount, alighted: this.alightedCount, evacuated: this.evacuatedCount,
      lines: this.lines.map(line => ({ id: line.id, name: line.name, length: line.journey.circuitLength, stops: line.stops })),
      buses: [...this.buses].map(([id, bus]) => ({ id, lineId: bus.line.id, nextStop: bus.line.stops[bus.nextStop].id,
        dwelling: bus.arrived, visits: bus.visits, skippedStops: bus.skippedStops, passengers: bus.passengers.length })) };
  }
  clearFleet() {
    this.leave({ force: true });
    for (const { sign } of this.signs) sign.destroy?.();
    for (const npc of this.people) {
      const all = this.scene.npcSystem?.npcs, index = all?.indexOf(npc) ?? -1;
      if (index >= 0) all.splice(index, 1);
      this.scene.entityStreamSystem?.npcRecords?.delete?.(npc.id);
      npc.container?.destroy?.();
    }
    this.signs = []; this.people = []; this.buses.clear();
  }
  destroy() { this.clearFleet(); this.scene.events?.off?.("traffic:vehicle-hijacked", this.onHijack); }
}
