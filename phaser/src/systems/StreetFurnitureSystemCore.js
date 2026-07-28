import { dumpsters, LAYERS } from "../data/district.js";
import { vehicleFootprintPoints } from "../vehicles/VehicleModel.js";
import {
  STREET_PROP_TYPES,
  pointHitsVehicleFootprint,
  vehiclePropImpactResult
} from "./StreetFurnitureModel.js";

function flagKey(id) {
  return `streetProp.${String(id || "")}.broken`;
}

function paintDumpster(scene, definition) {
  const container = scene.add.container(definition.x, definition.y).setDepth(45);
  const body = scene.add.rectangle(0, 0, 24, 14, 0x31534d, 1)
    .setStrokeStyle(1, 0x78c7a3, 0.8);
  const lid = scene.add.rectangle(0, -8, 25, 4, 0x1d3430, 1)
    .setStrokeStyle(1, 0x99d8bd, 0.65);
  const wheels = [
    scene.add.rectangle(-8, 8, 4, 3, 0x090b0d, 1),
    scene.add.rectangle(8, 8, 4, 3, 0x090b0d, 1)
  ];
  const label = scene.add.text(0, -15, "DUMPSTER", {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "10px",
    fontStyle: "bold",
    color: "#b8efd7",
    backgroundColor: "rgba(5, 6, 11, .62)",
    padding: { x: 2, y: 1 }
  }).setOrigin(0.5, 1);
  label.setResolution?.(3);
  label.setStroke?.("#05060b", 2);
  container.add([body, lid, ...wheels, label]);
  return { container, body, lid, wheels, label };
}

function applyBrokenVisual(prop) {
  prop.visual.container.setRotation(-0.22).setAlpha(0.72);
  prop.visual.body.setFillStyle(0x49332f, 0.9);
  prop.visual.lid.setPosition(9, -2).setRotation(0.58).setFillStyle(0x2a211f, 1);
  prop.visual.label.setText("RUPTURED").setColor("#ffb6a0");
}

