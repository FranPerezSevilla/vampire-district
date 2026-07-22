import { VEHICLE_OWNERSHIP, vehicleArchetype } from "../data/vehicles.js";

const STATUS_VALUES = new Set(Object.values(VEHICLE_OWNERSHIP));

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

function flagKey(vehicleId, field) {
  return `vehicle.${String(vehicleId || "")}.${String(field || "")}`;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseItems(value) {
  if (Array.isArray(value)) return uniqueStrings(value);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return uniqueStrings(JSON.parse(value));
  } catch {
    return [];
  }
}

export class CampaignVehicleSystem {
  constructor(state, { events = null, now = () => Date.now(), onDirty = null } = {}) {
    if (!state?.world || !Array.isArray(state.world.ownedVehicles) || !state.world.flags) {
      throw new TypeError("CampaignVehicleSystem requires campaign world state.");
    }
    this.state = state;
    this.events = events;
    this.now = now;
    this.onDirty = onDirty;
  }

  ensureStartingOwnership(definitions = []) {
    let changed = false;
    for (const definition of definitions) {
      if (!definition?.startOwned || !definition.id) continue;
      if (this.state.world.ownedVehicles.includes(definition.id)) continue;
      this.state.world.ownedVehicles.push(definition.id);
      changed = true;
    }
    if (changed) this.commit("vehicle:starting-ownership", {
      vehicleIds: this.state.world.ownedVehicles.join(",")
    });
    return changed;
  }

  status(definitionOrId, fallback = VEHICLE_OWNERSHIP.PARKED) {
    const definition = typeof definitionOrId === "object" ? definitionOrId : null;
    const vehicleId = String(definition?.id || definitionOrId || "");
    if (!vehicleId) return fallback;
    if (this.state.world.ownedVehicles.includes(vehicleId)) return VEHICLE_OWNERSHIP.OWNED;
    const flagged = String(this.state.world.flags[flagKey(vehicleId, "status")] || "");
    if (STATUS_VALUES.has(flagged)) return flagged;
    const authored = String(definition?.ownership || fallback);
    return STATUS_VALUES.has(authored) ? authored : fallback;
  }

  isOwned(vehicleId) {
    return this.status(vehicleId) === VEHICLE_OWNERSHIP.OWNED;
  }

  condition(definition) {
    if (!definition?.id) throw new TypeError("Vehicle definition is required.");
    const archetype = vehicleArchetype(definition.archetypeId);
    const maximum = Math.max(1, Number(archetype?.maxHealth) || 1);
    const health = Math.max(0, Math.min(maximum, finite(
      this.state.world.flags[flagKey(definition.id, "health")],
      maximum
    )));
    return {
      x: finite(this.state.world.flags[flagKey(definition.id, "x")], Number(definition.x) || 0),
      y: finite(this.state.world.flags[flagKey(definition.id, "y")], Number(definition.y) || 0),
      angle: finite(this.state.world.flags[flagKey(definition.id, "angle")], Number(definition.angle) || 0),
      health,
      disabled: health <= 0,
      parked: this.state.world.flags[flagKey(definition.id, "parked")] == null
        ? definition.parked !== false
        : Boolean(this.state.world.flags[flagKey(definition.id, "parked")])
    };
  }

  markOwned(vehicleId, metadata = {}) {
    const id = String(vehicleId || "").trim();
    if (!id) throw new TypeError("Vehicle id is required.");
    if (!this.state.world.ownedVehicles.includes(id)) this.state.world.ownedVehicles.push(id);
    delete this.state.world.flags[flagKey(id, "status")];
    this.commit("vehicle:ownership-changed", {
      vehicleId: id,
      status: VEHICLE_OWNERSHIP.OWNED,
      source: String(metadata.source || "campaign")
    });
    return this.status(id);
  }

  markStolen(vehicleId, metadata = {}) {
    const id = String(vehicleId || "").trim();
    if (!id) throw new TypeError("Vehicle id is required.");
    this.state.world.ownedVehicles = this.state.world.ownedVehicles.filter(candidate => candidate !== id);
    this.state.world.flags[flagKey(id, "status")] = VEHICLE_OWNERSHIP.STOLEN;
    this.state.world.flags[flagKey(id, "stolenAt")] = Math.max(0, Math.trunc(Number(this.now()) || 0));
    if (metadata.factionId) this.state.world.flags[flagKey(id, "stolenFromFaction")] = String(metadata.factionId);
    this.commit("vehicle:ownership-changed", {
      vehicleId: id,
      status: VEHICLE_OWNERSHIP.STOLEN,
      source: String(metadata.source || "theft")
    });
    return this.status(id);
  }

