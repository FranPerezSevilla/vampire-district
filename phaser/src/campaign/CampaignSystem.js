import { vehicleDefinitions } from "../data/vehicles.js";
import { CampaignVehicleSystem } from "../vehicles/CampaignVehicleSystem.js";
import { VehicleMaintenanceService } from "../vehicles/VehicleMaintenanceService.js";
import { CampaignSystem as CampaignSystemCore } from "./CampaignSystemCore.js";

// The campaign framework remains available, but the production build no longer
// registers authored contracts. Future missions must opt in explicitly instead
// of silently preserving the legacy Old Quarter layout.
const DEFAULT_DEFINITIONS = Object.freeze([]);

function sameArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class CampaignSystem extends CampaignSystemCore {
  constructor(options = {}) {
    super({
      ...options,
      definitions: options.definitions ?? DEFAULT_DEFINITIONS
    });
    if (this.retiredMissionState && this.autoSave) this.save();
  }

  pruneUnregisteredMissionState() {
    const missions = this.state?.missions;
    if (!missions) return false;
    const registered = new Set((this.definitions || []).map(definition => definition.id));
    let changed = false;

    for (const id of Object.keys(missions.records || {})) {
      if (registered.has(id)) continue;
      delete missions.records[id];
      changed = true;
    }

    if (missions.activeMissionId && !registered.has(missions.activeMissionId)) {
      missions.activeMissionId = null;
      changed = true;
    }

    const completed = (missions.completed || []).filter(id => registered.has(id));
    const failed = (missions.failed || []).filter(id => registered.has(id));
    if (!sameArray(completed, missions.completed || [])) {
      missions.completed = completed;
      changed = true;
    }
    if (!sameArray(failed, missions.failed || [])) {
      missions.failed = failed;
      changed = true;
    }

    const checkpoint = this.state.checkpoints?.latest;
    if (checkpoint?.missionId && !registered.has(checkpoint.missionId)) {
      this.state.checkpoints.latest = null;
      changed = true;
    }

    this.retiredMissionState = this.retiredMissionState || changed;
    return changed;
  }

  buildServices() {
    this.pruneUnregisteredMissionState();
    super.buildServices();
    const dirty = () => {
      this.touch();
      if (this.autoSave) this.save();
    };
    this.vehicles = new CampaignVehicleSystem(this.state, {
      events: this.events,
      now: this.now,
      onDirty: dirty
    });
    this.vehicles.ensureStartingOwnership(vehicleDefinitions);
    this.vehicleMaintenance = new VehicleMaintenanceService(this.state, {
      wallet: this.wallet,
      vehicles: this.vehicles,
      definitions: vehicleDefinitions,
      events: this.events,
      now: this.now,
      onDirty: dirty
    });
  }

  snapshot() {
    return {
      ...super.snapshot(),
      vehicles: this.vehicles.snapshot(vehicleDefinitions),
      vehicleMaintenance: this.vehicleMaintenance.snapshot()
    };
  }

  summary() {
    return `${super.summary()} · ${this.vehicles.summary(vehicleDefinitions)}`;
  }
}

export { DEFAULT_DEFINITIONS };
