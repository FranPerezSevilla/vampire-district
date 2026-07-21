import { vehicleDefinitions } from "../data/vehicles.js";
import { CampaignVehicleSystem } from "../vehicles/CampaignVehicleSystem.js";
import {
  CampaignSystem as CampaignSystemCore,
  DEFAULT_DEFINITIONS
} from "./CampaignSystemCore.js";

export class CampaignSystem extends CampaignSystemCore {
  buildServices() {
    super.buildServices();
    this.vehicles = new CampaignVehicleSystem(this.state, {
      events: this.events,
      now: this.now,
      onDirty: () => {
        this.touch();
        if (this.autoSave) this.save();
      }
    });
    this.vehicles.ensureStartingOwnership(vehicleDefinitions);
  }

  snapshot() {
    return {
      ...super.snapshot(),
      vehicles: this.vehicles.snapshot(vehicleDefinitions)
    };
  }

  summary() {
    return `${super.summary()} · ${this.vehicles.summary(vehicleDefinitions)}`;
  }
}

export { DEFAULT_DEFINITIONS };
