import { vehicleDefinitions } from "../data/vehicles.js";
import { CampaignVehicleSystem } from "../vehicles/CampaignVehicleSystem.js";
import { VehicleMaintenanceService } from "../vehicles/VehicleMaintenanceService.js";
import {
  CampaignSystem as CampaignSystemCore,
  DEFAULT_DEFINITIONS
} from "./CampaignSystemCore.js";

export class CampaignSystem extends CampaignSystemCore {
  buildServices() {
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