export class StreetFurnitureSystem {
  constructor(scene, campaign = scene?.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM) {
    if (!scene || !campaign?.state?.world?.flags) {
      throw new TypeError("StreetFurnitureSystem requires GameScene and campaign world state.");
    }
    this.scene = scene;
    this.campaign = campaign;
    this.dumpsters = dumpsters.map(definition => {
      const visual = paintDumpster(scene, definition);
      const broken = Boolean(campaign.state.world.flags[flagKey(definition.id)]);
      const prop = { ...definition, type: STREET_PROP_TYPES.DUMPSTER, broken, visual };
      if (broken) applyBrokenVisual(prop);
      return prop;
    });

    this.onPropBroken = payload => {
      if (!payload?.propId) return;
      this.persistBroken(payload.propId, true);
    };
    scene.events?.on?.("prop:broken", this.onPropBroken);
    this.refreshVisibility();
    this.publish();
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  persistBroken(id, broken = true) {
    const key = flagKey(id);
    if (Boolean(this.campaign.state.world.flags[key]) === Boolean(broken)) return false;
    this.campaign.state.world.flags[key] = Boolean(broken);
    this.campaign.events?.emit?.("street-prop:state-changed", {
      propId: String(id || ""),
      broken: Boolean(broken)
    });
    return true;
  }

  dumpster(id) {
    return this.dumpsters.find(candidate => candidate.id === id) || null;
  }

  resolveVehicleMove(vehicle, nextState) {
    if (!vehicle || !nextState || this.scene.currentLayer !== LAYERS.STREET) {
      return { blocked: false, impacts: [] };
    }
    const footprint = vehicleFootprintPoints(nextState, vehicle.archetype, 2);
    const impactSpeed = Math.abs(Number(nextState.speed) || 0);
    const impacts = [];

    for (const prop of this.dumpsters) {
      if (prop.broken) continue;
      if (!pointHitsVehicleFootprint(prop, footprint, (prop.hitRadius || 14) + 4)) continue;
      const result = vehiclePropImpactResult(STREET_PROP_TYPES.DUMPSTER, impactSpeed);
      if (result.blocks) return { blocked: true, impacts, propId: prop.id };
      this.breakDumpster(prop.id, { vehicle, impactSpeed });
      if (result.vehicleDamage > 0) {
        this.scene.vehicleSystem?.damageVehicle?.(vehicle.id, result.vehicleDamage, {
          reason: "dumpster-impact",
          persist: false
        });
      }
      impacts.push({ propId: prop.id, type: STREET_PROP_TYPES.DUMPSTER, broken: true });
    }

    return { blocked: false, impacts };
  }

  breakDumpster(id, { vehicle = null, impactSpeed = 0 } = {}) {
    const prop = this.dumpster(id);
    if (!prop || prop.broken) return false;
    prop.broken = true;
    applyBrokenVisual(prop);
    this.persistBroken(prop.id, true);

    const releasedBody = this.releaseHiddenBody(prop, vehicle);
    const reason = releasedBody
      ? `${prop.name} ruptures and ejects a hidden corpse into the street.`
      : `${prop.name} bursts open and scatters refuse across the road.`;
    this.scene.exposureSystem?.add?.(releasedBody ? 12 : 5, reason);
    this.scene.policeSystem?.addHeat?.(
      prop.x,
      prop.y,
      releasedBody ? 28 : 12,
      releasedBody ? "corpse exposed by vehicle impact" : "dumpster destroyed by vehicle"
    );
    this.scene.lastActionText = releasedBody
      ? "DUMPSTER RUPTURED: a hidden body spills into the road. Blood and evidence are exposed."
      : "DUMPSTER RUPTURED: refuse and metal scatter under the vehicle.";
    this.scene.events?.emit?.("street-prop:broken", {
      propId: prop.id,
      propType: STREET_PROP_TYPES.DUMPSTER,
      vehicleId: vehicle?.id || null,
      impactSpeed: Math.abs(Number(impactSpeed) || 0),
      releasedBodyId: releasedBody?.id || null
    });
    this.scene.events?.emit?.("noise:emitted", {
      kind: "dumpsterRupture",
      x: prop.x,
      y: prop.y,
      layer: prop.layer,
      radius: 220,
      severity: releasedBody ? 18 : 11,
      sourceEntityId: prop.id
    });
    this.publish();
    return true;
  }

  releaseHiddenBody(prop, vehicle = null) {
    const body = (this.scene.npcSystem?.npcs || []).find(candidate => (
      candidate.hiddenBody && candidate.hiddenSpotId === prop.id
    ));
    if (!body) return null;

    const angle = Number(vehicle?.angle) || 0;
    body.hiddenBody = false;
    body.hiddenSpotId = null;
    body.hiddenSpotName = null;
    body.dragged = false;
    body.corpseDiscovered = false;
    body.layer = LAYERS.STREET;
    body.x = prop.x + Math.cos(angle) * 20;
    body.y = prop.y + Math.sin(angle) * 20;
    body.container?.setPosition?.(body.x, body.y).setVisible?.(true);

    const evidence = this.scene.evidenceSystem;
    if (evidence) {
      evidence.stats.bodiesHidden = Math.max(0, Number(evidence.stats.bodiesHidden) - 1);
      for (let index = 0; index < 7; index++) {
        const trail = index * 5;
        evidence.createBloodStain(
          body.x - Math.cos(angle) * trail,
          body.y - Math.sin(angle) * trail,
          LAYERS.STREET,
          "dumpster-rupture"
        );
      }
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    this.scene.events?.emit?.("evidence:body-exposed", {
      targetId: body.id,
      source: "dumpster-rupture",
      spotId: prop.id
    });
    return body;
  }

  refreshVisibility() {
    for (const prop of this.dumpsters) {
      prop.visual.container.setVisible(this.scene.currentLayer === prop.layer);
    }
  }

  snapshot() {
    return {
      dumpsters: this.dumpsters.map(prop => ({
        id: prop.id,
        name: prop.name,
        x: prop.x,
        y: prop.y,
        broken: prop.broken
      }))
    };
  }

  publish() {
    const snapshot = this.snapshot();
    const brokenDumpsters = snapshot.dumpsters.filter(item => item.broken).length;
    this.scene.statePublisher?.setMany?.({
      streetFurnitureText: `Street props · dumpsters ${brokenDumpsters} ruptured`,
      streetFurnitureState: snapshot
    });
    if (typeof window !== "undefined") {
      window.NBD_STREET_PROPS = Object.freeze({
        snapshot: () => this.snapshot(),
        breakDumpster: id => this.breakDumpster(id),
        impact: (vehicleId, propId, speed = 60) => {
          const vehicle = this.scene.vehicleSystem?.vehicle?.(vehicleId);
          const prop = this.dumpster(propId);
          if (!vehicle || !prop) return false;
          return this.breakDumpster(prop.id, { vehicle, impactSpeed: speed });
        }
      });
      window.NBD_STREET_PROPS_READY = true;
    }
    return snapshot;
  }

  destroy() {
    this.scene.events?.off?.("prop:broken", this.onPropBroken);
    for (const prop of this.dumpsters) prop.visual.container?.destroy?.();
    this.dumpsters = [];
    if (typeof window !== "undefined") {
      if (window.NBD_STREET_PROPS) delete window.NBD_STREET_PROPS;
      window.NBD_STREET_PROPS_READY = false;
    }
  }
}