  updateCondition(vehicleId, condition = {}, { emit = true, dirty = true } = {}) {
    const id = String(vehicleId || "").trim();
    if (!id) throw new TypeError("Vehicle id is required.");
    const fields = ["x", "y", "angle", "health"];
    let changed = false;
    for (const field of fields) {
      const number = Number(condition[field]);
      if (!Number.isFinite(number)) continue;
      const key = flagKey(id, field);
      if (Number(this.state.world.flags[key]) === number) continue;
      this.state.world.flags[key] = Math.round(number * 1000) / 1000;
      changed = true;
    }
    if (condition.parked != null) {
      const key = flagKey(id, "parked");
      const value = Boolean(condition.parked);
      if (Boolean(this.state.world.flags[key]) !== value || this.state.world.flags[key] == null) {
        this.state.world.flags[key] = value;
        changed = true;
      }
    }
    if (changed) {
      if (emit) this.commit("vehicle:condition-changed", { vehicleId: id });
      else if (dirty) this.onDirty?.();
    }
    return changed;
  }

  trunkItems(vehicleId) {
    return parseItems(this.state.world.flags[flagKey(vehicleId, "trunk")]);
  }

  storeItem(vehicleId, itemId, capacity) {
    const id = String(vehicleId || "").trim();
    const item = String(itemId || "").trim();
    const maximum = Math.max(0, Math.trunc(Number(capacity) || 0));
    if (!id || !item) throw new TypeError("Vehicle id and item id are required.");
    const items = this.trunkItems(id);
    if (items.includes(item)) return this.trunkSnapshot(id, maximum);
    if (items.length >= maximum) {
      const error = new RangeError(`Vehicle trunk is full: ${items.length}/${maximum}.`);
      error.code = "TRUNK_FULL";
      throw error;
    }
    items.push(item);
    this.state.world.flags[flagKey(id, "trunk")] = JSON.stringify(items);
    this.commit("vehicle:trunk-changed", { vehicleId: id, itemId: item, operation: "store" });
    return this.trunkSnapshot(id, maximum);
  }

  removeItem(vehicleId, itemId, capacity = 0) {
    const id = String(vehicleId || "").trim();
    const item = String(itemId || "").trim();
    if (!id || !item) throw new TypeError("Vehicle id and item id are required.");
    const before = this.trunkItems(id);
    const items = before.filter(candidate => candidate !== item);
    if (items.length === before.length) return this.trunkSnapshot(id, capacity);
    this.state.world.flags[flagKey(id, "trunk")] = JSON.stringify(items);
    this.commit("vehicle:trunk-changed", { vehicleId: id, itemId: item, operation: "remove" });
    return this.trunkSnapshot(id, capacity);
  }

  trunkSnapshot(vehicleId, capacity) {
    const items = this.trunkItems(vehicleId);
    const maximum = Math.max(0, Math.trunc(Number(capacity) || 0));
    return {
      vehicleId: String(vehicleId || ""),
      capacity: maximum,
      used: items.length,
      remaining: Math.max(0, maximum - items.length),
      items: [...items]
    };
  }

  snapshot(definitions = []) {
    return definitions.map(definition => {
      const archetype = vehicleArchetype(definition.archetypeId);
      const condition = this.condition(definition);
      return {
        id: definition.id,
        name: definition.name,
        archetypeId: definition.archetypeId,
        status: this.status(definition),
        ownerId: definition.ownerId || null,
        factionId: definition.factionId || null,
        condition,
        trunk: this.trunkSnapshot(definition.id, archetype?.trunkCapacity || 0)
      };
    });
  }

  summary(definitions = []) {
    const snapshot = this.snapshot(definitions);
    const owned = snapshot.filter(vehicle => vehicle.status === VEHICLE_OWNERSHIP.OWNED).length;
    const stolen = snapshot.filter(vehicle => vehicle.status === VEHICLE_OWNERSHIP.STOLEN).length;
    return `Vehicles ${snapshot.length} · owned ${owned} · stolen ${stolen}`;
  }

  commit(type, payload) {
    if (this.events?.emit) this.events.emit(type, payload);
    else this.onDirty?.();
  }
}
