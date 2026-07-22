import { chunkIdAt } from "./CityChunkManifest.js";

const DELTA_PREFIX = "cityChunkDelta.";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inBounds(item, bounds) {
  const x = finite(item?.x);
  const y = finite(item?.y);
  return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
}

function bodyDelta(body) {
  return {
    id: String(body.id),
    x: finite(body.x),
    y: finite(body.y),
    layer: finite(body.layer),
    dead: Boolean(body.dead),
    inactive: Boolean(body.inactive),
    dragged: Boolean(body.dragged),
    hiddenBody: Boolean(body.hiddenBody),
    hiddenSpotId: body.hiddenSpotId || null,
    corpseDiscovered: Boolean(body.corpseDiscovered),
    exposedAfterContainment: Boolean(body.exposedAfterContainment)
  };
}

function evidenceDelta(stain) {
  return {
    id: String(stain.id),
    x: finite(stain.x),
    y: finite(stain.y),
    layer: finite(stain.layer),
    kind: String(stain.kind || "blood"),
    age: finite(stain.age),
    life: finite(stain.life),
    discovered: Boolean(stain.discovered)
  };
}

function propDelta(prop, type) {
  return {
    id: String(prop.id),
    type,
    x: finite(prop.x),
    y: finite(prop.y),
    broken: Boolean(prop.broken)
  };
}

function vehicleDelta(vehicle) {
  return {
    id: String(vehicle.id),
    x: finite(vehicle.x),
    y: finite(vehicle.y),
    angle: finite(vehicle.angle),
    health: finite(vehicle.health),
    parked: Boolean(vehicle.parked),
    disabled: Boolean(vehicle.disabled),
    ownership: vehicle.ownership || null
  };
}

export class ChunkDeltaStore {
  constructor(scene, manifest) {
    if (!scene || !manifest?.chunks) throw new TypeError("ChunkDeltaStore requires a scene and manifest.");
    this.scene = scene;
    this.manifest = manifest;
    this.sequence = 0;
    this.memory = new Map();
    this.restoreFromCampaign();
  }

  flags() {
    return this.scene.campaignSystem?.state?.world?.flags || null;
  }

  key(id) {
    return `${DELTA_PREFIX}${String(id)}`;
  }

  restoreFromCampaign() {
    const flags = this.flags();
    if (!flags) return;
    for (const id of this.manifest.chunkIds) {
      const value = flags[this.key(id)];
      if (value?.version === 1) this.memory.set(id, value);
    }
  }

  captureChunk(id) {
    const chunkId = String(id);
    const bounds = this.manifest.chunks[chunkId]?.bounds;
    if (!bounds) return null;
    const bodies = (this.scene.npcSystem?.npcs || [])
      .filter(body => inBounds(body, bounds) && (body.dead || body.hiddenBody || body.dragged || body.corpseDiscovered || body.exposedAfterContainment))
      .map(bodyDelta);
    const evidence = (this.scene.evidenceSystem?.bloodStains || [])
      .filter(stain => inBounds(stain, bounds))
      .map(evidenceDelta);
    const streetProps = [
      ...(this.scene.streetFurnitureSystem?.dumpsters || []).map(prop => ({ prop, type: "dumpster" })),
      ...(this.scene.propDamageSystem?.props || []).map(prop => ({ prop, type: "streetlight" }))
    ].filter(({ prop }) => inBounds(prop, bounds) && prop.broken)
      .map(({ prop, type }) => propDelta(prop, type));
    const vehicles = (this.scene.vehicleSystem?.vehicles || [])
      .filter(vehicle => inBounds(vehicle, bounds))
      .map(vehicleDelta);
    const delta = {
      version: 1,
      chunkId,
      sequence: ++this.sequence,
      bodies,
      evidence,
      streetProps,
      vehicles
    };
    this.memory.set(chunkId, delta);
    const flags = this.flags();
    if (flags) flags[this.key(chunkId)] = delta;
    return delta;
  }

  capturePoint(x, y) {
    return this.captureChunk(chunkIdAt(x, y, this.manifest.chunkSize));
  }

  get(id) {
    return this.memory.get(String(id)) || null;
  }

  snapshot() {
    const domains = { bodies: 0, evidence: 0, streetProps: 0, vehicles: 0 };
    for (const delta of this.memory.values()) {
      for (const key of Object.keys(domains)) domains[key] += delta[key]?.length || 0;
    }
    return {
      chunks: [...this.memory.keys()].sort((a, b) => a.localeCompare(b)),
      count: this.memory.size,
      domains
    };
  }

  serialize() {
    return JSON.stringify(Object.fromEntries(this.memory), null, 2);
  }

  destroy() {
    this.memory.clear();
  }
}
